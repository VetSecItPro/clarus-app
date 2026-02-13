/**
 * @module content-screening
 * @description Content moderation pipeline with three detection layers.
 *
 * Screens user-submitted content for illegal material before it reaches
 * the AI analysis pipeline:
 *   1. **URL screening** -- block known illegal content domains
 *   2. **Keyword pre-screening** -- detect prohibited content patterns in scraped text
 *   3. **AI refusal detection** -- catch `CONTENT_REFUSED` responses from the AI model
 *
 * When flagged, content is logged to the `flagged_content` table for admin
 * review. CSAM flags carry a legal reporting obligation under
 * 18 U.S.C. section 2258A (ESPs must report apparent CSAM to NCMEC).
 *
 * @see {@link lib/prompt-sanitizer.ts} for prompt injection defense (different concern)
 */

import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { createHash } from "crypto"
import { logger } from "@/lib/logger"

// ============================================
// Types
// ============================================

/** How severe the moderation flag is -- determines whether content is blocked. */
export type FlagSeverity = "critical" | "high" | "medium"

/** Which detection layer produced the flag. */
export type FlagSource = "url_screening" | "keyword_screening" | "ai_refusal"

/** Category of prohibited content detected. */
export type FlagCategory = "csam" | "terrorism" | "weapons" | "trafficking"

/** Current review status of a flagged content record. */
export type FlagStatus = "pending" | "reviewed" | "reported" | "dismissed"

/**
 * A single moderation flag with its source, severity, and reason.
 * Multiple flags can be generated for a single piece of content.
 */
export interface ContentFlag {
  source: FlagSource
  severity: FlagSeverity
  categories: FlagCategory[]
  reason: string
}

/**
 * Result of running the content screening pipeline.
 * When `blocked` is `true`, the content should not be sent to AI analysis.
 */
export interface ScreeningResult {
  blocked: boolean
  flags: ContentFlag[]
}

// ============================================
// URL Screening (Layer 1)
// ============================================

/**
 * Domains associated with illegal content distribution.
 * This list is intentionally sparse -- it targets known vectors,
 * not a comprehensive blocklist. The AI refusal layer catches the rest.
 */
const BLOCKED_DOMAIN_PATTERNS: Array<{ pattern: RegExp; categories: FlagCategory[]; severity: FlagSeverity }> = [
  // Known CSAM distribution patterns (onion/darknet proxy domains)
  { pattern: /\.onion\./i, categories: ["csam", "trafficking"], severity: "critical" },
  // Paste sites frequently used for illegal content distribution
  { pattern: /(?:darknet|deepweb|hidden.wiki)/i, categories: ["csam", "trafficking"], severity: "critical" },
]

/**
 * Screens a URL against known blocked domain patterns (Layer 1).
 *
 * @param url - The URL to screen
 * @returns A {@link ContentFlag} if the domain matches a blocked pattern, or `null` if clean
 */
export function screenUrl(url: string): ContentFlag | null {
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }

  for (const entry of BLOCKED_DOMAIN_PATTERNS) {
    if (entry.pattern.test(hostname)) {
      return {
        source: "url_screening",
        severity: entry.severity,
        categories: entry.categories,
        reason: `URL matches blocked domain pattern: ${hostname}`,
      }
    }
  }

  return null
}

// ============================================
// Keyword Pre-Screening (Layer 2)
// ============================================

/**
 * Pattern groups for detecting prohibited content in scraped text.
 *
 * Design principles:
 * - Use multi-word phrases to reduce false positives (single words like "child" are too common)
 * - Require co-occurrence of indicator + context words
 * - These patterns target instructional/distributional content, not news reporting about these topics
 */

interface KeywordPattern {
  /** Regex pattern to match against content */
  pattern: RegExp
  categories: FlagCategory[]
  severity: FlagSeverity
  reason: string
}

const KEYWORD_PATTERNS: KeywordPattern[] = [
  // CSAM indicators: age-indicating terms co-occurring with exploitation terms
  // These use word boundaries and require multi-term co-occurrence
  {
    pattern: /\b(?:child|minor|underage|pre-?teen|infant)\b[\s\S]{0,200}\b(?:exploit|abuse|nude|naked|porn|sexual|molest|groom)\b/i,
    categories: ["csam"],
    severity: "critical",
    reason: "Content contains child exploitation indicators",
  },
  {
    pattern: /\b(?:exploit|abuse|nude|naked|porn|sexual|molest|groom)\b[\s\S]{0,200}\b(?:child|minor|underage|pre-?teen|infant)\b/i,
    categories: ["csam"],
    severity: "critical",
    reason: "Content contains child exploitation indicators",
  },
  // Known CSAM terminology / code words
  {
    pattern: /\b(?:cp\s+(?:link|download|share|collection|trade)|pizza\s+cheese\s+(?:link|download|share))\b/i,
    categories: ["csam"],
    severity: "critical",
    reason: "Content contains known CSAM distribution terminology",
  },

  // Weapons of mass destruction — manufacturing instructions
  {
    pattern: /\b(?:synthesiz|manufactur|produc|creat|mak)\w*\b[\s\S]{0,150}\b(?:sarin|vx\s+gas|nerve\s+agent|ricin|anthrax|botulinum|mustard\s+gas|chlorine\s+gas)\b/i,
    categories: ["weapons"],
    severity: "high",
    reason: "Content contains chemical/biological weapon manufacturing instructions",
  },
  {
    pattern: /\b(?:sarin|vx\s+gas|nerve\s+agent|ricin|anthrax|botulinum)\b[\s\S]{0,150}\b(?:synthesiz|manufactur|produc|creat|mak|prepar)\w*\b/i,
    categories: ["weapons"],
    severity: "high",
    reason: "Content contains chemical/biological weapon manufacturing instructions",
  },
  // IED / explosive device construction
  {
    pattern: /\b(?:improv\w*\s+explosive|pipe\s+bomb|pressure\s+cooker\s+bomb|detonat\w*\s+mechanism)\b[\s\S]{0,200}\b(?:build|construct|assembl|wir|connect|timer)\b/i,
    categories: ["weapons", "terrorism"],
    severity: "high",
    reason: "Content contains explosive device construction instructions",
  },

  // Terrorism — operational planning / recruitment
  {
    pattern: /\b(?:jihad|martyrdom\s+operation|caliphate)\b[\s\S]{0,200}\b(?:recruit|join|travel|train|attack\s+plan|target)\b/i,
    categories: ["terrorism"],
    severity: "high",
    reason: "Content contains terrorism recruitment or operational planning",
  },

  // Human trafficking — facilitation
  {
    pattern: /\b(?:traffick|smuggl)\w*\b[\s\S]{0,200}\b(?:person|human|women|girl|boy|child|minor)\b[\s\S]{0,200}\b(?:price|cost|buy|sell|deliver|transport|route)\b/i,
    categories: ["trafficking"],
    severity: "high",
    reason: "Content contains human trafficking facilitation indicators",
  },
]

/**
 * Screens scraped text against prohibited content keyword patterns (Layer 2).
 *
 * Only scans the first 50KB to avoid regex DoS on very large documents.
 * Deduplicates flags by category to avoid redundant entries when multiple
 * patterns match the same content category.
 *
 * @param text - The scraped text content to screen
 * @returns An array of {@link ContentFlag} objects (empty if clean)
 */
export function screenText(text: string): ContentFlag[] {
  if (!text || text.length < 50) return []

  // Only scan first 50KB to avoid regex DoS on huge documents
  const textToScan = text.substring(0, 50000).toLowerCase()
  const flags: ContentFlag[] = []
  const seenCategories = new Set<string>()

  for (const entry of KEYWORD_PATTERNS) {
    if (entry.pattern.test(textToScan)) {
      const categoryKey = entry.categories.join(",")
      // Don't duplicate flags for same category from multiple patterns
      if (!seenCategories.has(categoryKey)) {
        seenCategories.add(categoryKey)
        flags.push({
          source: "keyword_screening",
          severity: entry.severity,
          categories: entry.categories,
          reason: entry.reason,
        })
      }
    }
  }

  return flags
}

// ============================================
// AI Refusal Detection (Layer 3)
// ============================================

/**
 * Checks whether an AI analysis section returned a `CONTENT_REFUSED` response (Layer 3).
 *
 * The AI prompts are configured to return either:
 *   - JSON: `{"refused": true, "reason": "..."}`
 *   - Text: `"CONTENT_REFUSED: ..."`
 *
 * @param sectionContent - The raw AI output (string or parsed JSON object)
 * @returns A {@link ContentFlag} if refusal is detected, or `null` if the content was analyzed normally
 */
export function detectAiRefusal(sectionContent: unknown): ContentFlag | null {
  if (!sectionContent) return null

  // JSON refusal
  if (typeof sectionContent === "object" && sectionContent !== null) {
    const obj = sectionContent as Record<string, unknown>
    if (obj.refused === true) {
      return {
        source: "ai_refusal",
        severity: "high",
        categories: inferCategoriesFromReason(String(obj.reason || "")),
        reason: String(obj.reason || "AI refused to analyze this content"),
      }
    }
  }

  // Text refusal
  if (typeof sectionContent === "string" && sectionContent.startsWith("CONTENT_REFUSED:")) {
    return {
      source: "ai_refusal",
      severity: "high",
      categories: inferCategoriesFromReason(sectionContent),
      reason: sectionContent.replace("CONTENT_REFUSED:", "").trim(),
    }
  }

  return null
}

function inferCategoriesFromReason(reason: string): FlagCategory[] {
  const lower = reason.toLowerCase()
  const categories: FlagCategory[] = []

  if (lower.includes("child") || lower.includes("csam") || lower.includes("minor") || lower.includes("exploitation")) {
    categories.push("csam")
  }
  if (lower.includes("terror") || lower.includes("bomb") || lower.includes("attack")) {
    categories.push("terrorism")
  }
  if (lower.includes("weapon") || lower.includes("explosive") || lower.includes("chemical") || lower.includes("biological")) {
    categories.push("weapons")
  }
  if (lower.includes("traffick")) {
    categories.push("trafficking")
  }

  // Default if no specific category detected
  if (categories.length === 0) categories.push("terrorism")

  return categories
}

// ============================================
// Flagging — persist to database
// ============================================

let _adminClient: ReturnType<typeof createClient<Database, "clarus">> | null = null
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient<Database, "clarus">(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: "clarus" } }
    )
  }
  return _adminClient
}

/**
 * Generates a SHA-256 hash of content text for deduplication and forensic matching.
 *
 * @param text - The content text to hash
 * @returns The hex-encoded SHA-256 digest
 */
export function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

/**
 * Persists a moderation flag to the `flagged_content` table for admin review.
 *
 * Stores the flag details along with a content hash and preview text.
 * Fire-and-forget -- errors are logged but never thrown to avoid
 * disrupting the request flow.
 *
 * @param params - The flag details and associated content metadata
 */
export async function persistFlag(params: {
  contentId?: string | null
  userId?: string | null
  url: string
  contentType?: string | null
  flag: ContentFlag
  userIp?: string | null
  scrapedText?: string | null
}): Promise<void> {
  try {
    const supabase = getAdminClient()

    await supabase.from("flagged_content").insert({
      content_id: params.contentId ?? null,
      user_id: params.userId ?? null,
      url: params.url,
      content_type: params.contentType ?? null,
      flag_source: params.flag.source,
      flag_reason: params.flag.reason,
      flag_categories: params.flag.categories,
      severity: params.flag.severity,
      user_ip: params.userIp ?? null,
      content_hash: params.scrapedText ? hashContent(params.scrapedText) : null,
      scraped_text_preview: params.scrapedText?.substring(0, 500) ?? null,
      status: "pending",
    })

    logger.info(
      `MODERATION: Content flagged [${params.flag.severity}] — ${params.flag.source}: ${params.flag.reason} — URL: ${params.url}`
    )
  } catch (error) {
    // Never fail silently on moderation logging — but also don't crash the request
    logger.error("MODERATION: Failed to persist flag:", error)
  }
}

// ============================================
// Combined screening entry point
// ============================================

/**
 * Runs all pre-AI screening checks on a URL and its scraped content.
 *
 * Call this after scraping but before sending content to the AI model.
 * Combines Layer 1 (URL screening) and Layer 2 (keyword screening),
 * persists all flags to the database, and returns a blocking decision.
 *
 * Content is blocked if any flag has `"critical"` or `"high"` severity.
 *
 * @param params - The URL, scraped text, and associated metadata
 * @returns A {@link ScreeningResult} with the blocking decision and all flags
 *
 * @example
 * ```ts
 * const screening = await screenContent({
 *   url: content.url,
 *   scrapedText: fullText,
 *   contentId: content.id,
 *   userId: user.id,
 * })
 * if (screening.blocked) {
 *   return NextResponse.json({ error: "Content policy violation" }, { status: 451 })
 * }
 * ```
 */
export async function screenContent(params: {
  url: string
  scrapedText?: string | null
  contentId?: string | null
  userId?: string | null
  contentType?: string | null
  userIp?: string | null
}): Promise<ScreeningResult> {
  const flags: ContentFlag[] = []

  // Layer 1: URL screening
  const urlFlag = screenUrl(params.url)
  if (urlFlag) flags.push(urlFlag)

  // Layer 2: Keyword pre-screening on scraped text
  if (params.scrapedText) {
    const textFlags = screenText(params.scrapedText)
    flags.push(...textFlags)
  }

  // Persist all flags
  for (const flag of flags) {
    await persistFlag({
      contentId: params.contentId,
      userId: params.userId,
      url: params.url,
      contentType: params.contentType,
      flag,
      userIp: params.userIp,
      scrapedText: params.scrapedText,
    })
  }

  // Block if any critical or high severity flags
  const blocked = flags.some(f => f.severity === "critical" || f.severity === "high")

  return { blocked, flags }
}

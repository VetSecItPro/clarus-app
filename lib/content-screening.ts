/**
 * Content moderation pre-screening.
 *
 * Three detection layers:
 *   1. URL screening — block known illegal content domains
 *   2. Keyword pre-screening — detect prohibited content patterns before AI
 *   3. AI refusal detection — catch CONTENT_REFUSED responses from AI
 *
 * When flagged, content is logged to the flagged_content table for admin review.
 * CSAM flags carry a legal reporting obligation under 18 U.S.C. § 2258A.
 */

import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { createHash } from "crypto"

// ============================================
// Types
// ============================================

export type FlagSeverity = "critical" | "high" | "medium"
export type FlagSource = "url_screening" | "keyword_screening" | "ai_refusal"
export type FlagCategory = "csam" | "terrorism" | "weapons" | "trafficking"
export type FlagStatus = "pending" | "reviewed" | "reported" | "dismissed"

export interface ContentFlag {
  source: FlagSource
  severity: FlagSeverity
  categories: FlagCategory[]
  reason: string
}

export interface ScreeningResult {
  blocked: boolean
  flags: ContentFlag[]
}

// ============================================
// URL Screening (Layer 1)
// ============================================

/**
 * Domains associated with illegal content distribution.
 * This list is intentionally sparse — it targets known vectors,
 * not a comprehensive blocklist. The AI refusal layer catches the rest.
 */
const BLOCKED_DOMAIN_PATTERNS: Array<{ pattern: RegExp; categories: FlagCategory[]; severity: FlagSeverity }> = [
  // Known CSAM distribution patterns (onion/darknet proxy domains)
  { pattern: /\.onion\./i, categories: ["csam", "trafficking"], severity: "critical" },
  // Paste sites frequently used for illegal content distribution
  { pattern: /(?:darknet|deepweb|hidden.wiki)/i, categories: ["csam", "trafficking"], severity: "critical" },
]

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
 * Check if an AI analysis section returned a CONTENT_REFUSED response.
 * The AI prompts are configured to return either:
 *   - JSON: {"refused": true, "reason": "..."}
 *   - Text: "CONTENT_REFUSED: ..."
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

export function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

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

    console.log(
      `MODERATION: Content flagged [${params.flag.severity}] — ${params.flag.source}: ${params.flag.reason} — URL: ${params.url}`
    )
  } catch (error) {
    // Never fail silently on moderation logging — but also don't crash the request
    console.error("MODERATION: Failed to persist flag:", error)
  }
}

// ============================================
// Combined screening entry point
// ============================================

/**
 * Run all pre-AI screening checks on a URL and its scraped content.
 * Call this after scraping but before sending to AI.
 *
 * Returns { blocked: true } if content should not be analyzed.
 * Flags are persisted to the database automatically.
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

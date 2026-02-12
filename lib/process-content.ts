/**
 * @module lib/process-content
 * @description Core content processing pipeline extracted from the API route.
 *
 * This module contains all the AI analysis logic for processing content:
 * - YouTube video metadata and transcript extraction
 * - Article scraping via Firecrawl
 * - Podcast transcription via AssemblyAI
 * - Web search context via Tavily
 * - AI-powered analysis sections via OpenRouter
 * - Cross-user content caching
 * - Domain credibility tracking
 * - Claim extraction for cross-referencing
 *
 * The main export is `processContent()` which can be called directly
 * by internal routes instead of making an HTTP fetch to /api/process-content.
 *
 * @see {@link app/api/process-content/route.ts} for the HTTP wrapper
 */

import { createClient } from "@supabase/supabase-js"
import type { Database, Json, Tables, TriageData, TruthCheckData, ActionItemsData } from "@/types/database.types"
import { logApiUsage, logProcessingMetrics, createTimer } from "@/lib/api-usage"
import { enforceAndIncrementUsage } from "@/lib/usage"
import { detectPaywallTruncation } from "@/lib/paywall-detection"
import { screenContent, detectAiRefusal, persistFlag } from "@/lib/content-screening"
import { submitPodcastTranscription } from "@/lib/assemblyai"
import { getLanguageDirective, type AnalysisLanguage } from "@/lib/languages"
import { TIER_FEATURES, normalizeTier } from "@/lib/tier-limits"
import { NonRetryableError, classifyError, getUserFriendlyError } from "@/lib/error-sanitizer"
import { normalizeUrl } from "@/lib/utils"
import { sanitizeForPrompt, wrapUserContent, INSTRUCTION_ANCHOR, detectOutputLeakage } from "@/lib/prompt-sanitizer"
import { parseAiResponseOrThrow } from "@/lib/ai-response-parser"
import { buildPreferenceBlock, type UserAnalysisPreferences } from "@/lib/build-preference-prompt"

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supadataApiKey = process.env.SUPADATA_API_KEY
const openRouterApiKey = process.env.OPENROUTER_API_KEY
const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
const tavilyApiKey = process.env.TAVILY_API_KEY
const assemblyAiApiKey = process.env.ASSEMBLYAI_API_KEY

// Timeout for individual AI API calls (2 minutes per call)
const AI_CALL_TIMEOUT_MS = 120000

// Timeout for external service calls (web search, scraping)
const TAVILY_TIMEOUT_MS = 15000
const FIRECRAWL_TIMEOUT_MS = 30000
const EXTRACT_TOPICS_TIMEOUT_MS = 10000

// Phase 1 (web search + tone + prefs) overall timeout
const PHASE1_TIMEOUT_MS = 20000

// Global pipeline timeout (4 minutes)
const PIPELINE_TIMEOUT_MS = 240000

// ============================================
// ERROR CLASS
// ============================================

/**
 * Custom error class for content processing failures.
 * Carries HTTP status code and optional upgrade/tier info.
 */
export class ProcessContentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly upgradeRequired?: boolean,
    public readonly tier?: string
  ) {
    super(message)
    this.name = "ProcessContentError"
  }
}

// ============================================
// INTERFACES
// ============================================

/**
 * Options for the processContent function.
 */
export interface ProcessContentOptions {
  /** The content ID to process (UUID) */
  contentId: string
  /** User ID for ownership verification. Null for internal/webhook calls. */
  userId: string | null
  /** Target language for analysis output */
  language?: AnalysisLanguage
  /** If true, regenerate even if content already has analysis */
  forceRegenerate?: boolean
  /** If true, skip scraping (used when full_text is already populated, e.g., PDFs) */
  skipScraping?: boolean
}

/**
 * Result returned by processContent on success.
 */
export interface ProcessContentResult {
  success: boolean
  cached: boolean
  contentId: string
  sectionsGenerated: string[]
  language: string
  message?: string
  transcriptId?: string
  paywallWarning?: string | null
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}

function getErrorName(error: unknown): string {
  if (error instanceof Error) return error.name
  return ""
}

// ============================================
// CONTENT METADATA BLOCK
// ============================================

/**
 * Formats a duration in seconds into a human-readable string.
 * Examples: 125 → "2m 5s", 7500 → "2h 5m", 45 → "45s"
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  return `${minutes}m`
}

/**
 * Formats a large number with K/M suffixes for readability.
 * Examples: 1200 → "1.2K", 3200000 → "3.2M", 500 → "500"
 */
function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return count.toString()
}

/**
 * Counts unique speakers in a podcast transcript.
 * Looks for AssemblyAI diarization format: "[MM:SS] Speaker A:" patterns.
 */
function countSpeakers(transcript: string): number {
  const speakerPattern = /\bSpeaker ([A-Z])\b/g
  const speakers = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = speakerPattern.exec(transcript)) !== null) {
    speakers.add(match[1])
  }
  return speakers.size
}

/**
 * Builds a rich metadata block string from the content row.
 *
 * This block is injected into AI prompts via the {{METADATA}} placeholder,
 * giving the model critical context about the content being analyzed:
 * creator credibility, content length/depth, engagement signals, etc.
 *
 * Per-type metadata:
 * - **YouTube:** title, channel, duration (formatted), views, likes, upload date, description excerpt
 * - **Podcast:** title, duration (formatted), speaker count (parsed from transcript)
 * - **Article:** title, source domain, description excerpt
 * - **X/Tweet:** title, platform label, short-form flag
 * - **PDF/Document:** title, source domain (if URL), document type hint
 */
function buildContentMetadataBlock(content: {
  type: string | null
  title: string | null
  author: string | null
  duration: number | null
  view_count: number | null
  like_count: number | null
  upload_date: string | null
  description: string | null
  url: string
  full_text: string | null
}): string {
  const lines: string[] = ["## Content Metadata"]
  const contentType = content.type || "article"

  // Human-readable type label
  const typeLabels: Record<string, string> = {
    youtube: "YouTube Video",
    podcast: "Podcast Episode",
    article: "Article",
    x_post: "X (Twitter) Post",
    pdf: "PDF Document",
    document: "Document",
  }
  lines.push(`- Type: ${typeLabels[contentType] || contentType}`)

  if (content.title) {
    lines.push(`- Title: ${content.title}`)
  }

  switch (contentType) {
    case "youtube": {
      if (content.author) lines.push(`- Channel: ${content.author}`)
      if (content.duration) {
        const formatted = formatDuration(content.duration)
        const lengthHint = content.duration > 1800 ? " (long-form)" : content.duration < 120 ? " (short-form)" : ""
        lines.push(`- Duration: ${formatted}${lengthHint}`)
      }
      if (content.view_count) {
        let engagementNote = ""
        if (content.like_count && content.view_count > 0) {
          const ratio = (content.like_count / content.view_count) * 100
          if (ratio > 5) engagementNote = " (high engagement)"
          else if (ratio > 2) engagementNote = " (good engagement)"
        }
        const viewStr = formatCount(content.view_count)
        const likeStr = content.like_count ? ` | Likes: ${formatCount(content.like_count)}` : ""
        lines.push(`- Views: ${viewStr}${likeStr}${engagementNote}`)
      }
      if (content.upload_date) lines.push(`- Published: ${content.upload_date}`)
      if (content.description) {
        const excerpt = content.description.length > 200
          ? content.description.substring(0, 200) + "..."
          : content.description
        lines.push(`- Description: ${excerpt}`)
      }
      break
    }
    case "podcast": {
      if (content.duration) {
        lines.push(`- Duration: ${formatDuration(content.duration)}`)
      }
      if (content.full_text) {
        const speakers = countSpeakers(content.full_text)
        if (speakers > 0) {
          const format = speakers === 1 ? "monologue" : speakers === 2 ? "interview/dialogue" : "panel discussion"
          lines.push(`- Speakers: ${speakers} (${format})`)
        }
      }
      break
    }
    case "article": {
      try {
        const domain = new URL(content.url).hostname.replace(/^www\./, "")
        lines.push(`- Source: ${domain}`)
      } catch { /* invalid URL, skip */ }
      if (content.description) {
        const excerpt = content.description.length > 200
          ? content.description.substring(0, 200) + "..."
          : content.description
        lines.push(`- Description: ${excerpt}`)
      }
      break
    }
    case "x_post": {
      lines.push(`- Format: Short-form social media post`)
      break
    }
    case "pdf":
    case "document": {
      try {
        const domain = new URL(content.url).hostname.replace(/^www\./, "")
        lines.push(`- Source: ${domain}`)
      } catch { /* invalid URL or file path, skip */ }
      break
    }
  }

  // Only return the block if we have more than just the type line
  if (lines.length <= 2) return ""
  return lines.join("\n")
}

// ============================================
// TYPE-SPECIFIC ANALYSIS INSTRUCTIONS
// ============================================

/**
 * Per-type instruction blocks that guide the AI on what to focus on
 * during analysis. These are injected via the {{TYPE_INSTRUCTIONS}}
 * placeholder in DB-stored prompt templates.
 *
 * Each content type gets domain-specific guidance:
 * - YouTube: timestamps, clickbait detection, creator credibility
 * - Podcast: speaker attribution, host/guest dynamics, disagreements
 * - Article: source credibility, primary sources, opinion vs fact
 * - X/Tweet: short-form depth adjustment, source verification
 * - PDF/Document: structured content, citation quality, purpose
 */
const TYPE_INSTRUCTIONS: Record<string, string[]> = {
  youtube: [
    "Reference timestamps in [MM:SS] format when citing specific claims or key moments.",
    "Compare the video title against the actual content — flag clickbait if the title is misleading.",
    "Note whether this is a conversation, interview, or monologue format.",
    "Consider creator credibility signals: channel size, engagement ratio, and track record.",
  ],
  podcast: [
    "Attribute claims to specific speakers (Speaker A, Speaker B, etc.) when identifiable.",
    "Note agreements and disagreements between speakers.",
    "Identify host vs. guest dynamics — who is being interviewed, who is the expert.",
    "Flag claims where speakers contradict each other.",
  ],
  article: [
    "Consider the publication source's credibility and potential editorial bias.",
    "Check whether the article cites primary sources vs. other articles or no sources at all.",
    "Flag opinion presented as fact — look for hedging language or lack thereof.",
    "Note the publication date — older articles may contain outdated information.",
    "If the content appears truncated, note the possible paywall limitation.",
  ],
  x_post: [
    "This is short-form content — adjust your analysis depth accordingly.",
    "Claims in tweets/posts are often unsourced — verify with extra scrutiny.",
    "Note whether this appears to be a standalone post or part of a thread.",
    "Be concise in your analysis — match the brevity of the content.",
  ],
  pdf: [
    "Expect structured content with sections, headers, and potentially references.",
    "Evaluate citation quality: peer-reviewed sources vs. no citations.",
    "Note the document's purpose: research paper, whitepaper, legal document, or manual.",
    "Prioritize the abstract/executive summary and conclusions for key takeaways.",
  ],
  music: [
    "This is music/entertainment content. Focus on describing the content rather than fact-checking.",
    "Skip action items — they are not applicable to music content.",
    "For triage, rate enjoyment and production value rather than informational value.",
    "Do not apply signal_noise_score for informational value — set to -1 to indicate not applicable.",
  ],
  entertainment: [
    "This is entertainment content. Focus on describing the content and its entertainment value.",
    "Fact-checking and action items are less applicable — only include if genuinely relevant.",
    "For triage, rate entertainment value and production quality rather than informational density.",
    "Adjust your analysis depth — entertainment content does not need the same rigor as news or research.",
  ],
}

/**
 * Builds type-specific analysis instructions based on content type and metadata.
 *
 * Returns a formatted instruction block that guides the AI on what to focus on
 * for this particular type of content. Includes conditional extras based on
 * metadata (e.g., long-form video instructions when duration > 30min).
 *
 * @param contentType - The content type (youtube, podcast, article, x_post, pdf, document)
 * @param metadata - Optional metadata for conditional instructions
 * @returns Formatted instruction block string, or empty string if no instructions for this type
 */
function buildTypeInstructions(
  contentType: string,
  metadata?: { duration?: number | null; speakerCount?: number }
): string {
  // Normalize document → pdf (same instruction set)
  const effectiveType = contentType === "document" ? "pdf" : contentType
  const baseInstructions = TYPE_INSTRUCTIONS[effectiveType]
  if (!baseInstructions) return ""

  const lines = [...baseInstructions]

  // Conditional extras based on metadata
  if (effectiveType === "youtube" && metadata?.duration) {
    if (metadata.duration > 1800) {
      lines.push("This is a long-form video (>30 min) — focus on key segments and note pacing issues.")
    } else if (metadata.duration < 60) {
      lines.push("This is a short-form video — the core claim is what matters. Short videos often oversimplify.")
    }
  }

  if (effectiveType === "podcast" && metadata?.speakerCount && metadata.speakerCount >= 2) {
    lines.push("For this interview/discussion: evaluate the quality of questions asked, not just answers given.")
  }

  return `## Type-Specific Analysis Instructions\n${lines.map(l => `- ${l}`).join("\n")}`
}

// ============================================
// WEB SEARCH INTEGRATION (Tavily)
// ============================================

interface WebSearchResult {
  query: string
  answer?: string
  results: Array<{
    title: string
    url: string
    content: string
  }>
}

interface WebSearchContext {
  searches: WebSearchResult[]
  formattedContext: string
  timestamp: string
  apiCallCount: number
  cacheHits: number
}

interface VerifiableClaim {
  claim: string
  search_query: string
}

interface ClaimSearchContext {
  claims: VerifiableClaim[]
  searches: WebSearchResult[]
  formattedContext: string
  apiCallCount: number
  cacheHits: number
}

interface TavilySearchResult {
  title: string
  url: string
  content?: string
}

interface TavilyApiResponse {
  answer?: string
  results?: TavilySearchResult[]
}

function normalizeTavilyQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[?.!,]+$/, "")
}

// Analysis prompts type
type AnalysisPrompt = Tables<"analysis_prompts">

// Cache for prompts with 5-minute TTL (safe as module-level — prompts are identical for all users)
let promptsCache: Map<string, AnalysisPrompt> | null = null
let promptsCacheTime = 0
const PROMPTS_CACHE_TTL_MS = 5 * 60 * 1000

async function fetchPromptFromDB(promptType: string): Promise<AnalysisPrompt | null> {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase not configured for prompt fetch")
    return null
  }

  // Invalidate stale cache
  if (promptsCache && Date.now() - promptsCacheTime > PROMPTS_CACHE_TTL_MS) {
    promptsCache = null
  }

  if (promptsCache?.has(promptType)) {
    return promptsCache.get(promptType) || null
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey, { db: { schema: "clarus" } })

  const { data, error } = await supabaseAdmin
    .from("analysis_prompts")
    .select("id, prompt_type, name, description, system_content, user_content_template, model_name, temperature, max_tokens, expect_json, is_active, use_web_search, created_at, updated_at")
    .eq("prompt_type", promptType)
    .eq("is_active", true)
    .single()

  if (error || !data) {
    console.error(`Failed to fetch prompt ${promptType}:`, error?.message)
    return null
  }

  if (!promptsCache) {
    promptsCache = new Map()
    promptsCacheTime = Date.now()
  }
  promptsCache.set(promptType, data)

  return data
}

async function extractKeyTopics(text: string, maxTopics: number = 3): Promise<string[]> {
  if (!openRouterApiKey) return []

  const prompt = await fetchPromptFromDB("keyword_extraction")
  if (!prompt) return []

  const truncatedText = text.substring(0, 5000)
  const sanitizedText = sanitizeForPrompt(truncatedText, { context: "keyword-extraction" })
  const userContent = prompt.user_content_template.replace("{{CONTENT}}", wrapUserContent(sanitizedText)) + INSTRUCTION_ANCHOR

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), EXTRACT_TOPICS_TIMEOUT_MS)

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: prompt.model_name,
        messages: [
          { role: "system", content: prompt.system_content },
          { role: "user", content: userContent }
        ],
        temperature: prompt.temperature,
        max_tokens: prompt.max_tokens,
        response_format: { type: "json_object" }
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn("API: Topic extraction failed, skipping web search")
      return []
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return []

    const parsed = parseAiResponseOrThrow<Record<string, unknown> | unknown[]>(content, "keyword_extraction")
    const rawTopics: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as Record<string, unknown>).queries)
        ? (parsed as Record<string, unknown>).queries as unknown[]
        : Array.isArray((parsed as Record<string, unknown>).topics)
          ? (parsed as Record<string, unknown>).topics as unknown[]
          : []

    return rawTopics.slice(0, maxTopics).filter((t: unknown): t is string => typeof t === 'string' && t.length > 2)
  } catch (error) {
    console.warn("API: Topic extraction error:", error)
    return []
  }
}

function deduplicateTopics(topics: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const topic of topics) {
    const normalized = normalizeTavilyQuery(topic)
    if (!seen.has(normalized)) {
      seen.add(normalized)
      unique.push(topic)
    }
  }
  return unique
}

async function extractVerifiableClaims(text: string, maxClaims = 5): Promise<VerifiableClaim[]> {
  if (!openRouterApiKey) return []

  // S1-04: Empty content guard — no point extracting claims from near-empty text
  if (!text || text.trim().length < 100) return []

  // S1-06: Reduce input from 15K to 10K — claims appear in first half of content
  const truncatedText = text.substring(0, 10000)
  const sanitizedText = sanitizeForPrompt(truncatedText, { context: "claim-extraction" })

  const systemPrompt = `You are a fact-checking assistant. Extract specific, verifiable factual claims from content that can be checked against current web sources. Focus on claims that may be time-sensitive or have changed recently.`

  // S1-10: Explicit instruction to generate English search queries regardless of content language
  const userPrompt = `Extract up to ${maxClaims} specific verifiable factual claims from this content. For each claim, provide a targeted web search query that would verify or refute it.

IMPORTANT: Generate all search queries in English, even if the content is in another language. English queries produce better web search results.

Focus on:
- Version numbers and release dates (e.g., "Product X version 2.0 was released")
- Statistics and figures (e.g., "85% of users prefer X")
- Health and medical claims (e.g., "X reduces risk of Y by Z%")
- Financial claims (e.g., "Company X revenue grew Z% year-over-year")
- Scientific findings (e.g., "Study shows correlation between X and Y")
- Product availability and features (e.g., "Service X now supports Y")
- Recent events and announcements (e.g., "Company acquired Z")
- Pricing and technical specifications

Skip:
- Opinions and subjective statements
- Common knowledge facts that rarely change
- Predictions about the future
- The author's personal experiences

Return JSON: { "claims": [{ "claim": "exact claim text", "search_query": "targeted search query to verify this claim in ${new Date().getFullYear()}" }] }

${INSTRUCTION_ANCHOR}
Content:
${wrapUserContent(sanitizedText)}`

  const timer = createTimer()
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      console.warn("API: Claim extraction failed, skipping targeted verification")
      await logApiUsage({
        apiName: "openrouter",
        operation: "claim_extraction",
        responseTimeMs: timer.elapsed(),
        status: "error",
        errorMessage: `HTTP ${response.status}`,
      })
      return []
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return []

    // S1-08: Check for AI refusal before parsing
    if (detectAiRefusal(content)) {
      console.warn("API: Claim extraction refused by model (content safety)")
      await logApiUsage({
        apiName: "openrouter",
        operation: "claim_extraction",
        tokensInput: data.usage?.prompt_tokens || 0,
        tokensOutput: data.usage?.completion_tokens || 0,
        responseTimeMs: timer.elapsed(),
        status: "error",
        errorMessage: "AI refusal detected",
      })
      return []
    }

    // S1-07: Log token counts for cost tracking
    await logApiUsage({
      apiName: "openrouter",
      operation: "claim_extraction",
      tokensInput: data.usage?.prompt_tokens || 0,
      tokensOutput: data.usage?.completion_tokens || 0,
      modelName: "google/gemini-2.5-flash-lite",
      responseTimeMs: timer.elapsed(),
      status: "success",
    })

    const parsed = parseAiResponseOrThrow<Record<string, unknown>>(content, "claim_extraction")
    const rawClaims = Array.isArray(parsed) ? parsed : Array.isArray((parsed as Record<string, unknown>).claims) ? (parsed as Record<string, unknown>).claims as unknown[] : []

    return rawClaims
      .slice(0, maxClaims)
      .filter((c): c is Record<string, string> =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).claim === "string" &&
        typeof (c as Record<string, unknown>).search_query === "string"
      )
      .map((c) => ({
        claim: c.claim,
        search_query: c.search_query,
      }))
  } catch (error) {
    console.warn("API: Claim extraction error:", error)
    return []
  }
}

async function searchTavily(query: string, tavilyCache: Map<string, WebSearchResult>, maxRetries = 2): Promise<WebSearchResult | null> {
  if (!tavilyApiKey) return null

  const cacheKey = normalizeTavilyQuery(query)
  if (tavilyCache.has(cacheKey)) {
    return tavilyCache.get(cacheKey) ?? null
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const timer = createTimer()
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS)

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query,
          search_depth: "basic",
          include_answer: true,
          include_raw_content: false,
          max_results: 3,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (attempt < maxRetries && (response.status >= 500 || response.status === 429)) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 4000)
          console.warn(`API: Tavily search failed for "${query}" (HTTP ${response.status}), retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        console.warn(`API: Tavily search failed for "${query}" after ${attempt + 1} attempt(s)`)
        await logApiUsage({
          apiName: "tavily",
          operation: "search",
          responseTimeMs: timer.elapsed(),
          status: "error",
          errorMessage: `HTTP ${response.status}`,
        })
        return null
      }

      const data = await response.json()

      await logApiUsage({
        apiName: "tavily",
        operation: "search",
        responseTimeMs: timer.elapsed(),
        status: "success",
        metadata: { query, resultsCount: data.results?.length || 0, attempts: attempt + 1 },
      })

      const result: WebSearchResult = {
        query,
        answer: data.answer,
        results: ((data as TavilyApiResponse).results || []).slice(0, 3).map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content?.substring(0, 500) || "",
        })),
      }

      tavilyCache.set(cacheKey, result)

      return result
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 4000)
        console.warn(`API: Tavily search error for "${query}" (attempt ${attempt + 1}), retrying in ${delay}ms...`, error)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      console.warn(`API: Tavily search error for "${query}" after ${attempt + 1} attempt(s):`, error)
      return null
    }
  }
  return null
}

function formatWebContext(searches: WebSearchResult[]): string {
  const lines: string[] = [
    "\n\n---",
    "## REAL-TIME WEB VERIFICATION CONTEXT",
    "The following information was retrieved from web searches to help verify claims:",
    ""
  ]

  for (const search of searches) {
    lines.push(`### Search: "${search.query}"`)
    if (search.answer) {
      lines.push(`**Summary:** ${search.answer}`)
    }
    for (const result of search.results) {
      lines.push(`- [${result.title}](${result.url})`)
      if (result.content) {
        lines.push(`  ${result.content.substring(0, 200)}...`)
      }
    }
    lines.push("")
  }

  lines.push("---")
  lines.push("Use this web context to verify claims. If something conflicts with web results, note the discrepancy.")
  lines.push("")

  return lines.join("\n")
}

async function getWebSearchContext(text: string, _contentTitle: string | undefined, tavilyCache: Map<string, WebSearchResult>): Promise<WebSearchContext | null> {
  if (!tavilyApiKey) {
    return null
  }

  // Dynamic topic count: short content needs fewer web searches
  const maxTopics = text.length < 500 ? 1 :    // tweets: 1 search
                    text.length < 2000 ? 2 :    // short articles: 2 searches
                    3                            // long content: 3 searches

  const rawTopics = await extractKeyTopics(text, maxTopics)

  if (rawTopics.length === 0) {
    return null
  }

  const topics = deduplicateTopics(rawTopics)

  // Count cache hits BEFORE searching (accurate hit count, not dedup count)
  let cacheHits = 0
  for (const topic of topics) {
    if (tavilyCache.has(normalizeTavilyQuery(topic))) cacheHits++
  }

  const searchPromises = topics.map(topic => searchTavily(topic, tavilyCache))
  const results = await Promise.all(searchPromises)

  const validResults = results.filter((r): r is WebSearchResult => r !== null && r.results.length > 0)

  if (validResults.length === 0) {
    return null
  }

  const formattedContext = formatWebContext(validResults)

  const apiCallCount = topics.length - cacheHits

  return {
    searches: validResults,
    formattedContext,
    timestamp: new Date().toISOString(),
    apiCallCount,
    cacheHits,
  }
}

// ============================================
// TARGETED CLAIM VERIFICATION (Tavily)
// ============================================

function formatClaimContext(claims: VerifiableClaim[], searches: WebSearchResult[]): string {
  const lines: string[] = [
    "\n\n---",
    "## TARGETED CLAIM VERIFICATION RESULTS",
    "CRITICAL: These search results reflect CURRENT real-time information as of today.",
    "If these web results contradict your training data, ALWAYS trust these web search results over your training data.",
    "Your training data may be outdated. The web results below are fresh and authoritative.",
    ""
  ]

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i]
    const search = searches[i]

    lines.push(`### Claim: "${claim.claim}"`)
    lines.push(`**Search Query:** "${claim.search_query}"`)

    if (search && search.results.length > 0) {
      if (search.answer) {
        lines.push(`**Web Answer:** ${search.answer}`)
      }
      for (const result of search.results) {
        lines.push(`- [${result.title}](${result.url})`)
        if (result.content) {
          lines.push(`  ${result.content.substring(0, 300)}`)
        }
      }
    } else {
      lines.push("_No web results found for this claim._")
    }
    lines.push("")
  }

  lines.push("---")
  lines.push("Use the claim verification results above to check the accuracy of ALL claims in the content.")
  lines.push("If a claim is contradicted by these web results, mark it as inaccurate and cite the web source.")
  lines.push("")

  return lines.join("\n")
}

async function getClaimSearchContext(text: string, tavilyCache: Map<string, WebSearchResult>): Promise<ClaimSearchContext | null> {
  if (!tavilyApiKey || !openRouterApiKey) return null

  // S1-05: Dynamic claim count based on content length
  const maxClaims = text.length < 500 ? 0 :       // tweets: skip entirely
                    text.length < 2000 ? 2 :       // short articles
                    text.length < 8000 ? 3 :       // medium articles
                    5                               // long content
  if (maxClaims === 0) return null

  const claims = await extractVerifiableClaims(text, maxClaims)
  if (claims.length === 0) return null

  // Count cache hits BEFORE searching (accurate hit count)
  let cacheHits = 0
  for (const c of claims) {
    if (tavilyCache.has(normalizeTavilyQuery(c.search_query))) cacheHits++
  }

  const searchPromises = claims.map(c => searchTavily(c.search_query, tavilyCache))
  const results = await Promise.all(searchPromises)

  const validSearches: WebSearchResult[] = []
  const matchedClaims: VerifiableClaim[] = []

  for (let i = 0; i < claims.length; i++) {
    const search = results[i]
    if (search) {
      validSearches.push(search)
      matchedClaims.push(claims[i])
    }
  }

  if (validSearches.length === 0) return null

  const formattedContext = formatClaimContext(matchedClaims, validSearches)

  return {
    claims: matchedClaims,
    searches: validSearches,
    formattedContext,
    apiCallCount: claims.length - cacheHits,
    cacheHits,
  }
}

// ============================================
// TONE DETECTION
// ============================================

const NEUTRAL_TONE_DIRECTIVE = "The content uses a standard informational tone. Write your analysis in a clear, neutral voice."
const NEUTRAL_TONE_LABEL = "neutral"

interface ToneDetectionResult {
  tone_label: string
  tone_directive: string
}

async function detectContentTone(
  fullText: string,
  contentTitle: string | null,
  contentType: string,
  userId?: string | null,
  contentId?: string | null,
): Promise<ToneDetectionResult> {
  if (!openRouterApiKey) {
    return { tone_label: NEUTRAL_TONE_LABEL, tone_directive: NEUTRAL_TONE_DIRECTIVE }
  }

  const prompt = await fetchPromptFromDB("tone_detection")
  if (!prompt) {
    return { tone_label: NEUTRAL_TONE_LABEL, tone_directive: NEUTRAL_TONE_DIRECTIVE }
  }

  const timer = createTimer()
  // 3-segment sampling: first 2K + middle 1K + last 1K = ~4K total.
  // Catches tone shifts that single-segment sampling misses (formal intro, sarcastic body, etc.)
  const segments: string[] = [fullText.substring(0, 2000)]
  if (fullText.length > 6000) {
    const mid = Math.floor(fullText.length / 2)
    segments.push(fullText.substring(mid - 500, mid + 500))
  }
  if (fullText.length > 4000) {
    segments.push(fullText.substring(fullText.length - 1000))
  }
  const sample = segments.join("\n\n---\n\n")
  const sanitizedSample = sanitizeForPrompt(sample, { context: "tone-detection" })
  const sanitizedTitle = contentTitle ? sanitizeForPrompt(contentTitle, { context: "tone-detection-title", maxLength: 500 }) : ""
  const titleLine = sanitizedTitle ? `Title: ${sanitizedTitle}\n` : ""
  const userContent = prompt.user_content_template
    .replace("{{TITLE_LINE}}", titleLine)
    .replace("{{TYPE}}", contentType)
    .replace("{{CONTENT}}", wrapUserContent(sanitizedSample)) + INSTRUCTION_ANCHOR

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clarusapp.io",
        "X-Title": "Clarus",
      },
      body: JSON.stringify({
        model: prompt.model_name,
        messages: [
          { role: "system", content: prompt.system_content },
          { role: "user", content: userContent },
        ],
        temperature: prompt.temperature,
        max_tokens: prompt.max_tokens,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`API: [tone_detection] HTTP ${response.status}`)
      return { tone_label: NEUTRAL_TONE_LABEL, tone_directive: NEUTRAL_TONE_DIRECTIVE }
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content
    const usage = data.usage || {}

    if (!rawContent) {
      return { tone_label: NEUTRAL_TONE_LABEL, tone_directive: NEUTRAL_TONE_DIRECTIVE }
    }

    logApiUsage({
      userId,
      contentId,
      apiName: "openrouter",
      operation: "tone_detection",
      tokensInput: usage.prompt_tokens || 0,
      tokensOutput: usage.completion_tokens || 0,
      modelName: prompt.model_name,
      responseTimeMs: timer.elapsed(),
      status: "success",
      metadata: { section: "tone_detection" },
    })

    const parsed = parseAiResponseOrThrow<Record<string, unknown>>(rawContent, "tone_detection")
    const toneLabel = typeof parsed.tone_label === "string" ? parsed.tone_label.trim() : NEUTRAL_TONE_LABEL
    const toneDirective = typeof parsed.tone_directive === "string" ? parsed.tone_directive.trim() : NEUTRAL_TONE_DIRECTIVE

    if (!toneLabel || !toneDirective) {
      return { tone_label: NEUTRAL_TONE_LABEL, tone_directive: NEUTRAL_TONE_DIRECTIVE }
    }

    return { tone_label: toneLabel, tone_directive: toneDirective }
  } catch (error: unknown) {
    const msg = getErrorMessage(error)
    console.warn(`API: [tone_detection] Failed (non-fatal): ${msg}`)

    logApiUsage({
      userId,
      contentId,
      apiName: "openrouter",
      operation: "tone_detection",
      modelName: prompt.model_name,
      responseTimeMs: timer.elapsed(),
      status: "error",
      errorMessage: msg,
      metadata: { section: "tone_detection" },
    })

    return { tone_label: NEUTRAL_TONE_LABEL, tone_directive: NEUTRAL_TONE_DIRECTIVE }
  }
}

// ============================================
// YOUTUBE FUNCTIONS
// ============================================

interface SupadataYouTubeResponse {
  id: string
  title: string
  description: string
  duration: number
  channel: {
    id: string
    name: string
  }
  tags: string[]
  thumbnail: string
  uploadDate: string
  viewCount: number
  likeCount: number
  transcriptLanguages: string[]
}

interface ProcessedYouTubeMetadata {
  title: string | null
  author: string | null
  duration: number | null
  thumbnail_url: string | null
  description: string | null
  upload_date: string | null
  view_count: number | null
  like_count: number | null
  channel_id: string | null
  transcript_languages: string[] | null
  raw_youtube_metadata: Json | null
}

async function getYouTubeMetadata(url: string, apiKey: string, userId?: string | null, contentId?: string | null): Promise<ProcessedYouTubeMetadata> {
  const endpoint = `https://api.supadata.ai/v1/youtube/video?id=${encodeURIComponent(url)}`
  const retries = 3
  const delay = 1000
  const timer = createTimer()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      const response = await fetch(endpoint, {
        headers: { "x-api-key": apiKey },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.ok) {
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const errorText = await response.text()
          console.error(`Metadata API error: Expected JSON, got ${contentType}. Response: ${errorText}`)
          throw new NonRetryableError("Video metadata response was invalid")
        }
        const data: SupadataYouTubeResponse = await response.json()

        logApiUsage({
          userId,
          contentId,
          apiName: "supadata",
          operation: "metadata",
          responseTimeMs: timer.elapsed(),
          status: "success",
        })

        return {
          title: data.title,
          author: data.channel?.name,
          duration: data.duration,
          thumbnail_url: data.thumbnail,
          description: data.description,
          upload_date: data.uploadDate,
          view_count: data.viewCount,
          like_count: data.likeCount,
          channel_id: data.channel?.id,
          transcript_languages: data.transcriptLanguages,
          raw_youtube_metadata: data as unknown as Json,
        }
      }

      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text()
        console.error(`Metadata API error (${response.status}) for content ${url}: ${errorText.substring(0, 200)}`)
        throw new NonRetryableError("Video metadata could not be retrieved")
      }

      const errorText = await response.text()
      console.warn(
        `Supadata Metadata API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
          delay / 1000
        }s...`,
      )
    } catch (error: unknown) {
      if (error instanceof NonRetryableError) {
        throw error
      }
      const msg = getErrorMessage(error)
      console.warn(
        `Metadata API attempt ${attempt} failed for ${url}: ${msg}. Retrying in ${
          delay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, delay))
    }
  }

  console.error(`Metadata API failed for ${url} after ${retries} attempts`)

  logApiUsage({
    userId,
    contentId,
    apiName: "supadata",
    operation: "metadata",
    responseTimeMs: timer.elapsed(),
    status: "error",
    errorMessage: `Metadata fetch failed after ${retries} attempts`,
  })

  throw new Error("Video metadata unavailable after multiple attempts")
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

async function getYouTubeTranscript(url: string, apiKey: string, userId?: string | null, contentId?: string | null): Promise<{ full_text: string | null }> {
  const endpoint = `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}`
  const retries = 3
  const timer = createTimer()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)
      const response = await fetch(endpoint, {
        headers: { "x-api-key": apiKey },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.ok) {
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const errorText = await response.text()
          console.error(`Transcript API error: Expected JSON, got ${contentType}. Response: ${errorText}`)
          throw new NonRetryableError("Video transcript response was invalid")
        }
        const data = await response.json()

        if (Array.isArray(data.content)) {
          const INTERVAL_MS = 30000
          const groupedChunks: { timestamp: number; texts: string[] }[] = []

          for (const chunk of data.content as { text: string; offset: number }[]) {
            const intervalStart = Math.floor(chunk.offset / INTERVAL_MS) * INTERVAL_MS

            let group = groupedChunks.find(g => g.timestamp === intervalStart)
            if (!group) {
              group = { timestamp: intervalStart, texts: [] }
              groupedChunks.push(group)
            }
            group.texts.push(chunk.text)
          }

          groupedChunks.sort((a, b) => a.timestamp - b.timestamp)
          const formattedText = groupedChunks
            .map(group => {
              const timestamp = formatTimestamp(group.timestamp)
              const combinedText = group.texts.join(' ')
              return `[${timestamp}] ${combinedText}`
            })
            .join('\n\n')

          logApiUsage({
            userId,
            contentId,
            apiName: "supadata",
            operation: "transcript",
            responseTimeMs: timer.elapsed(),
            status: "success",
          })

          return { full_text: formattedText }
        }

        logApiUsage({
          userId,
          contentId,
          apiName: "supadata",
          operation: "transcript",
          responseTimeMs: timer.elapsed(),
          status: "success",
        })

        return { full_text: data.content }
      }

      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text()
        console.error(`Transcript API error (${response.status}) for content ${url}: ${errorText.substring(0, 200)}`)
        throw new NonRetryableError("Video transcript could not be retrieved")
      }

      const errorText = await response.text()
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      console.warn(
        `Supadata Transcript API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
          retryDelay / 1000
        }s...`,
      )
    } catch (error: unknown) {
      if (error instanceof NonRetryableError) {
        throw error
      }
      const msg = getErrorMessage(error)
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      console.warn(
        `Transcript API attempt ${attempt} failed for ${url}: ${msg}. Retrying in ${
          retryDelay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      await new Promise((res) => setTimeout(res, retryDelay))
    }
  }

  console.error(`Transcript API failed for ${url} after ${retries} attempts`)

  logApiUsage({
    userId,
    contentId,
    apiName: "supadata",
    operation: "transcript",
    responseTimeMs: timer.elapsed(),
    status: "error",
    errorMessage: `Transcript fetch failed after ${retries} attempts`,
  })

  throw new Error("Video transcript unavailable after multiple attempts")
}

// ============================================
// ARTICLE SCRAPING
// ============================================

interface ScrapedArticleData {
  title: string | null
  full_text: string | null
  description: string | null
  thumbnail_url: string | null
}

async function scrapeArticle(url: string, apiKey: string, userId?: string | null, contentId?: string | null): Promise<ScrapedArticleData> {
  const endpoint = "https://api.firecrawl.dev/v0/scrape"
  const retries = 3
  const timer = createTimer()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS)

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: url,
          pageOptions: {
            onlyMainContent: true,
          },
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          logApiUsage({
            userId,
            contentId,
            apiName: "firecrawl",
            operation: "scrape",
            responseTimeMs: timer.elapsed(),
            status: "success",
          })

          return {
            title: result.data.metadata?.title || null,
            full_text: result.data.markdown || result.data.content || null,
            description: result.data.metadata?.description || null,
            thumbnail_url: result.data.metadata?.ogImage || null,
          }
        } else {
          console.error("Scrape API indicated failure:", result.error)
          throw new NonRetryableError("Article content could not be extracted")
        }
      }

      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text()
        console.error(`Scrape API error (${response.status}) for content ${url}: ${errorText.substring(0, 200)}`)
        throw new NonRetryableError("Article content could not be retrieved")
      }

      const errorText = await response.text()
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      console.warn(
        `FireCrawl API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
          retryDelay / 1000
        }s...`,
      )
    } catch (error: unknown) {
      if (error instanceof NonRetryableError) {
        throw error
      }
      const msg = getErrorMessage(error)
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      console.warn(
        `Scrape API attempt ${attempt} failed for ${url}: ${msg}. Retrying in ${
          retryDelay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      await new Promise((res) => setTimeout(res, retryDelay))
    }
  }

  console.error(`Scrape API failed for ${url} after ${retries} attempts`)

  logApiUsage({
    userId,
    contentId,
    apiName: "firecrawl",
    operation: "scrape",
    responseTimeMs: timer.elapsed(),
    status: "error",
    errorMessage: `Scrape failed after ${retries} attempts`,
  })

  throw new Error("Article content unavailable after multiple attempts")
}

// ============================================
// SUMMARIZER
// ============================================

interface ModelSummary {
  mid_length_summary: string | null
  title?: string | null
}

interface ModelProcessingError {
  error: true
  modelName: string
  reason: string
  finalErrorMessage?: string
}

interface OpenRouterRequestBody {
  model: string
  messages: Array<{ role: string; content: string }>
  response_format?: { type: string }
  temperature?: number
  top_p?: number
  max_tokens?: number
}

interface ParsedModelSummaryResponse {
  mid_length_summary?: string
  title?: string
}

async function getModelSummary(
  textToSummarize: string,
  options: { shouldExtractTitle?: boolean; toneDirective?: string | null; languageDirective?: string | null; metadataBlock?: string | null; typeInstructions?: string | null; contentType?: string } = {},
): Promise<ModelSummary | ModelProcessingError> {
  const { shouldExtractTitle = false, toneDirective, languageDirective, metadataBlock, typeInstructions, contentType } = options

  if (!openRouterApiKey) {
    const msg = "OpenRouter API key is not configured."
    console.error(msg)
    return { error: true, modelName: "N/A", reason: "ClientNotInitialized", finalErrorMessage: msg }
  }
  if (!supabaseUrl || !supabaseKey) {
    const msg = "Supabase URL or Key not configured for fetching prompt in getModelSummary."
    console.error(msg)
    return { error: true, modelName: "N/A", reason: "ClientNotInitialized", finalErrorMessage: msg }
  }
  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey, { db: { schema: "clarus" } })

  const { data: promptData, error: promptError } = await supabaseAdmin
    .from("active_summarizer_prompt")
    .select("system_content, user_content_template, temperature, top_p, max_tokens, model_name")
    .eq("id", 1)
    .single()

  if (promptError || !promptData) {
    const msg = `Failed to fetch summarizer prompt from DB: ${promptError?.message}`
    console.error(msg)
    return { error: true, modelName: "N/A", reason: "PromptFetchFailed", finalErrorMessage: msg }
  }

  const { system_content, user_content_template, temperature, top_p, max_tokens, model_name } = promptData

  const openRouterModelId = model_name || "google/gemini-2.5-flash"
  const sanitizedSummaryText = sanitizeForPrompt(textToSummarize, { context: "summarizer" })
  const finalUserPrompt = (user_content_template || "{{TEXT_TO_SUMMARIZE}}")
    .replace("{{TONE}}", toneDirective || NEUTRAL_TONE_DIRECTIVE)
    .replace("{{LANGUAGE}}", languageDirective || "Write your analysis in English.")
    .replace("{{TYPE}}", contentType || "article")
    .replace("{{METADATA}}", metadataBlock || "")
    .replace("{{TYPE_INSTRUCTIONS}}", typeInstructions || "")
    .replace("{{TEXT_TO_SUMMARIZE}}", wrapUserContent(sanitizedSummaryText)) + INSTRUCTION_ANCHOR

  const requestBody: OpenRouterRequestBody = {
    model: openRouterModelId,
    messages: [
      { role: "system", content: system_content || "" },
      { role: "user", content: finalUserPrompt },
    ],
    response_format: { type: "json_object" },
  }

  if (temperature !== null) requestBody.temperature = temperature
  if (top_p !== null) requestBody.top_p = top_p
  if (max_tokens !== null) requestBody.max_tokens = max_tokens

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), AI_CALL_TIMEOUT_MS)

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clarusapp.io",
        "X-Title": "Clarus",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorBody = await response.text()
      const errorMessage = `OpenRouter API Error (${response.status}): ${errorBody}`
      console.error(errorMessage)
      return {
        error: true,
        modelName: openRouterModelId,
        reason: `APIError_${response.status}`,
        finalErrorMessage: errorMessage,
      }
    }

    const result = await response.json()
    const rawContent = result.choices[0]?.message?.content

    if (!rawContent) {
      const errorMessage = "OpenRouter response missing message content."
      console.error(errorMessage, result)
      return { error: true, modelName: openRouterModelId, reason: "InvalidResponse", finalErrorMessage: errorMessage }
    }

    if (typeof rawContent === "string") {
      detectOutputLeakage(rawContent, "summarizer")
    }

    let parsedContent: ParsedModelSummaryResponse
    try {
      parsedContent = parseAiResponseOrThrow<ParsedModelSummaryResponse>(rawContent, "summarizer")
    } catch (parseError: unknown) {
      const errorMessage = `Failed to parse JSON from model response. Error: ${getErrorMessage(parseError)}`
      console.error(errorMessage, "Raw content was:", rawContent)
      return { error: true, modelName: openRouterModelId, reason: "JSONParseFailed", finalErrorMessage: errorMessage }
    }

    const summary: ModelSummary = {
      mid_length_summary: parsedContent.mid_length_summary || null,
    }
    if (shouldExtractTitle) {
      summary.title = parsedContent.title || null
    }

    return summary
  } catch (error: unknown) {
    const isTimeout = getErrorName(error) === "AbortError"
    const msg = getErrorMessage(error)
    console.error(`Failed to process summary with OpenRouter: ${isTimeout ? "Request timed out" : msg}`)
    return {
      error: true,
      modelName: openRouterModelId,
      reason: isTimeout ? "Timeout" : "RequestFailed",
      finalErrorMessage: isTimeout ? "Request timed out after 2 minutes" : msg,
    }
  }
}

// ============================================
// SECTION GENERATION
// ============================================

interface SectionGenerationResult {
  content: unknown
  error?: string
}

async function generateSectionWithAI(
  textToAnalyze: string,
  promptType: string,
  contentType?: string,
  maxRetries: number = 3,
  userId?: string | null,
  contentId?: string | null,
  webContext?: string | null,
  toneDirective?: string | null,
  languageDirective?: string | null,
  preferencesBlock?: string | null,
  metadataBlock?: string | null,
  typeInstructions?: string | null,
): Promise<SectionGenerationResult> {
  if (!openRouterApiKey) {
    return { content: null, error: "OpenRouter API key not configured" }
  }

  const prompt = await fetchPromptFromDB(promptType)
  if (!prompt) {
    return { content: null, error: `Prompt not found for type: ${promptType}` }
  }

  const sanitizedContent = sanitizeForPrompt(textToAnalyze, { context: `analysis-${promptType}` })

  let userContent = prompt.user_content_template
    .replace("{{TONE}}", toneDirective || NEUTRAL_TONE_DIRECTIVE)
    .replace("{{LANGUAGE}}", languageDirective || "Write your analysis in English.")
    .replace("{{USER_PREFERENCES}}", preferencesBlock || "")
    .replace("{{METADATA}}", metadataBlock || "")
    .replace("{{TYPE_INSTRUCTIONS}}", typeInstructions || "")
    .replace("{{CONTENT}}", wrapUserContent(sanitizedContent))
    .replace("{{TYPE}}", contentType || "article")

  const useWebSearch = prompt.use_web_search !== false
  if (webContext && useWebSearch) {
    userContent = userContent + webContext
  }

  userContent = userContent + INSTRUCTION_ANCHOR

  const requestBody: OpenRouterRequestBody = {
    model: prompt.model_name,
    messages: [
      { role: "system", content: prompt.system_content },
      { role: "user", content: userContent },
    ],
  }

  if (prompt.temperature !== null) requestBody.temperature = prompt.temperature
  if (prompt.max_tokens !== null) requestBody.max_tokens = prompt.max_tokens
  if (prompt.expect_json) requestBody.response_format = { type: "json_object" }

  let lastError: string = ""
  let retryCount = 0
  const timer = createTimer()

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptTimer = createTimer()
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), AI_CALL_TIMEOUT_MS)

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://clarusapp.io",
          "X-Title": "Clarus",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text()
        console.warn(`API: [${promptType}] Attempt ${attempt} failed: HTTP ${response.status} — ${errorBody.substring(0, 200)}`)
        lastError = "AI analysis service returned an error"
        retryCount++

        // 429 = rate limited — retry with longer backoff
        if (response.status === 429) {
          if (attempt < maxRetries) {
            const delay = 10000 * Math.pow(2, attempt - 1)
            console.warn(`API: [${promptType}] Rate limited (429), retrying in ${delay / 1000}s...`)
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
          continue
        }

        // Other 4xx = client error, no retry (400 bad request, 401 auth, 403 forbidden, 404 not found)
        if (response.status >= 400 && response.status < 500) {
          return { content: null, error: lastError }
        }

        // 5xx = server error, retry with standard backoff
        if (attempt < maxRetries) {
          const delay = 5000 * Math.pow(2, attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
        continue
      }

      const result = await response.json()
      const rawContent = result.choices[0]?.message?.content
      const usage = result.usage || {}

      if (!rawContent) {
        lastError = "No content in API response"
        console.warn(`API: [${promptType}] Attempt ${attempt} failed: ${lastError}`)
        if (attempt < maxRetries) {
          const delay = 5000 * Math.pow(2, attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
        continue
      }

      if (typeof rawContent === "string") {
        detectOutputLeakage(rawContent, promptType)
      }

      if (prompt.expect_json) {
        try {
          const parsedContent = parseAiResponseOrThrow<unknown>(rawContent, promptType)

          logApiUsage({
            userId,
            contentId,
            apiName: "openrouter",
            operation: "analyze",
            tokensInput: usage.prompt_tokens || 0,
            tokensOutput: usage.completion_tokens || 0,
            modelName: prompt.model_name,
            responseTimeMs: attemptTimer.elapsed(),
            status: "success",
          })
          logProcessingMetrics({
            contentId: contentId || undefined,
            userId,
            sectionType: promptType,
            modelName: prompt.model_name,
            tokensInput: usage.prompt_tokens || 0,
            tokensOutput: usage.completion_tokens || 0,
            processingTimeMs: attemptTimer.elapsed(),
            retryCount,
            status: "success",
          })

          return { content: parsedContent }
        } catch (parseError) {
          console.warn(`API: [${promptType}] Attempt ${attempt} JSON parse error:`, parseError)
          lastError = "AI analysis returned an invalid response"
          if (attempt < maxRetries) {
            const delay = 5000 * Math.pow(2, attempt - 1)
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
          continue
        }
      }

      logApiUsage({
        userId,
        contentId,
        apiName: "openrouter",
        operation: "analyze",
        tokensInput: usage.prompt_tokens || 0,
        tokensOutput: usage.completion_tokens || 0,
        modelName: prompt.model_name,
        responseTimeMs: attemptTimer.elapsed(),
        status: "success",
      })
      logProcessingMetrics({
        contentId: contentId || undefined,
        userId,
        sectionType: promptType,
        modelName: prompt.model_name,
        tokensInput: usage.prompt_tokens || 0,
        tokensOutput: usage.completion_tokens || 0,
        processingTimeMs: attemptTimer.elapsed(),
        retryCount,
        status: "success",
      })

      return { content: rawContent }
    } catch (error: unknown) {
      const isTimeout = getErrorName(error) === "AbortError"
      lastError = isTimeout ? "Request timed out after 2 minutes" : getErrorMessage(error)
      console.warn(`API: [${promptType}] Attempt ${attempt} failed: ${lastError}`)
      retryCount++

      if (attempt < maxRetries) {
        const delay = 5000 * Math.pow(2, attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  console.error(`API: [${promptType}] All ${maxRetries} attempts failed. Last error: ${lastError}`)

  logApiUsage({
    userId,
    contentId,
    apiName: "openrouter",
    operation: "analyze",
    modelName: prompt.model_name,
    responseTimeMs: timer.elapsed(),
    status: "error",
    errorMessage: lastError,
  })
  logProcessingMetrics({
    contentId: contentId || undefined,
    userId,
    sectionType: promptType,
    modelName: prompt.model_name,
    processingTimeMs: timer.elapsed(),
    retryCount,
    status: "error",
    errorMessage: lastError,
  })

  return { content: null, error: "AI analysis failed after multiple attempts" }
}

async function generateBriefOverview(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, toneDirective?: string | null, languageDirective?: string | null, metadataBlock?: string | null, typeInstructions?: string | null): Promise<string | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 8000), "brief_overview", contentType, 3, userId, contentId, webContext, toneDirective, languageDirective, undefined, metadataBlock, typeInstructions)
  if (result.error) {
    console.error(`API: Brief overview generation failed: ${result.error}`)
    return null
  }
  return typeof result.content === "string" ? result.content : null
}

async function generateTriage(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, languageDirective?: string | null, preferencesBlock?: string | null, metadataBlock?: string | null, typeInstructions?: string | null): Promise<TriageData | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 10000), "triage", contentType, 3, userId, contentId, webContext, undefined, languageDirective, preferencesBlock, metadataBlock, typeInstructions)
  if (result.error) {
    console.error(`API: Triage generation failed: ${result.error}`)
    return null
  }
  return result.content as TriageData
}

async function generateTruthCheck(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, languageDirective?: string | null, webSearchContext?: WebSearchContext | null, preferencesBlock?: string | null, claimContext?: string | null, claimSearchCtx?: ClaimSearchContext | null, metadataBlock?: string | null, typeInstructions?: string | null, domainCredibility?: string | null): Promise<TruthCheckData | null> {
  const citationInstruction = `\n\nIMPORTANT: For each issue you identify, include a "sources" array with citation objects containing "url" and "title" for verification. Use URLs from the web verification context above when available. Format: "sources": [{"url": "https://...", "title": "Source Title"}]. If no source URL is available for an issue, omit the sources field for that issue.`

  // Combine domain credibility warning + generic web context + targeted claim context, capped at 8K
  const rawCombinedContext = (domainCredibility ? domainCredibility + "\n\n" : "") + (webContext || "") + (claimContext || "")
  const combinedContext = rawCombinedContext.length > 8000 ? rawCombinedContext.substring(0, 8000) : rawCombinedContext
  const enrichedWebContext = combinedContext ? combinedContext + citationInstruction : null

  const result = await generateSectionWithAI(fullText.substring(0, 20000), "truth_check", contentType, 3, userId, contentId, enrichedWebContext, undefined, languageDirective, preferencesBlock, metadataBlock, typeInstructions)
  if (result.error) {
    console.error(`API: Truth check generation failed: ${result.error}`)
    return null
  }

  const truthCheck = result.content as TruthCheckData | null
  if (!truthCheck) return null

  // Build set of all available URLs from Tavily search results (anti-hallucination gate)
  const availableUrlSet = new Set<string>()
  const availableUrlMap = new Map<string, string>() // url → title
  if (webSearchContext?.searches) {
    for (const search of webSearchContext.searches) {
      for (const r of search.results) {
        if (r.url && r.title) {
          availableUrlSet.add(r.url)
          if (!availableUrlMap.has(r.url)) availableUrlMap.set(r.url, r.title)
        }
      }
    }
  }
  if (claimSearchCtx?.searches) {
    for (const search of claimSearchCtx.searches) {
      for (const r of search.results) {
        if (r.url && r.title) {
          availableUrlSet.add(r.url)
          if (!availableUrlMap.has(r.url)) availableUrlMap.set(r.url, r.title)
        }
      }
    }
  }

  if (truthCheck.issues) {
    for (const issue of truthCheck.issues) {
      if (issue.sources && Array.isArray(issue.sources)) {
        const rawSources = issue.sources as unknown[]
        issue.sources = rawSources
          .filter((s): s is Record<string, unknown> =>
            typeof s === "object" &&
            s !== null &&
            typeof (s as Record<string, unknown>).url === "string" &&
            (s as Record<string, unknown>).url !== ""
          )
          .map((s) => ({
            url: s.url as string,
            title: typeof s.title === "string" && s.title ? s.title : new URL(s.url as string).hostname,
          }))

        const seen = new Set<string>()
        issue.sources = issue.sources.filter((s) => {
          if (seen.has(s.url)) return false
          seen.add(s.url)
          return true
        })

        if (issue.sources.length === 0) {
          delete issue.sources
        }
      } else {
        delete issue.sources
      }
    }

    // Build deduplicated top-level references array from:
    // 1. AI-returned references (if the model included them)
    // 2. Per-issue sources
    // Only keep URLs that exist in availableUrlSet (anti-hallucination gate)
    const refSeen = new Set<string>()
    const references: Array<{ url: string; title: string }> = []

    // First, collect from AI-returned top-level references (if model followed the protocol)
    // The AI JSON is parsed into TruthCheckData which now has an optional references field
    const aiRefs = truthCheck.references
    if (Array.isArray(aiRefs)) {
      for (const ref of aiRefs) {
        const url = ref.url
        const title = ref.title || availableUrlMap.get(url) || url
        if (url && availableUrlSet.has(url) && !refSeen.has(url)) {
          refSeen.add(url)
          references.push({ url, title })
        }
      }
    }

    // Then collect from per-issue sources (for backward compat and completeness)
    for (const issue of truthCheck.issues) {
      if (issue.sources) {
        for (const src of issue.sources) {
          if (src.url && !refSeen.has(src.url)) {
            refSeen.add(src.url)
            // Only include if from Tavily results (anti-hallucination)
            if (availableUrlSet.has(src.url)) {
              references.push({ url: src.url, title: src.title })
            }
          }
        }
      }
    }

    if (references.length > 0) {
      truthCheck.references = references

      // Validate [N] citations in assessment text — strip any [N] where N > references.length
      const maxRef = references.length
      for (const issue of truthCheck.issues) {
        if (issue.assessment) {
          issue.assessment = issue.assessment.replace(/\[(\d+)\]/g, (match, numStr) => {
            const num = parseInt(numStr as string, 10)
            return num >= 1 && num <= maxRef ? match : ""
          })
          // Clean up double spaces left by stripped citations
          issue.assessment = issue.assessment.replace(/\s{2,}/g, " ").trim()
        }
      }
    }
  }

  return truthCheck
}

async function generateActionItems(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, languageDirective?: string | null, preferencesBlock?: string | null, metadataBlock?: string | null, typeInstructions?: string | null): Promise<ActionItemsData | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 15000), "action_items", contentType, 3, userId, contentId, webContext, undefined, languageDirective, preferencesBlock, metadataBlock, typeInstructions)
  if (result.error) {
    console.error(`API: Action items generation failed: ${result.error}`)
    return null
  }
  const content = result.content as { action_items?: ActionItemsData } | ActionItemsData | null
  if (content && typeof content === "object" && "action_items" in content && content.action_items) {
    return content.action_items
  }
  return content as ActionItemsData
}

async function generateDetailedSummary(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, toneDirective?: string | null, languageDirective?: string | null, preferencesBlock?: string | null, metadataBlock?: string | null, typeInstructions?: string | null): Promise<string | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 30000), "detailed_summary", contentType, 3, userId, contentId, webContext, toneDirective, languageDirective, preferencesBlock, metadataBlock, typeInstructions)
  if (result.error) {
    console.error(`API: Detailed summary generation failed: ${result.error}`)
    return null
  }
  return typeof result.content === "string" ? result.content : null
}

async function generateAutoTags(
  fullText: string,
  contentType?: string,
  userId?: string | null,
  contentId?: string | null,
): Promise<string[] | null> {
  const result = await generateSectionWithAI(
    fullText.substring(0, 10000),
    "auto_tags",
    contentType,
    2,
    userId,
    contentId,
  )
  if (result.error) {
    console.error(`API: Auto-tag generation failed: ${result.error}`)
    return null
  }
  const content = result.content as { tags?: string[] } | null
  if (content && Array.isArray(content.tags)) {
    return content.tags
      .map((t: string) => t.toLowerCase().trim().replace(/-/g, " "))
      .filter((t: string) => t.length > 0 && t.length <= 50)
      .slice(0, 5)
  }
  return null
}

// ============================================
// DATABASE HELPERS
// ============================================

async function updateSummarySection(
  supabase: ReturnType<typeof createClient<Database>>,
  contentId: string,
  userId: string,
  updates: Partial<Database["clarus"]["Tables"]["summaries"]["Update"]>,
  summaryLanguage: string = "en",
) {
  const { error } = await supabase
    .from("summaries")
    .upsert(
      {
        content_id: contentId,
        user_id: userId,
        language: summaryLanguage,
        updated_at: new Date().toISOString(),
        ...updates,
      },
      { onConflict: "content_id,language" },
    )

  if (error) {
    console.error(`Failed to update summary section:`, error)
    return false
  }
  return true
}

function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace("www.", "")
  } catch {
    return null
  }
}

/**
 * Checks if a URL belongs to a known music/entertainment platform.
 * Used to skip expensive claim verification searches — music content
 * doesn't have factual claims worth verifying.
 */
const ENTERTAINMENT_DOMAINS = new Set([
  "open.spotify.com", "spotify.com",
  "music.youtube.com", "music.apple.com",
  "soundcloud.com", "tidal.com", "deezer.com",
  "bandcamp.com", "pandora.com", "audiomack.com",
  "genius.com", "azlyrics.com", "lyrics.com",
  "vimeo.com",
])

function isEntertainmentUrl(url: string): boolean {
  const domain = extractDomain(url)
  if (!domain) return false
  return ENTERTAINMENT_DOMAINS.has(domain)
}

/**
 * Reads historical credibility data for a domain from past analyses.
 * Returns a warning string if the domain has a poor track record, or null if
 * the domain is new or has acceptable accuracy.
 *
 * Requires at least 3 prior analyses to avoid premature judgments.
 */
async function getDomainCredibility(
  supabase: ReturnType<typeof createClient<Database>>,
  url: string,
): Promise<string | null> {
  const domain = extractDomain(url)
  if (!domain) return null

  const { data, error } = await supabase
    .from("domains")
    .select("total_analyses, accurate_count, mostly_accurate_count, mixed_count, questionable_count, unreliable_count, avg_quality_score")
    .eq("domain", domain)
    .maybeSingle()

  if (error || !data || data.total_analyses < 3) return null

  const total = data.total_analyses
  const unreliableRatio = (data.questionable_count + data.unreliable_count) / total

  // Only warn when >30% of past analyses flagged questionable or unreliable
  if (unreliableRatio <= 0.3) return null

  const pct = Math.round(unreliableRatio * 100)
  return `## Source Credibility Warning\nThis content is from ${domain}, which has been rated "Questionable" or "Unreliable" in ${pct}% of ${total} previous analyses (avg quality score: ${data.avg_quality_score?.toFixed(1) ?? "N/A"}/10). Apply extra scrutiny to factual claims from this source.`
}

async function updateDomainStats(
  supabase: ReturnType<typeof createClient<Database>>,
  url: string,
  triage: TriageData | null,
  truthCheck: TruthCheckData | null
) {
  const domain = extractDomain(url)
  if (!domain) return

  const qualityScore = triage?.quality_score || 0
  const rating = truthCheck?.overall_rating

  const { error } = await supabase.rpc("upsert_domain_stats", {
    p_domain: domain,
    p_quality_score: qualityScore,
    p_accurate: rating === "Accurate" ? 1 : 0,
    p_mostly_accurate: rating === "Mostly Accurate" ? 1 : 0,
    p_mixed: rating === "Mixed" ? 1 : 0,
    p_questionable: rating === "Questionable" ? 1 : 0,
    p_unreliable: rating === "Unreliable" ? 1 : 0,
  })

  if (error) {
    console.warn(`Domain stats RPC failed, using fallback:`, error)
    await supabase.from("domains").upsert({
      domain,
      total_analyses: 1,
      total_quality_score: qualityScore,
      ...(rating === "Accurate" && { accurate_count: 1 }),
      ...(rating === "Mostly Accurate" && { mostly_accurate_count: 1 }),
      ...(rating === "Mixed" && { mixed_count: 1 }),
      ...(rating === "Questionable" && { questionable_count: 1 }),
      ...(rating === "Unreliable" && { unreliable_count: 1 }),
      last_seen: new Date().toISOString(),
    }, { onConflict: "domain" })
  }
}

// ============================================
// CROSS-USER CONTENT CACHE
// ============================================

// Type-specific cache staleness: articles/tweets change frequently,
// podcasts/videos/PDFs are static once published
function getCacheStaleDays(contentType: string | null): number {
  switch (contentType) {
    case "article":
    case "x_post":
      return 3    // Articles/tweets are often updated or become stale quickly
    case "youtube":
    case "podcast":
      return 14   // Audio/video content doesn't change after publication
    case "pdf":
    case "document":
      return 30   // Static documents rarely change
    default:
      return 7    // Conservative default
  }
}

interface CachedSourceFull {
  type: "full"
  content: Tables<"content">
  summary: Tables<"summaries">
}

interface CachedSourceTextOnly {
  type: "text_only"
  content: Tables<"content">
}

type CachedSource = CachedSourceFull | CachedSourceTextOnly | null

async function findCachedAnalysis(
  supabase: ReturnType<typeof createClient<Database>>,
  url: string,
  targetLanguage: string,
  currentUserId: string,
  contentType: string | null = null,
): Promise<CachedSource> {
  if (url.startsWith("pdf://") || url.startsWith("file://")) return null

  const normalizedUrlValue = normalizeUrl(url)
  const stalenessDate = new Date()
  stalenessDate.setDate(stalenessDate.getDate() - getCacheStaleDays(contentType))

  const { data: candidates, error } = await supabase
    .from("content")
    .select("id, url, user_id, full_text, title, author, duration, thumbnail_url, description, upload_date, view_count, like_count, channel_id, raw_youtube_metadata, transcript_languages, detected_tone, tags, analysis_language, type, date_added, is_bookmarked, share_token, podcast_transcript_id, regeneration_count, is_public, vote_score")
    .eq("url", normalizedUrlValue)
    .not("full_text", "is", null)
    .neq("user_id", currentUserId)
    .gte("date_added", stalenessDate.toISOString())
    .order("date_added", { ascending: false })
    .limit(5)

  if (error || !candidates || candidates.length === 0) return null

  const validCandidates = candidates.filter(
    (c) => c.full_text && !c.full_text.startsWith("PROCESSING_FAILED::")
  )
  if (validCandidates.length === 0) return null

  const candidateIds = validCandidates.map((c) => c.id)
  const { data: summaries } = await supabase
    .from("summaries")
    .select("id, content_id, user_id, model_name, created_at, updated_at, brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, processing_status, language")
    .in("content_id", candidateIds)
    .eq("language", targetLanguage)
    .eq("processing_status", "complete")

  if (summaries && summaries.length > 0) {
    const summaryByContentId = new Map(summaries.map((s) => [s.content_id, s]))
    for (const candidate of validCandidates) {
      const summary = summaryByContentId.get(candidate.id)
      if (summary) {
        return { type: "full", content: candidate, summary }
      }
    }
  }

  return { type: "text_only", content: validCandidates[0] }
}

function buildMetadataCopyPayload(
  source: Tables<"content">
): Partial<Database["clarus"]["Tables"]["content"]["Update"]> {
  const payload: Partial<Database["clarus"]["Tables"]["content"]["Update"]> = {}

  if (source.title) payload.title = source.title
  if (source.author) payload.author = source.author
  if (source.duration) payload.duration = source.duration
  if (source.thumbnail_url) payload.thumbnail_url = source.thumbnail_url
  if (source.description) payload.description = source.description
  if (source.upload_date) payload.upload_date = source.upload_date
  if (source.view_count) payload.view_count = source.view_count
  if (source.like_count) payload.like_count = source.like_count
  if (source.channel_id) payload.channel_id = source.channel_id
  if (source.raw_youtube_metadata) payload.raw_youtube_metadata = source.raw_youtube_metadata
  if (source.transcript_languages) payload.transcript_languages = source.transcript_languages

  return payload
}

async function cloneCachedContent(
  supabase: ReturnType<typeof createClient<Database>>,
  targetContentId: string,
  targetUserId: string,
  source: CachedSourceFull,
  targetLanguage: string,
): Promise<boolean> {
  try {
    const metadataPayload = buildMetadataCopyPayload(source.content)
    const contentUpdate: Partial<Database["clarus"]["Tables"]["content"]["Update"]> = {
      ...metadataPayload,
      full_text: source.content.full_text,
      detected_tone: source.content.detected_tone,
      tags: source.content.tags,
      analysis_language: targetLanguage,
    }

    const { error: contentError } = await supabase
      .from("content")
      .update(contentUpdate)
      .eq("id", targetContentId)

    if (contentError) {
      console.error("API: [cache] Failed to update target content:", contentError)
      return false
    }

    const { error: summaryError } = await supabase
      .from("summaries")
      .upsert(
        {
          content_id: targetContentId,
          user_id: targetUserId,
          language: targetLanguage,
          brief_overview: source.summary.brief_overview,
          triage: source.summary.triage,
          truth_check: source.summary.truth_check,
          action_items: source.summary.action_items,
          mid_length_summary: source.summary.mid_length_summary,
          detailed_summary: source.summary.detailed_summary,
          model_name: source.summary.model_name,
          processing_status: "complete",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "content_id,language" },
      )

    if (summaryError) {
      console.error("API: [cache] Failed to upsert target summary:", summaryError)
      return false
    }

    return true
  } catch (err) {
    console.error("API: [cache] Clone failed:", err)
    return false
  }
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

/**
 * Process content by ID. This is the core analysis pipeline.
 *
 * @param options - Processing options including contentId, userId, language, etc.
 * @returns A ProcessContentResult on success
 * @throws ProcessContentError on failure with appropriate status code
 */
export async function processContent(options: ProcessContentOptions): Promise<ProcessContentResult> {
  const {
    contentId,
    userId: authenticatedUserId,
    language = "en",
    forceRegenerate = false,
    skipScraping = false,
  } = options

  // Validate environment
  if (!supabaseUrl || !supabaseKey) {
    throw new ProcessContentError("Server configuration error: Missing database credentials.", 500)
  }

  if (!supadataApiKey || !openRouterApiKey || !firecrawlApiKey) {
    throw new ProcessContentError("Server configuration error: Missing API keys.", 500)
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, { db: { schema: "clarus" } })

  // Fetch content record
  const { data: content, error: fetchError } = await supabase
    .from("content")
    .select("id, url, type, user_id, full_text, title, author, duration, thumbnail_url, description, upload_date, view_count, like_count, channel_id, raw_youtube_metadata, transcript_languages, detected_tone, tags, analysis_language, regeneration_count, podcast_transcript_id, date_added, is_bookmarked, share_token")
    .eq("id", contentId)
    .single()

  if (fetchError || !content) {
    console.error(`API: Error fetching content by ID ${contentId}:`, fetchError)
    throw new ProcessContentError("Content not found", 404)
  }

  // Verify ownership for authenticated calls
  if (authenticatedUserId && content.user_id !== authenticatedUserId) {
    throw new ProcessContentError("Access denied", 403)
  }

  // Multi-language tier gating
  if (language !== "en" && content.user_id) {
    const { data: userData } = await supabase
      .from("users")
      .select("tier, day_pass_expires_at")
      .eq("id", content.user_id)
      .single()
    const userTier = normalizeTier(userData?.tier, userData?.day_pass_expires_at)
    if (!TIER_FEATURES[userTier].multiLanguageAnalysis) {
      throw new ProcessContentError(
        "Multi-language analysis requires a Starter plan or higher.",
        403,
        true,
        userTier
      )
    }
  }

  // Tier-based usage limit check — atomic check + increment (no TOCTOU race)
  const usageField = content.type === "podcast" ? "podcast_analyses_count" as const : "analyses_count" as const
  if (!forceRegenerate && content.user_id) {
    const usageCheck = await enforceAndIncrementUsage(supabase, content.user_id, usageField)
    if (!usageCheck.allowed) {
      const label = content.type === "podcast" ? "podcast analysis" : "analysis"
      throw new ProcessContentError(
        `Monthly ${label} limit reached (${usageCheck.limit}). Upgrade your plan for more.`,
        403,
        true,
        usageCheck.tier
      )
    }
  }

  // Cross-user cache check
  if (!forceRegenerate && content.user_id) {
    const cached = await findCachedAnalysis(supabase, content.url, language, content.user_id, content.type)

    if (cached?.type === "full") {
      const cloneSuccess = await cloneCachedContent(
        supabase,
        content.id,
        content.user_id,
        cached,
        language,
      )

      if (cloneSuccess) {
        // Update domain stats
        const cachedTriage = cached.summary.triage as TriageData | null
        const cachedTruthCheck = cached.summary.truth_check as TruthCheckData | null
        if (content.url) {
          updateDomainStats(supabase, content.url, cachedTriage, cachedTruthCheck).catch(
            (err) => console.warn("API: [cache] Domain stats update failed:", err)
          )
        }

        // Clone claims
        try {
          const { data: sourceClaims } = await supabase
            .from("claims")
            .select("claim_text, normalized_text, status, severity, sources")
            .eq("content_id", cached.content.id)

          if (sourceClaims && sourceClaims.length > 0) {
            const clonedClaims = sourceClaims.map((claim) => ({
              content_id: content.id,
              user_id: content.user_id!,
              claim_text: claim.claim_text,
              normalized_text: claim.normalized_text,
              status: claim.status,
              severity: claim.severity,
              sources: claim.sources,
            }))
            await supabase.from("claims").insert(clonedClaims)
          }
        } catch (claimErr) {
          console.warn("API: [cache] Claims clone failed (non-fatal):", claimErr)
        }

        // Usage already incremented atomically by enforceAndIncrementUsage() above

        logProcessingMetrics({
          contentId: content.id,
          userId: content.user_id,
          sectionType: "cache_hit",
          modelName: "none",
          tokensInput: 0,
          tokensOutput: 0,
          processingTimeMs: 0,
          retryCount: 0,
          status: "success",
        })

        return {
          success: true,
          cached: true,
          message: "Content analysis served from cache.",
          contentId: content.id,
          sectionsGenerated: [
            "brief_overview", "triage", "truth_check",
            "action_items", "mid_length_summary", "detailed_summary",
          ].filter((s) => {
            const key = s as keyof typeof cached.summary
            return cached.summary[key] != null
          }),
          language,
        }
      }
      console.warn("API: [cache] Clone failed, falling back to normal pipeline")
    } else if (cached?.type === "text_only") {
      const metadataPayload = buildMetadataCopyPayload(cached.content)
      const textOnlyUpdate: Partial<Database["clarus"]["Tables"]["content"]["Update"]> = {
        ...metadataPayload,
        full_text: cached.content.full_text,
        detected_tone: cached.content.detected_tone,
      }

      const { error: textCopyError } = await supabase
        .from("content")
        .update(textOnlyUpdate)
        .eq("id", content.id)

      if (!textCopyError) {
        Object.assign(content, textOnlyUpdate)
      } else {
        console.warn("API: [cache] Text copy failed, proceeding with normal scrape:", textCopyError)
      }
    }
  }

  // Content fetching (unless skipScraping is true)
  if (!skipScraping) {
    try {
      if (content.type === "youtube") {
        const shouldFetchYouTubeMetadata =
          forceRegenerate ||
          !content.author ||
          !content.duration ||
          !content.thumbnail_url ||
          !content.raw_youtube_metadata
        if (shouldFetchYouTubeMetadata) {
          const metadata = await getYouTubeMetadata(content.url, supadataApiKey, content.user_id, content.id)
          const updatePayload: Partial<Database["clarus"]["Tables"]["content"]["Update"]> = {}
          if (metadata.title) updatePayload.title = metadata.title
          if (metadata.author) updatePayload.author = metadata.author
          if (metadata.duration) updatePayload.duration = metadata.duration
          if (metadata.thumbnail_url) updatePayload.thumbnail_url = metadata.thumbnail_url
          if (metadata.description) updatePayload.description = metadata.description
          if (metadata.upload_date) updatePayload.upload_date = metadata.upload_date
          if (metadata.view_count) updatePayload.view_count = metadata.view_count
          if (metadata.like_count) updatePayload.like_count = metadata.like_count
          if (metadata.channel_id) updatePayload.channel_id = metadata.channel_id
          if (metadata.transcript_languages) updatePayload.transcript_languages = metadata.transcript_languages
          if (metadata.raw_youtube_metadata) updatePayload.raw_youtube_metadata = metadata.raw_youtube_metadata

          if (Object.keys(updatePayload).length > 0) {
            const { error: updateMetaError } = await supabase.from("content").update(updatePayload).eq("id", content.id)
            if (updateMetaError) console.error("API: Error updating YouTube metadata in DB:", updateMetaError)
            else Object.assign(content, updatePayload)
          }
        }

        const shouldFetchYouTubeText = !content.full_text || forceRegenerate
        if (shouldFetchYouTubeText) {
          const { full_text } = await getYouTubeTranscript(content.url, supadataApiKey, content.user_id, content.id)
          if (full_text) {
            const { error: updateTranscriptError } = await supabase
              .from("content")
              .update({ full_text })
              .eq("id", content.id)
            if (updateTranscriptError)
              console.error("API: Error updating YouTube transcript in DB:", updateTranscriptError)
            else content.full_text = full_text
          }
        }
      } else if (content.type === "podcast") {
        if (!content.full_text || forceRegenerate) {
          if (!assemblyAiApiKey) {
            console.error("API: ASSEMBLYAI_API_KEY not configured")
            throw new ProcessContentError("Podcast transcription is not configured.", 500)
          }

          const appUrl = process.env.NEXT_PUBLIC_APP_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
          const tokenParam = process.env.ASSEMBLYAI_WEBHOOK_TOKEN
            ? `?token=${process.env.ASSEMBLYAI_WEBHOOK_TOKEN}`
            : ""
          const webhookUrl = `${appUrl}/api/assemblyai-webhook${tokenParam}`

          const { transcript_id } = await submitPodcastTranscription(
            content.url,
            webhookUrl,
            assemblyAiApiKey,
          )

          await supabase
            .from("content")
            .update({ podcast_transcript_id: transcript_id })
            .eq("id", content.id)

          await updateSummarySection(supabase, content.id, content.user_id!, {
            processing_status: "transcribing",
          }, language)

          return {
            success: true,
            cached: false,
            message: "Podcast transcription started. Analysis will begin when transcription completes.",
            contentId: content.id,
            transcriptId: transcript_id,
            sectionsGenerated: [],
            language,
          }
        }
      } else if (content.type === "article" || content.type === "pdf" || content.type === "document" || content.type === "x_post") {
        const shouldScrape = forceRegenerate || !content.full_text || content.full_text.startsWith("PROCESSING_FAILED::")
        if (shouldScrape) {
          let scrapedData: ScrapedArticleData | null = null

          if (content.type === "x_post") {
            // Fallback chain for X/Twitter: fixupx → fxtwitter → direct
            const urlsToTry: string[] = []
            try {
              const urlObject = new URL(content.url)
              const hostname = urlObject.hostname
              if (hostname === "x.com" || hostname === "twitter.com") {
                const fixup = new URL(content.url)
                fixup.hostname = "fixupx.com"
                urlsToTry.push(fixup.toString())

                const fx = new URL(content.url)
                fx.hostname = "fxtwitter.com"
                urlsToTry.push(fx.toString())
              }
            } catch {
              console.error(`API: Could not parse URL for x_post: ${content.url}`)
            }
            urlsToTry.push(content.url) // Always try direct URL as last resort

            for (const urlToTry of urlsToTry) {
              try {
                const result = await scrapeArticle(urlToTry, firecrawlApiKey, content.user_id, content.id)
                if (result.full_text && result.full_text.length > 20) {
                  scrapedData = result
                  break
                }
                console.warn(`API: [x_post] Empty result from ${new URL(urlToTry).hostname}, trying next`)
              } catch (err) {
                console.warn(`API: [x_post] Scrape failed for ${new URL(urlToTry).hostname}:`, getErrorMessage(err))
                // Continue to next URL in chain
              }
            }
            if (!scrapedData) {
              throw new ProcessContentError("Could not retrieve X/Twitter post content from any source", 200)
            }
          } else {
            scrapedData = await scrapeArticle(content.url, firecrawlApiKey, content.user_id, content.id)
          }

          const updatePayload: Partial<Database["clarus"]["Tables"]["content"]["Update"]> = {}
          if (scrapedData.title) updatePayload.title = scrapedData.title
          if (scrapedData.full_text) updatePayload.full_text = scrapedData.full_text
          if (scrapedData.description) updatePayload.description = scrapedData.description
          if (scrapedData.thumbnail_url) updatePayload.thumbnail_url = scrapedData.thumbnail_url
          updatePayload.author = null
          updatePayload.duration = null
          updatePayload.upload_date = null
          updatePayload.view_count = null
          updatePayload.like_count = null
          updatePayload.channel_id = null
          updatePayload.transcript_languages = null
          updatePayload.raw_youtube_metadata = null

          if (Object.keys(updatePayload).length > 0) {
            const { error: updateArticleError } = await supabase
              .from("content")
              .update(updatePayload)
              .eq("id", content.id)
            if (updateArticleError) console.error("API: Error updating article data in DB:", updateArticleError)
            else Object.assign(content, updatePayload)
          }
        }
      }
    } catch (error: unknown) {
      const rawMsg = getErrorMessage(error)
      const contentTypeLabel = content.type?.toUpperCase() || "UNKNOWN"
      console.error(`API: Text processing error for content ${content.id}:`, rawMsg)

      const errorCategory = classifyError(rawMsg)
      const failure_reason = `PROCESSING_FAILED::${contentTypeLabel}::${errorCategory}`
      await supabase.from("content").update({ full_text: failure_reason }).eq("id", content.id)

      const userMessage = getUserFriendlyError(contentTypeLabel, errorCategory)
      throw new ProcessContentError(userMessage, 200) // 200 because partial success
    }
  }

  if (!content.full_text || content.full_text.startsWith("PROCESSING_FAILED::")) {
    console.warn(
      `API: No valid full text available for content ID ${content.id}. Skipping summary generation. Reason: ${content.full_text}`,
    )
    return {
      success: true,
      cached: false,
      message: "Content processed, but no valid text found for summary.",
      contentId: content.id,
      sectionsGenerated: [],
      language,
    }
  }

  // Content moderation pre-screening
  const screeningResult = await screenContent({
    url: content.url,
    scrapedText: content.full_text,
    contentId: content.id,
    userId: content.user_id,
    contentType: content.type,
    userIp: "internal",
  })

  if (screeningResult.blocked) {
    console.warn(`MODERATION: Content blocked for ${content.url} — ${screeningResult.flags.map(f => f.reason).join("; ")}`)

    await supabase.from("content").update({
      full_text: "PROCESSING_FAILED::CONTENT_POLICY_VIOLATION",
    }).eq("id", content.id)

    await supabase.from("summaries").upsert({
      content_id: content.id,
      user_id: content.user_id!,
      language,
      processing_status: "refused",
      brief_overview: "This content could not be analyzed because it may violate our content policy.",
      updated_at: new Date().toISOString(),
    }, { onConflict: "content_id,language" })

    throw new ProcessContentError(
      "This content cannot be analyzed because it may contain prohibited material.",
      200
    )
  }

  // Paywall detection
  const paywallWarning = detectPaywallTruncation(
    content.url,
    content.full_text,
    content.type || "article"
  )

  // Compute language directive
  const languageDirective = getLanguageDirective(language)

  if (!content.user_id) {
    console.error(`API: user_id is missing on content object with id ${content.id}. Cannot save summary.`)
    throw new ProcessContentError("Internal error: user_id missing from content.", 500)
  }

  const userId = content.user_id
  const contentIdVal = content.id
  const contentUrl = content.url
  const contentType = content.type || "article"
  const fullText = content.full_text

  // Pre-truncate text once — each section gets the right-sized slice without redundant allocations.
  // Cascade from largest to smallest so smaller slices reuse the larger string's memory.
  const text30K = fullText.substring(0, 30000)   // detailed_summary
  const text20K = text30K.substring(0, 20000)     // truth_check
  const text15K = text20K.substring(0, 15000)     // action_items, claim search
  const text10K = text15K.substring(0, 10000)     // triage, auto_tags, web search
  const text8K  = text10K.substring(0, 8000)      // brief_overview

  // Build rich metadata block for AI context — zero API calls, uses data already fetched
  const metadataBlock = buildContentMetadataBlock(content) || null

  // Build type-specific analysis instructions — tells the AI what to focus on per content type
  const typeInstructions = buildTypeInstructions(contentType, {
    duration: content.duration,
    speakerCount: fullText ? countSpeakers(fullText) : undefined,
  }) || null

  const titleNeedsFixing = !content.title || content.title.startsWith("Processing:") || content.title.startsWith("Analyzing:")

  const failedSections: string[] = []
  const sectionsGenerated: string[] = []

  // Global pipeline timeout — prevents hung requests from consuming resources indefinitely
  const pipelineAbort = new AbortController()
  const pipelineTimeoutId = setTimeout(() => pipelineAbort.abort(), PIPELINE_TIMEOUT_MS)

  // Request-scoped Tavily cache — isolated per request, prevents cross-user data leakage
  const tavilyCache = new Map<string, WebSearchResult>()

  // Web search context + claim verification + tone detection + user preferences (parallel)
  // Wrapped in a timeout — Phase 1 is enrichment, not critical. Falls back to defaults if slow.
  type Phase1Result = [WebSearchContext | null, ClaimSearchContext | null, ToneDetectionResult, UserAnalysisPreferences | null, string | null]
  const phase1Default: Phase1Result = [null, null, { tone_label: "neutral", tone_directive: "The content uses a standard informational tone. Write your analysis in a clear, neutral voice." }, null, null]

  let phase1: Phase1Result
  try {
    phase1 = await Promise.race([
      Promise.all([
        getWebSearchContext(text10K, content.title || undefined, tavilyCache),
        isEntertainmentUrl(contentUrl) ? Promise.resolve(null) : getClaimSearchContext(text15K, tavilyCache),
        detectContentTone(fullText, content.title, contentType, userId, contentIdVal),
        supabase
          .from("user_analysis_preferences")
          .select("analysis_mode, expertise_level, focus_areas, is_active")
          .eq("user_id", userId)
          .maybeSingle()
          .then(({ data }) => data as UserAnalysisPreferences | null),
        getDomainCredibility(supabase, contentUrl),
      ]) as Promise<Phase1Result>,
      new Promise<Phase1Result>((_, reject) =>
        setTimeout(() => reject(new Error("Phase 1 timeout")), PHASE1_TIMEOUT_MS)
      ),
    ])
  } catch (err) {
    console.warn(`API: Phase 1 timed out after ${PHASE1_TIMEOUT_MS / 1000}s, using defaults:`, getErrorMessage(err))
    phase1 = phase1Default
  }

  const [webSearchContext, claimSearchCtx, toneResult, preferencesRow, domainCredibility] = phase1
  const webContext = webSearchContext?.formattedContext || null
  const claimContext = claimSearchCtx?.formattedContext || null
  const toneDirective = toneResult.tone_directive
  const preferencesBlock = buildPreferenceBlock(preferencesRow)

  // Persist tone label
  if (toneResult.tone_label !== NEUTRAL_TONE_LABEL) {
    supabase.from("content").update({ detected_tone: toneResult.tone_label }).eq("id", contentIdVal).then(
      () => {},
      (err) => console.warn("Failed to persist detected_tone:", err)
    )
  }

  // Check pipeline timeout before starting Phase 2
  if (pipelineAbort.signal.aborted) {
    clearTimeout(pipelineTimeoutId)
    console.warn("API: Pipeline timeout hit after Phase 1, saving partial results")
    await updateSummarySection(supabase, contentIdVal, userId, { processing_status: "partial" }, language)
    return { success: true, cached: false, message: "Content partially processed (timeout).", contentId: content.id, sectionsGenerated, language, paywallWarning }
  }

  // All sections in parallel
  const overviewPromise = (async () => {
    const result = await generateBriefOverview(text8K, contentType, userId, contentIdVal, webContext, toneDirective, languageDirective, metadataBlock, typeInstructions)
    if (result) {
      await updateSummarySection(supabase, contentIdVal, userId, { brief_overview: result }, language)
      sectionsGenerated.push("brief_overview")
    } else {
      failedSections.push("brief_overview")
      console.warn(`API: [1/6] Brief overview failed.`)
    }
    return result
  })()

  const triagePromise = (async () => {
    const result = await generateTriage(text10K, contentType, userId, contentIdVal, webContext, languageDirective, preferencesBlock || null, metadataBlock, typeInstructions)
    if (result) {
      await updateSummarySection(supabase, contentIdVal, userId, { triage: result as unknown as Json }, language)
      sectionsGenerated.push("triage")
    } else {
      failedSections.push("triage")
      console.warn(`API: [2/6] Triage failed.`)
    }
    return result
  })()

  const midSummaryPromise = (async () => {
    const summaryResult = await getModelSummary(text30K, { shouldExtractTitle: titleNeedsFixing, toneDirective, languageDirective, metadataBlock, typeInstructions, contentType })
    if (summaryResult && !("error" in summaryResult)) {
      const validSummary = summaryResult as ModelSummary
      if (titleNeedsFixing && validSummary.title) {
        await supabase.from("content").update({ title: validSummary.title }).eq("id", contentIdVal)
      }
      if (validSummary.mid_length_summary) {
        await updateSummarySection(supabase, contentIdVal, userId, { mid_length_summary: validSummary.mid_length_summary }, language)
        sectionsGenerated.push("mid_length_summary")
      }
    } else {
      failedSections.push("mid_length_summary")
      console.warn(`API: [5/6] Mid-length summary failed.`)
    }
    return summaryResult
  })()

  const detailedPromise = (async () => {
    const result = await generateDetailedSummary(text30K, contentType, userId, contentIdVal, webContext, toneDirective, languageDirective, preferencesBlock || null, metadataBlock, typeInstructions)
    if (result) {
      await updateSummarySection(supabase, contentIdVal, userId, { detailed_summary: result }, language)
      sectionsGenerated.push("detailed_summary")
    } else {
      failedSections.push("detailed_summary")
      console.warn(`API: [6/6] Detailed summary failed.`)
    }
    return result
  })()

  const autoTagPromise = (async () => {
    const tags = await generateAutoTags(text10K, contentType, userId, contentIdVal)
    if (tags && tags.length > 0) {
      await supabase
        .from("content")
        .update({ tags })
        .eq("id", contentIdVal)
    } else {
      console.warn(`API: [tags] Auto-tag generation failed or empty.`)
    }
    return tags
  })()

  const truthCheckPromise = (async () => {
    const result = await generateTruthCheck(text20K, contentType, userId, contentIdVal, webContext, languageDirective, webSearchContext, preferencesBlock || null, claimContext, claimSearchCtx, metadataBlock, typeInstructions, domainCredibility)
    if (result) {
      // Will be saved after triage check
    } else {
      console.warn(`API: [3/6] Truth check failed.`)
    }
    return result
  })()

  const actionItemsPromise = (async () => {
    const result = await generateActionItems(text15K, contentType, userId, contentIdVal, webContext, languageDirective, preferencesBlock || null, metadataBlock, typeInstructions)
    if (result) {
      // Will be saved after triage check
    } else {
      console.warn(`API: [4/6] Action items failed.`)
    }
    return result
  })()

  // Promise.allSettled: one section crashing won't kill the others
  const phase2Results = await Promise.allSettled([
    overviewPromise, triagePromise, midSummaryPromise, detailedPromise, autoTagPromise,
    truthCheckPromise, actionItemsPromise,
  ])

  // Extract values — rejected promises return null (IIFEs already handle their own errors,
  // so rejection here means an unexpected crash, which we log and treat as a section failure)
  const phase2Values = phase2Results.map((r, i) => {
    if (r.status === "fulfilled") return r.value
    const sectionNames = ["brief_overview", "triage", "mid_length_summary", "detailed_summary", "auto_tags", "truth_check", "action_items"]
    console.error(`API: Phase 2 section ${sectionNames[i]} crashed unexpectedly:`, r.reason)
    if (!failedSections.includes(sectionNames[i])) failedSections.push(sectionNames[i])
    return null
  })

  const [briefOverview, triage, , detailedSummary, , truthCheckResult, actionItemsResult] = phase2Values as [
    string | null, TriageData | null, unknown, string | null, unknown, TruthCheckData | null, ActionItemsData | null
  ]

  // Check pipeline timeout before post-processing
  if (pipelineAbort.signal.aborted) {
    clearTimeout(pipelineTimeoutId)
    console.warn("API: Pipeline timeout hit after Phase 2, saving partial results")
    await updateSummarySection(supabase, contentIdVal, userId, { processing_status: "partial" }, language)
    return { success: true, cached: false, message: "Content partially processed (timeout).", contentId: content.id, sectionsGenerated, language, paywallWarning }
  }

  // Post-check: skip saving truth check + action items for music/entertainment
  const skipCategories = ["music", "entertainment"]
  const triageCategory = triage?.content_category
  const shouldSkipTruthCheck = triageCategory && skipCategories.includes(triageCategory)

  let truthCheck: TruthCheckData | null = null

  if (shouldSkipTruthCheck) {
    // Skip
  } else {
    if (truthCheckResult) {
      await updateSummarySection(supabase, contentIdVal, userId, { truth_check: truthCheckResult as unknown as Json }, language)
      sectionsGenerated.push("truth_check")
    } else {
      failedSections.push("truth_check")
    }

    if (actionItemsResult) {
      await updateSummarySection(supabase, contentIdVal, userId, { action_items: actionItemsResult as unknown as Json }, language)
      sectionsGenerated.push("action_items")
    }

    truthCheck = truthCheckResult
  }

  // AI refusal detection
  const aiSections = [
    { name: "brief_overview", content: briefOverview },
    { name: "triage", content: triage },
    { name: "detailed_summary", content: detailedSummary },
    { name: "truth_check", content: truthCheck },
  ]

  for (const section of aiSections) {
    const refusal = detectAiRefusal(section.content)
    if (refusal) {
      await persistFlag({
        contentId: contentIdVal,
        userId,
        url: contentUrl,
        contentType,
        flag: refusal,
        userIp: "internal",
        scrapedText: fullText,
      })
      console.warn(`MODERATION: AI refused [${section.name}] for ${contentUrl}: ${refusal.reason}`)
    }
  }

  // Update domain stats
  if (contentUrl && triage) {
    await updateDomainStats(supabase, contentUrl, triage, truthCheck)
  }

  // Claim tracking
  if (truthCheck && userId) {
    try {
      await supabase.from("claims").delete().eq("content_id", contentIdVal)

      const claimsToInsert: Array<{
        content_id: string
        user_id: string
        claim_text: string
        normalized_text: string
        status: string
        severity: string | null
        sources: Json | null
      }> = []

      if (truthCheck.claims && truthCheck.claims.length > 0) {
        for (const claim of truthCheck.claims) {
          if (!claim.exact_text) continue
          claimsToInsert.push({
            content_id: contentIdVal,
            user_id: userId,
            claim_text: claim.exact_text,
            normalized_text: claim.exact_text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim(),
            status: claim.status,
            severity: claim.severity ?? null,
            sources: (claim.sources ?? null) as Json,
          })
        }
      }

      if (truthCheck.issues && truthCheck.issues.length > 0) {
        for (const issue of truthCheck.issues) {
          if (!issue.claim_or_issue) continue
          claimsToInsert.push({
            content_id: contentIdVal,
            user_id: userId,
            claim_text: issue.claim_or_issue,
            normalized_text: issue.claim_or_issue.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim(),
            status: issue.type,
            severity: issue.severity ?? null,
            sources: (issue.sources ? issue.sources.map(s => s.url) : null) as Json,
          })
        }
      }

      if (claimsToInsert.length > 0) {
        await supabase.from("claims").insert(claimsToInsert)
      }
    } catch (claimErr) {
      console.warn("API: Failed to extract claims (non-fatal):", claimErr)
    }
  }

  // Self-healing: retry critical failures once
  const criticalSections = ["brief_overview", "triage", "detailed_summary"]
  const criticalFailures = failedSections.filter((s) => criticalSections.includes(s))

  if (criticalFailures.length > 0) {
    await Promise.all(criticalFailures.map(async (section) => {
      if (section === "brief_overview") {
        const result = await generateBriefOverview(fullText, contentType, userId, contentIdVal, null, toneDirective, languageDirective)
        if (result) {
          await updateSummarySection(supabase, contentIdVal, userId, { brief_overview: result }, language)
          sectionsGenerated.push("brief_overview")
        }
      } else if (section === "triage") {
        const result = await generateTriage(fullText, contentType, userId, contentIdVal, undefined, languageDirective)
        if (result) {
          await updateSummarySection(supabase, contentIdVal, userId, { triage: result as unknown as Json }, language)
          sectionsGenerated.push("triage")
          if (contentUrl) await updateDomainStats(supabase, contentUrl, result, truthCheck)
        }
      } else if (section === "detailed_summary") {
        const result = await generateDetailedSummary(fullText, contentType, userId, contentIdVal, null, toneDirective, languageDirective)
        if (result) {
          await updateSummarySection(supabase, contentIdVal, userId, { detailed_summary: result }, language)
          sectionsGenerated.push("detailed_summary")
        }
      }
    }))
  }

  // Clear pipeline timeout — we completed successfully
  clearTimeout(pipelineTimeoutId)

  // Mark processing complete
  await updateSummarySection(supabase, contentIdVal, userId, {
    processing_status: "complete",
  }, language)

  // Update content.analysis_language
  supabase.from("content").update({ analysis_language: language }).eq("id", contentIdVal).then(
    () => {},
    (err) => console.warn("Failed to update analysis_language:", err)
  )

  // Usage already incremented atomically by enforceAndIncrementUsage() at top of processContent()

  return {
    success: true,
    cached: false,
    message: "Content processed successfully.",
    contentId: content.id,
    sectionsGenerated,
    language,
    paywallWarning,
  }
}

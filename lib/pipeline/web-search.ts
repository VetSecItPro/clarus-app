/**
 * @module lib/pipeline/web-search
 * @description Web search integration (Tavily), topic extraction, claim extraction,
 * prompt caching, and web context formatting for the content processing pipeline.
 */

import { createClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/types/database.types"
import { logApiUsage, createTimer } from "@/lib/api-usage"
import { sanitizeForPrompt, wrapUserContent, INSTRUCTION_ANCHOR } from "@/lib/prompt-sanitizer"
import { parseAiResponseOrThrow } from "@/lib/ai-response-parser"
import { detectAiRefusal } from "@/lib/content-screening"
import { logger } from "@/lib/logger"
import { TAVILY_TIMEOUT_MS, EXTRACT_TOPICS_TIMEOUT_MS } from "./types"

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const openRouterApiKey = process.env.OPENROUTER_API_KEY
const tavilyApiKey = process.env.TAVILY_API_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// ============================================
// INTERFACES
// ============================================

export interface WebSearchResult {
  query: string
  answer?: string
  results: Array<{
    title: string
    url: string
    content: string
  }>
}

export interface WebSearchContext {
  searches: WebSearchResult[]
  formattedContext: string
  timestamp: string
  apiCallCount: number
  cacheHits: number
}

export interface VerifiableClaim {
  claim: string
  search_query: string
}

export interface ClaimSearchContext {
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

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function normalizeTavilyQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[?.!,]+$/, "")
}

// ============================================
// ANALYSIS PROMPTS
// ============================================

// Analysis prompts type
export type AnalysisPrompt = Tables<"analysis_prompts">

// Cache for prompts with 5-minute TTL (safe as module-level — prompts are identical for all users)
let promptsCache: Map<string, AnalysisPrompt> | null = null
let promptsCacheTime = 0
const PROMPTS_CACHE_TTL_MS = 5 * 60 * 1000

export async function fetchPromptFromDB(promptType: string): Promise<AnalysisPrompt | null> {
  if (!supabaseUrl || !supabaseKey) {
    logger.error("Supabase not configured for prompt fetch")
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
    logger.error(`Failed to fetch prompt ${promptType}:`, error?.message)
    return null
  }

  if (!promptsCache) {
    promptsCache = new Map()
    promptsCacheTime = Date.now()
  }
  promptsCache.set(promptType, data)

  return data
}

// ============================================
// TOPIC EXTRACTION
// ============================================

export async function extractKeyTopics(text: string, maxTopics: number = 3): Promise<string[]> {
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
      logger.warn("API: Topic extraction failed, skipping web search")
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
    logger.warn("API: Topic extraction error:", error)
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

// ============================================
// CLAIM EXTRACTION
// ============================================

export async function extractVerifiableClaims(text: string, maxClaims = 5): Promise<VerifiableClaim[]> {
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
      logger.warn("API: Claim extraction failed, skipping targeted verification")
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
      logger.warn("API: Claim extraction refused by model (content safety)")
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
    logger.warn("API: Claim extraction error:", error)
    return []
  }
}

// ============================================
// TAVILY SEARCH
// ============================================

export async function searchTavily(query: string, tavilyCache: Map<string, WebSearchResult>, maxRetries = 2): Promise<WebSearchResult | null> {
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
          logger.warn(`API: Tavily search failed for "${query}" (HTTP ${response.status}), retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        logger.warn(`API: Tavily search failed for "${query}" after ${attempt + 1} attempt(s)`)
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
        logger.warn(`API: Tavily search error for "${query}" (attempt ${attempt + 1}), retrying in ${delay}ms...`, error)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      logger.warn(`API: Tavily search error for "${query}" after ${attempt + 1} attempt(s):`, error)
      return null
    }
  }
  return null
}

// ============================================
// WEB CONTEXT FORMATTING
// ============================================

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

// ============================================
// WEB SEARCH CONTEXT
// ============================================

export async function getWebSearchContext(text: string, _contentTitle: string | undefined, tavilyCache: Map<string, WebSearchResult>): Promise<WebSearchContext | null> {
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

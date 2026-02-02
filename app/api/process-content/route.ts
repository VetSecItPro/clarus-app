import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import type { Database, Json, Tables, TriageData, TruthCheckData, ActionItemsData } from "@/types/database.types"
import { validateContentId, checkRateLimit } from "@/lib/validation"
import { logApiUsage, logProcessingMetrics, createTimer } from "@/lib/api-usage"
import { enforceUsageLimit, incrementUsage } from "@/lib/usage"
import { detectPaywallTruncation } from "@/lib/paywall-detection"
import { screenContent, detectAiRefusal, persistFlag } from "@/lib/content-screening"
import { submitPodcastTranscription } from "@/lib/assemblyai"
import { authenticateRequest } from "@/lib/auth"
import { isValidLanguage, getLanguageDirective, type AnalysisLanguage } from "@/lib/languages"
import { TIER_FEATURES, normalizeTier } from "@/lib/tier-limits"

// Extend Vercel function timeout to 5 minutes (requires Pro plan)
// This is critical for processing long videos that require multiple AI calls
export const maxDuration = 300

// Timeout for individual AI API calls (2 minutes per call)
const AI_CALL_TIMEOUT_MS = 120000

// Helper to safely extract error properties
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}

function getErrorName(error: unknown): string {
  if (error instanceof Error) return error.name
  return ""
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supadataApiKey = process.env.SUPADATA_API_KEY
const openRouterApiKey = process.env.OPENROUTER_API_KEY
const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
const tavilyApiKey = process.env.TAVILY_API_KEY
const assemblyAiApiKey = process.env.ASSEMBLYAI_API_KEY

// ============================================
// WEB SEARCH INTEGRATION (Tavily)
// Provides real-time fact-checking context
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
}

// Tavily API response type
interface TavilySearchResult {
  title: string
  url: string
  content?: string
}

interface TavilyApiResponse {
  answer?: string
  results?: TavilySearchResult[]
}

// Extract key topics/claims that need verification
async function extractKeyTopics(text: string): Promise<string[]> {
  if (!openRouterApiKey) return []

  const truncatedText = text.substring(0, 8000) // Limit input for speed

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", // Fast and cheap
        messages: [
          {
            role: "system",
            content: `You are a search query strategist for fact-verification. Given content, generate targeted web search queries that would help verify the most important and time-sensitive claims.

PRIORITIZATION:
1. Specific factual assertions (statistics, dates, figures, rankings)
2. Claims about people, companies, or organizations
3. References to studies, reports, or official announcements
4. Time-sensitive claims that may have changed since publication

OUTPUT: Return a JSON object with a "queries" key containing an array of 3-5 concise search queries (2-8 words each). Target verifiable assertions, not general topics.`
          },
          {
            role: "user",
            content: `Generate fact-verification search queries for the key claims in this content:\n\n${truncatedText}`
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      console.warn("API: Topic extraction failed, skipping web search")
      return []
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return []

    // Parse the JSON response
    const parsed = JSON.parse(content)
    const topics = Array.isArray(parsed) ? parsed : parsed.queries || parsed.topics || []

    // Limit to 5 topics max
    return topics.slice(0, 5).filter((t: unknown) => typeof t === 'string' && t.length > 2)
  } catch (error) {
    console.warn("API: Topic extraction error:", error)
    return []
  }
}

// Search a single topic with Tavily (with retry + exponential backoff)
async function searchTavily(query: string, maxRetries = 2): Promise<WebSearchResult | null> {
  if (!tavilyApiKey) return null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const timer = createTimer()
    try {
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
      })

      if (!response.ok) {
        // Retry on 5xx or 429 (rate limit)
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

      return {
        query,
        answer: data.answer,
        results: ((data as TavilyApiResponse).results || []).slice(0, 3).map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content?.substring(0, 500) || "",
        })),
      }
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

// Get web search context for content analysis
async function getWebSearchContext(text: string, _contentTitle?: string): Promise<WebSearchContext | null> {
  if (!tavilyApiKey) {
    console.log("API: Tavily API key not configured, skipping web search")
    return null
  }

  console.log("API: Extracting key topics for web search...")
  const topics = await extractKeyTopics(text)

  if (topics.length === 0) {
    console.log("API: No topics extracted, skipping web search")
    return null
  }

  console.log(`API: Searching ${topics.length} topics in parallel:`, topics)

  // Search all topics in parallel for speed
  const searchPromises = topics.map(topic => searchTavily(topic))
  const results = await Promise.all(searchPromises)

  // Filter successful searches
  const validResults = results.filter((r): r is WebSearchResult => r !== null && r.results.length > 0)

  if (validResults.length === 0) {
    console.log("API: No web search results found")
    return null
  }

  // Format context for AI consumption
  const formattedContext = formatWebContext(validResults)

  console.log(`API: Web search complete. ${validResults.length}/${topics.length} searches returned results.`)

  return {
    searches: validResults,
    formattedContext,
    timestamp: new Date().toISOString(),
  }
}

// Format web search results for injection into prompts
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
// TONE DETECTION PRE-PASS
// Detects content voice/tone before analysis
// so AI output matches the content's register
// ============================================

const NEUTRAL_TONE_DIRECTIVE = "The content uses a standard informational tone. Write your analysis in a clear, neutral voice."
const NEUTRAL_TONE_LABEL = "neutral"

const TONE_DETECTION_SYSTEM_PROMPT = `You are a content voice analyst. Given a sample of content, identify its communicative tone and produce a writing directive.

ANALYSIS FRAMEWORK:
1. Formality: Academic/formal vs. casual/conversational vs. professional/business
2. Expertise level: Expert-to-expert vs. expert-to-layperson vs. general audience
3. Emotional register: Neutral/objective vs. passionate/persuasive vs. humorous/irreverent
4. Pacing: Dense/information-heavy vs. narrative/storytelling vs. punchy/fast-paced

OUTPUT: Return a JSON object with:
- "tone_label": 1-3 word label (e.g., "casual-technical", "academic", "investigative-journalism")
- "tone_directive": 2-4 sentence instruction telling an AI analyst how to write about this content in a way that respects the original voice. Be specific about word choice, sentence structure, and framing. Do NOT describe the content — describe how to WRITE ABOUT IT.

Return ONLY valid JSON.`

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

  const timer = createTimer()
  const sample = fullText.substring(0, 2000)
  const titleLine = contentTitle ? `Title: ${contentTitle}\n` : ""

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s hard timeout

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clarusapp.io",
        "X-Title": "Clarus",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: TONE_DETECTION_SYSTEM_PROMPT },
          { role: "user", content: `${titleLine}Content Type: ${contentType}\n\n${sample}` },
        ],
        temperature: 0.2,
        max_tokens: 250,
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

    // Log API usage
    logApiUsage({
      userId,
      contentId,
      apiName: "openrouter",
      operation: "tone_detection",
      tokensInput: usage.prompt_tokens || 0,
      tokensOutput: usage.completion_tokens || 0,
      modelName: "google/gemini-2.5-flash-lite",
      responseTimeMs: timer.elapsed(),
      status: "success",
      metadata: { section: "tone_detection" },
    })

    const parsed = JSON.parse(rawContent)
    const toneLabel = typeof parsed.tone_label === "string" ? parsed.tone_label.trim() : NEUTRAL_TONE_LABEL
    const toneDirective = typeof parsed.tone_directive === "string" ? parsed.tone_directive.trim() : NEUTRAL_TONE_DIRECTIVE

    if (!toneLabel || !toneDirective) {
      return { tone_label: NEUTRAL_TONE_LABEL, tone_directive: NEUTRAL_TONE_DIRECTIVE }
    }

    console.log(`API: [tone_detection] Detected tone: "${toneLabel}"`)
    return { tone_label: toneLabel, tone_directive: toneDirective }
  } catch (error: unknown) {
    const msg = getErrorMessage(error)
    console.warn(`API: [tone_detection] Failed (non-fatal): ${msg}`)

    logApiUsage({
      userId,
      contentId,
      apiName: "openrouter",
      operation: "tone_detection",
      modelName: "google/gemini-2.5-flash-lite",
      responseTimeMs: timer.elapsed(),
      status: "error",
      errorMessage: msg,
      metadata: { section: "tone_detection" },
    })

    return { tone_label: NEUTRAL_TONE_LABEL, tone_directive: NEUTRAL_TONE_DIRECTIVE }
  }
}

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

interface ScrapedArticleData {
  title: string | null
  full_text: string | null
  description: string | null
  thumbnail_url: string | null
}

async function getYouTubeMetadata(url: string, apiKey: string, userId?: string | null, contentId?: string | null): Promise<ProcessedYouTubeMetadata> {
  console.log(`API: Fetching YouTube metadata for ${url} using supadata.ai`)
  const endpoint = `https://api.supadata.ai/v1/youtube/video?id=${encodeURIComponent(url)}`
  const retries = 3
  const delay = 1000 // 1 second
  const timer = createTimer()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout
      const response = await fetch(endpoint, {
        headers: { "x-api-key": apiKey },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.ok) {
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const errorText = await response.text()
          console.error(`Supadata Metadata API Error: Expected JSON, got ${contentType}. Response: ${errorText}`)
          throw new Error(`Supadata Metadata API Error: Expected JSON, got ${contentType}.`)
        }
        const data: SupadataYouTubeResponse = await response.json()

        // Log successful API call
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
        const errorMessage = `Supadata Metadata API Client Error (${
          response.status
        }) for url ${url}: ${errorText.substring(0, 200)}. Not retrying.`
        console.error(errorMessage)
        throw new Error(errorMessage)
      }

      const errorText = await response.text()
      console.warn(
        `Supadata Metadata API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
          delay / 1000
        }s...`,
      )
    } catch (error: unknown) {
      const msg = getErrorMessage(error)
      if (msg.includes("Client Error")) {
        throw error
      }
      console.warn(
        `Error on attempt ${attempt} calling Supadata YouTube Metadata API for ${url}: ${msg}. Retrying in ${
          delay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, delay))
    }
  }

  const finalErrorMessage = `Failed to fetch YouTube metadata for ${url} after ${retries} attempts.`
  console.error(finalErrorMessage)

  // Log failed API call
  logApiUsage({
    userId,
    contentId,
    apiName: "supadata",
    operation: "metadata",
    responseTimeMs: timer.elapsed(),
    status: "error",
    errorMessage: finalErrorMessage,
  })

  throw new Error(finalErrorMessage)
}

// Helper to format milliseconds to MM:SS or H:MM:SS
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
  console.log(`API: Fetching YouTube transcript for ${url} using supadata.ai`)
  // Remove text=true to get timestamped chunks
  const endpoint = `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}`
  const retries = 3
  const delay = 1000
  const timer = createTimer()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000) // 60s timeout (transcripts can be large)
      const response = await fetch(endpoint, {
        headers: { "x-api-key": apiKey },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.ok) {
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const errorText = await response.text()
          console.error(`Supadata Transcript API Error: Expected JSON, got ${contentType}. Response: ${errorText}`)
          throw new Error(`Supadata Transcript API Error: Expected JSON, got ${contentType}.`)
        }
        const data = await response.json()

        // Handle timestamped transcript format
        if (Array.isArray(data.content)) {
          // Group transcript chunks into 30-second intervals for cleaner reading
          const INTERVAL_MS = 30000 // 30 seconds
          const groupedChunks: { timestamp: number; texts: string[] }[] = []

          for (const chunk of data.content as { text: string; offset: number }[]) {
            const intervalStart = Math.floor(chunk.offset / INTERVAL_MS) * INTERVAL_MS

            // Find or create the group for this interval
            let group = groupedChunks.find(g => g.timestamp === intervalStart)
            if (!group) {
              group = { timestamp: intervalStart, texts: [] }
              groupedChunks.push(group)
            }
            group.texts.push(chunk.text)
          }

          // Sort by timestamp and format
          groupedChunks.sort((a, b) => a.timestamp - b.timestamp)
          const formattedText = groupedChunks
            .map(group => {
              const timestamp = formatTimestamp(group.timestamp)
              const combinedText = group.texts.join(' ')
              return `[${timestamp}] ${combinedText}`
            })
            .join('\n\n')

          console.log(`API: Grouped ${data.content.length} chunks into ${groupedChunks.length} intervals (30s each)`)

          // Log successful API call
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

        // Log successful API call
        logApiUsage({
          userId,
          contentId,
          apiName: "supadata",
          operation: "transcript",
          responseTimeMs: timer.elapsed(),
          status: "success",
        })

        // Fallback if content is already a string
        return { full_text: data.content }
      }

      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text()
        const errorMessage = `Supadata Transcript API Client Error (${
          response.status
        }) for url ${url}: ${errorText.substring(0, 200)}. Not retrying.`
        console.error(errorMessage)
        throw new Error(errorMessage)
      }

      const errorText = await response.text()
      console.warn(
        `Supadata Transcript API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
          delay / 1000
        }s...`,
      )
    } catch (error: unknown) {
      const msg = getErrorMessage(error)
      if (msg.includes("Client Error")) {
        throw error
      }
      console.warn(
        `Error on attempt ${attempt} calling Supadata YouTube Transcript API for ${url}: ${msg}. Retrying in ${
          delay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, delay))
    }
  }

  const finalErrorMessage = `Failed to fetch YouTube transcript for ${url} after ${retries} attempts.`
  console.error(finalErrorMessage)

  // Log failed API call
  logApiUsage({
    userId,
    contentId,
    apiName: "supadata",
    operation: "transcript",
    responseTimeMs: timer.elapsed(),
    status: "error",
    errorMessage: finalErrorMessage,
  })

  throw new Error(finalErrorMessage)
}

async function scrapeArticle(url: string, apiKey: string, userId?: string | null, contentId?: string | null): Promise<ScrapedArticleData> {
  console.log(`API: Scraping article for ${url} using FireCrawl`)
  const endpoint = "https://api.firecrawl.dev/v0/scrape"
  const retries = 5
  const delay = 2000
  const timer = createTimer()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
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
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          console.log("API: FireCrawl scrape successful.")

          // Log successful API call
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
          throw new Error(result.error || "FireCrawl API indicated failure.")
        }
      }

      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text()
        const errorMessage = `FireCrawl API Client Error (${response.status}) for url ${url}: ${errorText.substring(
          0,
          200,
        )}. Not retrying.`
        console.error(errorMessage)
        throw new Error(errorMessage)
      }

      const errorText = await response.text()
      console.warn(
        `FireCrawl API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
          delay / 1000
        }s...`,
      )
    } catch (error: unknown) {
      const msg = getErrorMessage(error)
      if (msg.includes("Client Error")) {
        throw error
      }
      console.warn(
        `Error on attempt ${attempt} calling FireCrawl API for ${url}: ${msg}. Retrying in ${
          delay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, delay))
    }
  }

  const finalErrorMessage = `Failed to scrape article with FireCrawl for ${url} after ${retries} attempts.`
  console.error(finalErrorMessage)

  // Log failed API call
  logApiUsage({
    userId,
    contentId,
    apiName: "firecrawl",
    operation: "scrape",
    responseTimeMs: timer.elapsed(),
    status: "error",
    errorMessage: finalErrorMessage,
  })

  throw new Error(finalErrorMessage)
}

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

async function getModelSummary(
  textToSummarize: string,
  options: { shouldExtractTitle?: boolean; toneDirective?: string | null; languageDirective?: string | null } = {},
): Promise<ModelSummary | ModelProcessingError> {
  const { shouldExtractTitle = false, toneDirective, languageDirective } = options

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
    .select("*")
    .eq("id", 1)
    .single()

  if (promptError || !promptData) {
    const msg = `Failed to fetch summarizer prompt from DB: ${promptError?.message}`
    console.error(msg)
    return { error: true, modelName: "N/A", reason: "PromptFetchFailed", finalErrorMessage: msg }
  }

  const { system_content, user_content_template, temperature, top_p, max_tokens, model_name } = promptData

  const openRouterModelId = model_name || "google/gemini-2.5-flash"
  const finalUserPrompt = (user_content_template || "{{TEXT_TO_SUMMARIZE}}")
    .replace("{{TONE}}", toneDirective || NEUTRAL_TONE_DIRECTIVE)
    .replace("{{LANGUAGE}}", languageDirective || "Write your analysis in English.")
    .replace("{{TEXT_TO_SUMMARIZE}}", textToSummarize)

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
    console.log(`API: Calling OpenRouter with model ${openRouterModelId}...`)
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
    console.log("API: Raw content received from OpenRouter:", rawContent)

    if (!rawContent) {
      const errorMessage = "OpenRouter response missing message content."
      console.error(errorMessage, result)
      return { error: true, modelName: openRouterModelId, reason: "InvalidResponse", finalErrorMessage: errorMessage }
    }

    let parsedContent: ParsedModelSummaryResponse
    try {
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch && jsonMatch[1]) {
        console.log("API: Found JSON inside markdown block. Parsing...")
        parsedContent = JSON.parse(jsonMatch[1]) as ParsedModelSummaryResponse
      } else {
        console.log("API: No markdown block found. Attempting to parse entire content as JSON...")
        parsedContent = JSON.parse(rawContent) as ParsedModelSummaryResponse
      }
    } catch (parseError: unknown) {
      const errorMessage = `Failed to parse JSON from model response. Error: ${getErrorMessage(parseError)}`
      console.error(errorMessage, "Raw content was:", rawContent)
      return { error: true, modelName: openRouterModelId, reason: "JSONParseFailed", finalErrorMessage: errorMessage }
    }

    console.log("API: Successfully parsed content:", parsedContent)

    const summary: ModelSummary = {
      mid_length_summary: parsedContent.mid_length_summary || null,
    }
    if (shouldExtractTitle) {
      summary.title = parsedContent.title || null
    }

    console.log("API: Summary generated successfully for model:", openRouterModelId)
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
// NEW: Section Generation Functions for Phase 2
// Updated in Phase 3 to use database prompts
// ============================================

type AnalysisPrompt = Tables<"analysis_prompts">

// OpenRouter request body type
interface OpenRouterRequestBody {
  model: string
  messages: Array<{ role: string; content: string }>
  response_format?: { type: string }
  temperature?: number
  top_p?: number
  max_tokens?: number
}

// Parsed model summary response
interface ParsedModelSummaryResponse {
  mid_length_summary?: string
  title?: string
}

// Section generation result type
interface SectionGenerationResult {
  content: unknown
  error?: string
}

// Cache for prompts (refreshed on each request batch)
let promptsCache: Map<string, AnalysisPrompt> | null = null

async function fetchPromptFromDB(promptType: string): Promise<AnalysisPrompt | null> {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase not configured for prompt fetch")
    return null
  }

  // Check cache first
  if (promptsCache?.has(promptType)) {
    return promptsCache.get(promptType) || null
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey, { db: { schema: "clarus" } })

  const { data, error } = await supabaseAdmin
    .from("analysis_prompts")
    .select("*")
    .eq("prompt_type", promptType)
    .eq("is_active", true)
    .single()

  if (error || !data) {
    console.error(`Failed to fetch prompt ${promptType}:`, error?.message)
    return null
  }

  // Cache the prompt
  if (!promptsCache) promptsCache = new Map()
  promptsCache.set(promptType, data)

  return data
}

// Clear cache at start of each processing batch
function clearPromptsCache() {
  promptsCache = null
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
): Promise<SectionGenerationResult> {
  if (!openRouterApiKey) {
    return { content: null, error: "OpenRouter API key not configured" }
  }

  // Fetch prompt from database
  const prompt = await fetchPromptFromDB(promptType)
  if (!prompt) {
    return { content: null, error: `Prompt not found for type: ${promptType}` }
  }

  // Replace template variables
  let userContent = prompt.user_content_template
    .replace("{{TONE}}", toneDirective || NEUTRAL_TONE_DIRECTIVE)
    .replace("{{LANGUAGE}}", languageDirective || "Write your analysis in English.")
    .replace("{{CONTENT}}", textToAnalyze)
    .replace("{{TYPE}}", contentType || "article")

  // Inject web search context if available AND enabled for this prompt
  const useWebSearch = prompt.use_web_search !== false // Default to true if not set
  if (webContext && useWebSearch) {
    userContent = userContent + webContext
    console.log(`API: [${promptType}] Web search context included`)
  } else if (webContext && !useWebSearch) {
    console.log(`API: [${promptType}] Web search disabled for this prompt`)
  }

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

  // Self-healing retry loop with exponential backoff
  let lastError: string = ""
  let retryCount = 0
  const timer = createTimer()

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptTimer = createTimer()
    try {
      console.log(`API: [${promptType}] Attempt ${attempt}/${maxRetries}...`)
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
        lastError = `API Error (${response.status}): ${errorBody}`
        console.warn(`API: [${promptType}] Attempt ${attempt} failed: ${lastError}`)
        retryCount++

        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          return { content: null, error: lastError }
        }

        // Wait before retry with exponential backoff (5s, 10s, 20s)
        if (attempt < maxRetries) {
          const delay = 5000 * Math.pow(2, attempt - 1)
          console.log(`API: [${promptType}] Waiting ${delay / 1000}s before retry...`)
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

      if (prompt.expect_json) {
        try {
          // Try to parse JSON, handling markdown code blocks
          const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/)
          const parsedContent = jsonMatch && jsonMatch[1] ? JSON.parse(jsonMatch[1]) : JSON.parse(rawContent)

          console.log(`API: [${promptType}] Success on attempt ${attempt}`)

          // Log successful API call and processing metrics
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
          lastError = `JSON parse error: ${parseError}`
          console.warn(`API: [${promptType}] Attempt ${attempt} failed: ${lastError}`)
          if (attempt < maxRetries) {
            const delay = 5000 * Math.pow(2, attempt - 1)
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
          continue
        }
      }

      console.log(`API: [${promptType}] Success on attempt ${attempt}`)

      // Log successful API call for non-JSON content
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

      // Wait before retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = 5000 * Math.pow(2, attempt - 1)
        console.log(`API: [${promptType}] Waiting ${delay / 1000}s before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  console.error(`API: [${promptType}] All ${maxRetries} attempts failed. Last error: ${lastError}`)

  // Log failed API call
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

  return { content: null, error: `All ${maxRetries} attempts failed. Last error: ${lastError}` }
}

async function generateBriefOverview(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, toneDirective?: string | null, languageDirective?: string | null): Promise<string | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 15000), "brief_overview", contentType, 3, userId, contentId, webContext, toneDirective, languageDirective)
  if (result.error) {
    console.error(`API: Brief overview generation failed: ${result.error}`)
    return null
  }
  return typeof result.content === "string" ? result.content : null
}

async function generateTriage(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, languageDirective?: string | null): Promise<TriageData | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 15000), "triage", contentType, 3, userId, contentId, webContext, undefined, languageDirective)
  if (result.error) {
    console.error(`API: Triage generation failed: ${result.error}`)
    return null
  }
  return result.content as TriageData
}

async function generateTruthCheck(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, languageDirective?: string | null): Promise<TruthCheckData | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 20000), "truth_check", contentType, 3, userId, contentId, webContext, undefined, languageDirective)
  if (result.error) {
    console.error(`API: Truth check generation failed: ${result.error}`)
    return null
  }
  return result.content as TruthCheckData
}

async function generateActionItems(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, languageDirective?: string | null): Promise<ActionItemsData | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 20000), "action_items", contentType, 3, userId, contentId, webContext, undefined, languageDirective)
  if (result.error) {
    console.error(`API: Action items generation failed: ${result.error}`)
    return null
  }
  // The response has action_items array wrapped in an object
  const content = result.content as { action_items?: ActionItemsData } | ActionItemsData | null
  if (content && typeof content === "object" && "action_items" in content && content.action_items) {
    return content.action_items
  }
  return content as ActionItemsData
}

async function generateDetailedSummary(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, toneDirective?: string | null, languageDirective?: string | null): Promise<string | null> {
  // Now uses database prompt with {{CONTENT}} and {{TYPE}} placeholders
  const result = await generateSectionWithAI(fullText.substring(0, 30000), "detailed_summary", contentType, 3, userId, contentId, webContext, toneDirective, languageDirective)
  if (result.error) {
    console.error(`API: Detailed summary generation failed: ${result.error}`)
    return null
  }
  return typeof result.content === "string" ? result.content : null
}

async function generateAutoTags(
  fullText: string,
  userId?: string | null,
  contentId?: string | null,
): Promise<string[] | null> {
  const result = await generateSectionWithAI(
    fullText.substring(0, 10000),
    "auto_tags",
    undefined,
    2, // only 2 retries — tags are not critical
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

// Helper to update summary in database
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

// Helper to extract domain from URL
function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace("www.", "")
  } catch {
    return null
  }
}

// Helper to update domain credibility stats
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

  // Try to upsert domain stats
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
    // Fallback: try simple upsert
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
// Serves cached analysis when another user has already analyzed the same URL
// ============================================

const CACHE_STALENESS_DAYS = 14

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

/**
 * Searches across all users for a previously analyzed copy of the same URL.
 * Uses service-role client (bypasses RLS) since we're reading other users' content.
 *
 * Returns:
 * - "full"      → full_text + completed summary in the target language exist
 * - "text_only" → full_text exists but no summary in the target language
 * - null        → nothing usable found
 */
async function findCachedAnalysis(
  supabase: ReturnType<typeof createClient<Database>>,
  url: string,
  targetLanguage: string,
  currentUserId: string,
): Promise<CachedSource> {
  // Never cache-match PDFs (user-uploaded, pdf:// URLs are not shareable)
  if (url.startsWith("pdf://")) return null

  const stalenessDate = new Date()
  stalenessDate.setDate(stalenessDate.getDate() - CACHE_STALENESS_DAYS)

  // Find content records with same URL, non-null full_text, within staleness window
  const { data: candidates, error } = await supabase
    .from("content")
    .select("*")
    .eq("url", url)
    .not("full_text", "is", null)
    .neq("user_id", currentUserId)
    .gte("date_added", stalenessDate.toISOString())
    .order("date_added", { ascending: false })
    .limit(5)

  if (error || !candidates || candidates.length === 0) return null

  // Filter out failed content
  const validCandidates = candidates.filter(
    (c) => c.full_text && !c.full_text.startsWith("PROCESSING_FAILED::")
  )
  if (validCandidates.length === 0) return null

  // Check each candidate for a completed summary in the target language
  for (const candidate of validCandidates) {
    const { data: summary } = await supabase
      .from("summaries")
      .select("*")
      .eq("content_id", candidate.id)
      .eq("language", targetLanguage)
      .eq("processing_status", "complete")
      .single()

    if (summary) {
      console.log(`API: [cache] FULL HIT — found completed analysis from content ${candidate.id}`)
      return { type: "full", content: candidate, summary }
    }
  }

  // No full hit — return text-only from the best candidate
  console.log(`API: [cache] TEXT-ONLY HIT — found full_text from content ${validCandidates[0].id}, no summary in ${targetLanguage}`)
  return { type: "text_only", content: validCandidates[0] }
}

/**
 * Extracts copyable metadata fields from a source content record.
 * Only copies non-null fields.
 */
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

/**
 * Clones a full cached analysis (full_text + summary) to the target content record.
 * Returns true on success, false on failure (caller should fall through to normal pipeline).
 */
async function cloneCachedContent(
  supabase: ReturnType<typeof createClient<Database>>,
  targetContentId: string,
  targetUserId: string,
  source: CachedSourceFull,
  targetLanguage: string,
): Promise<boolean> {
  try {
    // 1. Update target content record with full_text, detected_tone, metadata, tags, analysis_language
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

    // 2. Upsert summary record with all 6 sections from source
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

    console.log(`API: [cache] Successfully cloned analysis from ${source.content.id} to ${targetContentId}`)
    return true
  } catch (err) {
    console.error("API: [cache] Clone failed:", err)
    return false
  }
}

// ============================================

interface ProcessContentRequestBody {
  content_id: string
  force_regenerate?: boolean
  language?: string
}

export async function POST(req: NextRequest) {
  // Rate limiting by IP
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown"
  const rateLimit = checkRateLimit(`process:${clientIp}`, 30, 60000) // 30 requests per minute
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) } }
    )
  }

  // Authentication: accept either session auth (browser) or internal service token (server-to-server)
  const authHeader = req.headers.get("authorization")
  const isInternalCall = authHeader === `Bearer ${supabaseKey}`
  let authenticatedUserId: string | null = null

  if (!isInternalCall) {
    // Browser call — require session auth
    const auth = await authenticateRequest()
    if (!auth.success) return auth.response
    authenticatedUserId = auth.user.id
  }

  // Clear prompts cache for fresh prompts each processing batch
  clearPromptsCache()

  const supabase = createClient<Database>(supabaseUrl!, supabaseKey!, { db: { schema: "clarus" } })

  let content_id: string
  let force_regenerate: boolean
  let language: AnalysisLanguage = "en"

  try {
    const body: ProcessContentRequestBody = await req.json()
    force_regenerate = body.force_regenerate || false

    // Validate content_id
    const contentIdValidation = validateContentId(body.content_id)
    if (!contentIdValidation.isValid) {
      return NextResponse.json({ error: contentIdValidation.error || "Invalid content_id" }, { status: 400 })
    }
    content_id = contentIdValidation.sanitized!

    // Validate language parameter
    if (body.language) {
      if (!isValidLanguage(body.language)) {
        return NextResponse.json({ error: "Invalid language code" }, { status: 400 })
      }
      language = body.language
    }

    if (!supabaseUrl || !supabaseKey || !supadataApiKey || !openRouterApiKey || !firecrawlApiKey) {
      return NextResponse.json({ error: "Server configuration error: Missing API keys." }, { status: 500 })
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  console.log(`API: Processing request for content_id: ${content_id}, force_regenerate: ${force_regenerate}, language: ${language}`)

  const { data: content, error: fetchError } = await supabase.from("content").select("*").eq("id", content_id).single()

  if (fetchError || !content) {
    console.error(`API: Error fetching content by ID ${content_id}:`, fetchError)
    return NextResponse.json({ error: "Content not found" }, { status: 404 })
  }

  // Verify ownership for browser calls (internal calls already authorized)
  if (authenticatedUserId && content.user_id !== authenticatedUserId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  console.log(`API: Found content: ${content.url}, type: ${content.type}`)

  // Multi-language tier gating: non-English requires paid tier
  if (language !== "en" && content.user_id) {
    const { data: userData } = await supabase
      .from("users")
      .select("tier, day_pass_expires_at")
      .eq("id", content.user_id)
      .single()
    const userTier = normalizeTier(userData?.tier, userData?.day_pass_expires_at)
    if (!TIER_FEATURES[userTier].multiLanguageAnalysis) {
      return NextResponse.json(
        { error: "Multi-language analysis requires a Starter plan or higher.", upgrade_required: true, tier: userTier },
        { status: 403 }
      )
    }
  }

  // Tier-based usage limit check (skip for regeneration — already counted)
  if (!force_regenerate && content.user_id) {
    const usageField = content.type === "podcast" ? "podcast_analyses_count" as const : "analyses_count" as const
    const usageCheck = await enforceUsageLimit(supabase, content.user_id, usageField)
    if (!usageCheck.allowed) {
      const label = content.type === "podcast" ? "podcast analysis" : "analysis"
      return NextResponse.json(
        { error: `Monthly ${label} limit reached (${usageCheck.limit}). Upgrade your plan for more.`, upgrade_required: true, tier: usageCheck.tier },
        { status: 403 }
      )
    }
  }

  // ============================================
  // CROSS-USER CACHE CHECK
  // If another user already analyzed this URL, clone results instead of re-processing
  // ============================================
  if (!force_regenerate && content.user_id) {
    console.log(`API: [cache] Checking for cached analysis of ${content.url}...`)
    const cached = await findCachedAnalysis(supabase, content.url, language, content.user_id)

    if (cached?.type === "full") {
      // FULL HIT: Clone full_text + summary → return instantly
      const cloneSuccess = await cloneCachedContent(
        supabase,
        content.id,
        content.user_id,
        cached,
        language,
      )

      if (cloneSuccess) {
        // Update domain stats (non-blocking, using cached triage data)
        const cachedTriage = cached.summary.triage as TriageData | null
        const cachedTruthCheck = cached.summary.truth_check as TruthCheckData | null
        if (content.url) {
          updateDomainStats(supabase, content.url, cachedTriage, cachedTruthCheck).catch(
            (err) => console.warn("API: [cache] Domain stats update failed:", err)
          )
        }

        // Clone claims from source content (non-fatal best-effort)
        try {
          const { data: sourceClaims } = await supabase
            .from("claims")
            .select("*")
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
            console.log(`API: [cache] Cloned ${clonedClaims.length} claims`)
          }
        } catch (claimErr) {
          console.warn("API: [cache] Claims clone failed (non-fatal):", claimErr)
        }

        // Increment usage counter (cached results still count toward monthly quota)
        try {
          const usageField = content.type === "podcast" ? "podcast_analyses_count" as const : "analyses_count" as const
          await incrementUsage(supabase, content.user_id, usageField)
        } catch (e) {
          console.error("[usage] Failed to track cached analysis usage:", e)
        }

        // Log cache hit metric
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

        console.log(`API: [cache] Returning cached analysis for content_id: ${content.id}`)
        return NextResponse.json(
          {
            success: true,
            cached: true,
            message: "Content analysis served from cache.",
            content_id: content.id,
            sections_generated: [
              "brief_overview", "triage", "truth_check",
              "action_items", "mid_length_summary", "detailed_summary",
            ].filter((s) => {
              const key = s as keyof typeof cached.summary
              return cached.summary[key] != null
            }),
            language,
          },
          { status: 200 },
        )
      }
      // Clone failed — fall through to normal pipeline
      console.warn("API: [cache] Clone failed, falling back to normal pipeline")
    } else if (cached?.type === "text_only") {
      // TEXT-ONLY HIT: Copy full_text + metadata, skip scraping, run AI analysis
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
        // Update local content object so downstream guards see populated full_text
        Object.assign(content, textOnlyUpdate)
        console.log("API: [cache] Copied full_text from cached source, skipping scrape")
      } else {
        console.warn("API: [cache] Text copy failed, proceeding with normal scrape:", textCopyError)
      }
    }
  }

  try {
    if (content.type === "youtube") {
      const shouldFetchYouTubeMetadata =
        force_regenerate ||
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

      const shouldFetchYouTubeText = !content.full_text || force_regenerate
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
      // Podcast: two-phase pipeline via AssemblyAI
      if (!content.full_text || force_regenerate) {
        if (!assemblyAiApiKey) {
          console.error("API: ASSEMBLYAI_API_KEY not configured")
          return NextResponse.json(
            { success: false, message: "Podcast transcription is not configured.", content_id: content.id },
            { status: 500 },
          )
        }

        // Build webhook URL with optional token for validation
        const appUrl = process.env.NEXT_PUBLIC_APP_URL
          || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
        const tokenParam = process.env.ASSEMBLYAI_WEBHOOK_TOKEN
          ? `?token=${process.env.ASSEMBLYAI_WEBHOOK_TOKEN}`
          : ""
        const webhookUrl = `${appUrl}/api/assemblyai-webhook${tokenParam}`

        console.log(`API: Submitting podcast to AssemblyAI: ${content.url}`)
        const { transcript_id } = await submitPodcastTranscription(
          content.url,
          webhookUrl,
          assemblyAiApiKey,
        )

        // Save transcript ID and set status to transcribing
        await supabase
          .from("content")
          .update({ podcast_transcript_id: transcript_id })
          .eq("id", content.id)

        await updateSummarySection(supabase, content.id, content.user_id!, {
          processing_status: "transcribing",
        }, language)

        console.log(`API: Podcast submitted to AssemblyAI. Transcript ID: ${transcript_id}. Waiting for webhook.`)

        // Return early — the webhook will trigger the AI analysis later
        return NextResponse.json(
          {
            success: true,
            message: "Podcast transcription started. Analysis will begin when transcription completes.",
            content_id: content.id,
            transcript_id,
          },
          { status: 200 },
        )
      }
      // If full_text already exists (webhook filled it), fall through to AI analysis below
    } else if (content.type === "article" || content.type === "pdf" || content.type === "document" || content.type === "x_post") {
      const shouldScrape = force_regenerate || !content.full_text || content.full_text.startsWith("PROCESSING_FAILED::")
      if (shouldScrape) {
        let urlToScrape = content.url
        if (content.type === "x_post") {
          try {
            const urlObject = new URL(content.url)
            if (urlObject.hostname === "x.com") {
              urlObject.hostname = "fixupx.com"
            } else if (urlObject.hostname === "twitter.com") {
              urlObject.hostname = "fxtwitter.com"
            }
            urlToScrape = urlObject.toString()
            console.log(`API: Transformed X/Twitter URL to ${urlToScrape} for scraping.`)
          } catch {
            console.error(`API: Could not parse URL for x_post: ${content.url}`)
          }
        }

        const scrapedData = await scrapeArticle(urlToScrape, firecrawlApiKey, content.user_id, content.id)

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
    const msg = getErrorMessage(error)
    console.error(`API: Final text processing error for content ID ${content.id}:`, msg)
    const failure_reason = `PROCESSING_FAILED::${content.type?.toUpperCase() || "UNKNOWN"}::${msg}`
    await supabase.from("content").update({ full_text: failure_reason }).eq("id", content.id)

    return NextResponse.json(
      { success: false, message: `Content processing failed: ${msg}`, content_id: content.id },
      { status: 200 },
    )
  }

  if (!content.full_text || content.full_text.startsWith("PROCESSING_FAILED::")) {
    console.warn(
      `API: No valid full text available for content ID ${content.id}. Skipping summary generation. Reason: ${content.full_text}`,
    )
    return NextResponse.json(
      { success: true, message: "Content processed, but no valid text found for summary.", content_id: content.id },
      { status: 200 },
    )
  }

  // ============================================
  // CONTENT MODERATION PRE-SCREENING
  // Runs before AI analysis to catch prohibited content
  // ============================================
  const screeningResult = await screenContent({
    url: content.url,
    scrapedText: content.full_text,
    contentId: content.id,
    userId: content.user_id,
    contentType: content.type,
    userIp: clientIp,
  })

  if (screeningResult.blocked) {
    console.warn(`MODERATION: Content blocked for ${content.url} — ${screeningResult.flags.map(f => f.reason).join("; ")}`)

    // Mark content as failed so it doesn't appear in the library as processable
    await supabase.from("content").update({
      full_text: "PROCESSING_FAILED::CONTENT_POLICY_VIOLATION",
    }).eq("id", content.id)

    // Create a summary record marked as refused
    await supabase.from("summaries").upsert({
      content_id: content.id,
      user_id: content.user_id!,
      language,
      processing_status: "refused",
      brief_overview: "This content could not be analyzed because it may violate our content policy.",
      updated_at: new Date().toISOString(),
    }, { onConflict: "content_id,language" })

    return NextResponse.json(
      {
        success: false,
        message: "This content cannot be analyzed because it may contain prohibited material.",
        content_id: content.id,
        content_blocked: true,
      },
      { status: 200 }
    )
  }

  // Paywall detection — warn user if content appears truncated
  const paywallWarning = detectPaywallTruncation(
    content.url,
    content.full_text,
    content.type || "article"
  )
  if (paywallWarning) {
    console.log(`API: Paywall warning for ${content.url}: ${paywallWarning}`)
  }

  // Compute language directive for prompt injection
  const languageDirective = getLanguageDirective(language)

  const responsePayload: {
    success: boolean
    message: string
    content_id: string
    sections_generated: string[]
    modelErrors?: ModelProcessingError[]
    paywall_warning?: string | null
    language?: string
  } = {
    success: true,
    message: "Content processed successfully.",
    content_id: content.id,
    sections_generated: [],
    paywall_warning: paywallWarning,
    language,
  }

  if (!content.user_id) {
    console.error(`API: user_id is missing on content object with id ${content.id}. Cannot save summary.`)
    return NextResponse.json(
      { success: false, message: "Internal error: user_id missing from content.", content_id: content.id },
      { status: 500 },
    )
  }

  // Capture non-null user_id for use in async closures
  const userId = content.user_id
  const contentId = content.id
  const contentUrl = content.url
  const contentType = content.type || "article"
  const fullText = content.full_text

  // Fix title if needed (using existing logic)
  const titleNeedsFixing = !content.title || content.title.startsWith("Processing:") || content.title.startsWith("Analyzing:")

  // ============================================
  // PARALLEL SECTION GENERATION
  // Phase 1: 4 independent sections run simultaneously
  // Phase 2: 2 triage-dependent sections run in parallel
  // Each section saves to DB the instant it finishes
  // ============================================

  console.log(`API: Starting parallel section generation for content_id: ${contentId}`)

  const failedSections: string[] = []

  // Web search context + tone detection (run in parallel — zero added latency)
  console.log(`API: [0/6] Getting web search context + detecting tone in parallel...`)
  const [webSearchContext, toneResult] = await Promise.all([
    getWebSearchContext(fullText.substring(0, 10000), content.title || undefined),
    detectContentTone(fullText, content.title, contentType, userId, contentId),
  ])
  const webContext = webSearchContext?.formattedContext || null
  const toneDirective = toneResult.tone_directive
  if (webContext) {
    console.log(`API: Web search context ready (${webSearchContext?.searches.length} searches)`)
  } else {
    console.log(`API: No web search context available`)
  }
  console.log(`API: Tone detected: "${toneResult.tone_label}" — directive: "${toneDirective.substring(0, 80)}..."`)

  // Persist tone label (non-blocking fire-and-forget)
  if (toneResult.tone_label !== NEUTRAL_TONE_LABEL) {
    supabase.from("content").update({ detected_tone: toneResult.tone_label }).eq("id", contentId).then(
      () => {},
      (err) => console.warn("Failed to persist detected_tone:", err)
    )
  }

  // ============================================
  // ALL SECTIONS: Run everything in parallel
  // overview, triage, truth check, action items, key takeaways, detailed analysis
  // ============================================
  console.log(`API: Starting all 6 analysis sections in parallel...`)

  const overviewPromise = (async () => {
    console.log(`API: [1/6] Generating brief overview...`)
    const result = await generateBriefOverview(fullText, contentType, userId, contentId, webContext, toneDirective, languageDirective)
    if (result) {
      await updateSummarySection(supabase, contentId, userId, { brief_overview: result }, language)
      responsePayload.sections_generated.push("brief_overview")
      console.log(`API: [1/6] Brief overview saved.`)
    } else {
      failedSections.push("brief_overview")
      console.warn(`API: [1/6] Brief overview failed.`)
    }
    return result
  })()

  const triagePromise = (async () => {
    console.log(`API: [2/6] Generating triage...`)
    const result = await generateTriage(fullText, contentType, userId, contentId, webContext, languageDirective)
    if (result) {
      await updateSummarySection(supabase, contentId, userId, { triage: result as unknown as Json }, language)
      responsePayload.sections_generated.push("triage")
      console.log(`API: [2/6] Triage saved.`)
    } else {
      failedSections.push("triage")
      console.warn(`API: [2/6] Triage failed.`)
    }
    return result
  })()

  const midSummaryPromise = (async () => {
    console.log(`API: [5/6] Generating mid-length summary...`)
    const summaryResult = await getModelSummary(fullText, { shouldExtractTitle: titleNeedsFixing, toneDirective, languageDirective })
    if (summaryResult && !("error" in summaryResult)) {
      const validSummary = summaryResult as ModelSummary
      if (titleNeedsFixing && validSummary.title) {
        await supabase.from("content").update({ title: validSummary.title }).eq("id", contentId)
        console.log(`API: [5/6] Title updated from summary.`)
      }
      if (validSummary.mid_length_summary) {
        await updateSummarySection(supabase, contentId, userId, { mid_length_summary: validSummary.mid_length_summary }, language)
        responsePayload.sections_generated.push("mid_length_summary")
        console.log(`API: [5/6] Mid-length summary saved.`)
      }
    } else {
      failedSections.push("mid_length_summary")
      console.warn(`API: [5/6] Mid-length summary failed.`)
    }
    return summaryResult
  })()

  const detailedPromise = (async () => {
    console.log(`API: [6/6] Generating detailed summary...`)
    const result = await generateDetailedSummary(fullText, contentType, userId, contentId, webContext, toneDirective, languageDirective)
    if (result) {
      await updateSummarySection(supabase, contentId, userId, { detailed_summary: result }, language)
      responsePayload.sections_generated.push("detailed_summary")
      console.log(`API: [6/6] Detailed summary saved.`)
    } else {
      failedSections.push("detailed_summary")
      console.warn(`API: [6/6] Detailed summary failed.`)
    }
    return result
  })()

  const autoTagPromise = (async () => {
    console.log(`API: [tags] Generating auto-tags...`)
    const tags = await generateAutoTags(fullText, userId, contentId)
    if (tags && tags.length > 0) {
      await supabase
        .from("content")
        .update({ tags })
        .eq("id", contentId)
      console.log(`API: [tags] Auto-tags saved: ${tags.join(", ")}`)
    } else {
      console.warn(`API: [tags] Auto-tag generation failed or empty.`)
    }
    return tags
  })()

  const truthCheckPromise = (async () => {
    console.log(`API: [3/6] Generating truth check...`)
    const result = await generateTruthCheck(fullText, contentType, userId, contentId, webContext, languageDirective)
    if (result) {
      console.log(`API: [3/6] Truth check generated.`)
    } else {
      console.warn(`API: [3/6] Truth check failed.`)
    }
    return result
  })()

  const actionItemsPromise = (async () => {
    console.log(`API: [4/6] Generating action items...`)
    const result = await generateActionItems(fullText, contentType, userId, contentId, webContext, languageDirective)
    if (result) {
      console.log(`API: [4/6] Action items generated.`)
    } else {
      console.warn(`API: [4/6] Action items failed.`)
    }
    return result
  })()

  // Wait for ALL sections in parallel
  const [briefOverview, triage, , detailedSummary, , truthCheckResult, actionItemsResult] = await Promise.all([
    overviewPromise, triagePromise, midSummaryPromise, detailedPromise, autoTagPromise,
    truthCheckPromise, actionItemsPromise,
  ])

  // Post-check: skip saving truth check + action items for music/entertainment
  const skipCategories = ["music", "entertainment"]
  const triageCategory = triage?.content_category
  const shouldSkipTruthCheck = triageCategory && skipCategories.includes(triageCategory)

  let truthCheck: TruthCheckData | null = null

  if (shouldSkipTruthCheck) {
    console.log(`API: Discarding truth check + action items for ${triageCategory} content`)
  } else {
    if (truthCheckResult) {
      await updateSummarySection(supabase, contentId, userId, { truth_check: truthCheckResult as unknown as Json }, language)
      responsePayload.sections_generated.push("truth_check")
      console.log(`API: [3/6] Truth check saved.`)
    } else {
      failedSections.push("truth_check")
    }

    if (actionItemsResult) {
      await updateSummarySection(supabase, contentId, userId, { action_items: actionItemsResult as unknown as Json }, language)
      responsePayload.sections_generated.push("action_items")
      console.log(`API: [4/6] Action items saved.`)
    }

    truthCheck = truthCheckResult
  }

  // ============================================
  // AI REFUSAL DETECTION (Layer 3)
  // Check if any AI section refused the content
  // ============================================
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
        contentId,
        userId,
        url: contentUrl,
        contentType,
        flag: refusal,
        userIp: clientIp,
        scrapedText: fullText,
      })
      console.warn(`MODERATION: AI refused [${section.name}] for ${contentUrl}: ${refusal.reason}`)
    }
  }

  // Update domain credibility stats
  if (contentUrl && triage) {
    await updateDomainStats(supabase, contentUrl, triage, truthCheck)
    console.log(`API: Domain stats updated for ${contentUrl}`)
  }

  // ============================================
  // CLAIM TRACKING: Extract claims for cross-referencing
  // Non-fatal — wrapped in try/catch
  // ============================================
  if (truthCheck && userId) {
    try {
      // Delete old claims for this content (in case of regeneration)
      await supabase.from("claims").delete().eq("content_id", contentId)

      // Extract claims from truth_check data
      const claimsToInsert: Array<{
        content_id: string
        user_id: string
        claim_text: string
        normalized_text: string
        status: string
        severity: string | null
        sources: Json | null
      }> = []

      // Extract from claims array (inline highlights)
      if (truthCheck.claims && truthCheck.claims.length > 0) {
        for (const claim of truthCheck.claims) {
          if (!claim.exact_text) continue
          claimsToInsert.push({
            content_id: contentId,
            user_id: userId,
            claim_text: claim.exact_text,
            normalized_text: claim.exact_text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim(),
            status: claim.status,
            severity: claim.severity ?? null,
            sources: (claim.sources ?? null) as Json,
          })
        }
      }

      // Extract from issues array
      if (truthCheck.issues && truthCheck.issues.length > 0) {
        for (const issue of truthCheck.issues) {
          if (!issue.claim_or_issue) continue
          claimsToInsert.push({
            content_id: contentId,
            user_id: userId,
            claim_text: issue.claim_or_issue,
            normalized_text: issue.claim_or_issue.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim(),
            status: issue.type,
            severity: issue.severity ?? null,
            sources: null,
          })
        }
      }

      if (claimsToInsert.length > 0) {
        await supabase.from("claims").insert(claimsToInsert)
        console.log(`API: Inserted ${claimsToInsert.length} claims for cross-referencing`)
      }
    } catch (claimErr) {
      console.warn("API: Failed to extract claims (non-fatal):", claimErr)
    }
  }

  // ============================================
  // SELF-HEALING: Retry critical failures once
  // ============================================
  const criticalSections = ["brief_overview", "triage", "detailed_summary"]
  const criticalFailures = failedSections.filter((s) => criticalSections.includes(s))

  if (criticalFailures.length > 0) {
    console.log(`API: RETRY - Retrying ${criticalFailures.length} critical sections: ${criticalFailures.join(", ")}`)

    await Promise.all(criticalFailures.map(async (section) => {
      if (section === "brief_overview") {
        const result = await generateBriefOverview(fullText, contentType, userId, contentId, null, toneDirective, languageDirective)
        if (result) {
          await updateSummarySection(supabase, contentId, userId, { brief_overview: result }, language)
          responsePayload.sections_generated.push("brief_overview")
          console.log(`API: RETRY SUCCESS - Brief overview saved.`)
        }
      } else if (section === "triage") {
        const result = await generateTriage(fullText, contentType, userId, contentId, undefined, languageDirective)
        if (result) {
          await updateSummarySection(supabase, contentId, userId, { triage: result as unknown as Json }, language)
          responsePayload.sections_generated.push("triage")
          console.log(`API: RETRY SUCCESS - Triage saved.`)
          if (contentUrl) await updateDomainStats(supabase, contentUrl, result, truthCheck)
        }
      } else if (section === "detailed_summary") {
        const result = await generateDetailedSummary(fullText, contentType, userId, contentId, null, toneDirective, languageDirective)
        if (result) {
          await updateSummarySection(supabase, contentId, userId, { detailed_summary: result }, language)
          responsePayload.sections_generated.push("detailed_summary")
          console.log(`API: RETRY SUCCESS - Detailed summary saved.`)
        }
      }
    }))
  }

  // Mark processing complete
  await updateSummarySection(supabase, contentId, userId, {
    processing_status: "complete",
  }, language)

  // Update content.analysis_language (non-blocking)
  supabase.from("content").update({ analysis_language: language }).eq("id", contentId).then(
    () => {},
    (err) => console.warn("Failed to update analysis_language:", err)
  )

  // Log final status
  const finalFailures = []
  if (!briefOverview) finalFailures.push("brief_overview")
  if (!triage) finalFailures.push("triage")
  if (!detailedSummary) finalFailures.push("detailed_summary")

  if (finalFailures.length > 0) {
    console.warn(`API: Processing complete with ${finalFailures.length} critical sections missing: ${finalFailures.join(", ")}`)
  }

  console.log(`API: Processing complete for content_id: ${content_id}. Sections generated: ${responsePayload.sections_generated.join(", ")}`)

  // Track analysis usage (non-fatal)
  if (!force_regenerate && content.user_id) {
    try {
      const usageField = content.type === "podcast" ? "podcast_analyses_count" as const : "analyses_count" as const
      await incrementUsage(supabase, content.user_id, usageField)
    } catch (e) {
      console.error("[usage] Failed to track analysis usage:", e)
    }
  }

  return NextResponse.json(responsePayload, { status: 200 })
}

import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import type { Database, Json, Tables, TriageData, TruthCheckData, ActionItemsData } from "@/types/database.types"
import { validateContentId, checkRateLimit } from "@/lib/validation"
import { logApiUsage, logProcessingMetrics, createTimer } from "@/lib/api-usage"
import { enforceUsageLimit, incrementUsage } from "@/lib/usage"

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
        model: "anthropic/claude-3-haiku", // Fast and cheap
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

// Search a single topic with Tavily
async function searchTavily(query: string): Promise<WebSearchResult | null> {
  if (!tavilyApiKey) return null

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
      console.warn(`API: Tavily search failed for "${query}"`)
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
      metadata: { query, resultsCount: data.results?.length || 0 },
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
    console.warn(`API: Tavily search error for "${query}":`, error)
    return null
  }
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
      const response = await fetch(endpoint, {
        headers: { "x-api-key": apiKey },
      })

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
      const response = await fetch(endpoint, {
        headers: { "x-api-key": apiKey },
      })

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
  options: { shouldExtractTitle?: boolean } = {},
): Promise<ModelSummary | ModelProcessingError> {
  const { shouldExtractTitle = false } = options

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

  const openRouterModelId = model_name || "anthropic/claude-3.5-sonnet"
  const finalUserPrompt = (user_content_template || "{{TEXT_TO_SUMMARIZE}}").replace(
    "{{TEXT_TO_SUMMARIZE}}",
    textToSummarize,
  )

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

async function generateBriefOverview(fullText: string, userId?: string | null, contentId?: string | null, webContext?: string | null): Promise<string | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 15000), "brief_overview", undefined, 3, userId, contentId, webContext)
  if (result.error) {
    console.error(`API: Brief overview generation failed: ${result.error}`)
    return null
  }
  return typeof result.content === "string" ? result.content : null
}

async function generateTriage(fullText: string, userId?: string | null, contentId?: string | null, webContext?: string | null): Promise<TriageData | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 15000), "triage", undefined, 3, userId, contentId, webContext)
  if (result.error) {
    console.error(`API: Triage generation failed: ${result.error}`)
    return null
  }
  return result.content as TriageData
}

async function generateTruthCheck(fullText: string, userId?: string | null, contentId?: string | null, webContext?: string | null): Promise<TruthCheckData | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 20000), "truth_check", undefined, 3, userId, contentId, webContext)
  if (result.error) {
    console.error(`API: Truth check generation failed: ${result.error}`)
    return null
  }
  return result.content as TruthCheckData
}

async function generateActionItems(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null): Promise<ActionItemsData | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 20000), "action_items", contentType, 3, userId, contentId, webContext)
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

async function generateDetailedSummary(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null): Promise<string | null> {
  // Now uses database prompt with {{CONTENT}} and {{TYPE}} placeholders
  const result = await generateSectionWithAI(fullText.substring(0, 30000), "detailed_summary", contentType, 3, userId, contentId, webContext)
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
) {
  const { error } = await supabase
    .from("summaries")
    .upsert(
      {
        content_id: contentId,
        user_id: userId,
        updated_at: new Date().toISOString(),
        ...updates,
      },
      { onConflict: "content_id" },
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

interface ProcessContentRequestBody {
  content_id: string
  force_regenerate?: boolean
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

  // Clear prompts cache for fresh prompts each processing batch
  clearPromptsCache()

  const supabase = createClient<Database>(supabaseUrl!, supabaseKey!, { db: { schema: "clarus" } })

  let content_id: string
  let force_regenerate: boolean

  try {
    const body: ProcessContentRequestBody = await req.json()
    force_regenerate = body.force_regenerate || false

    // Validate content_id
    const contentIdValidation = validateContentId(body.content_id)
    if (!contentIdValidation.isValid) {
      return NextResponse.json({ error: contentIdValidation.error || "Invalid content_id" }, { status: 400 })
    }
    content_id = contentIdValidation.sanitized!

    if (!supabaseUrl || !supabaseKey || !supadataApiKey || !openRouterApiKey || !firecrawlApiKey) {
      return NextResponse.json({ error: "Server configuration error: Missing API keys." }, { status: 500 })
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  console.log(`API: Processing request for content_id: ${content_id}, force_regenerate: ${force_regenerate}`)

  const { data: content, error: fetchError } = await supabase.from("content").select("*").eq("id", content_id).single()

  if (fetchError || !content) {
    console.error(`API: Error fetching content by ID ${content_id}:`, fetchError)
    return NextResponse.json({ error: `Content with ID ${content_id} not found or error fetching.` }, { status: 404 })
  }

  console.log(`API: Found content: ${content.url}, type: ${content.type}`)

  // Tier-based usage limit check (skip for regeneration — already counted)
  if (!force_regenerate && content.user_id) {
    const usageCheck = await enforceUsageLimit(supabase, content.user_id, "analyses_count")
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: `Monthly analysis limit reached (${usageCheck.limit}). Upgrade your plan for more.`, upgrade_required: true, tier: usageCheck.tier },
        { status: 403 }
      )
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

  const responsePayload: {
    success: boolean
    message: string
    content_id: string
    sections_generated: string[]
    modelErrors?: ModelProcessingError[]
  } = {
    success: true,
    message: "Content processed successfully.",
    content_id: content.id,
    sections_generated: [],
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

  // Web search context (run once, shared across all sections)
  console.log(`API: [0/6] Getting web search context...`)
  const webSearchContext = await getWebSearchContext(fullText.substring(0, 10000), content.title || undefined)
  const webContext = webSearchContext?.formattedContext || null
  if (webContext) {
    console.log(`API: Web search context ready (${webSearchContext?.searches.length} searches)`)
  } else {
    console.log(`API: No web search context available`)
  }

  // ============================================
  // PHASE 1: 4 independent sections in parallel
  // overview, triage, key takeaways, detailed analysis
  // ============================================
  console.log(`API: [Phase 1] Starting overview, triage, key takeaways, detailed analysis in parallel...`)

  const overviewPromise = (async () => {
    console.log(`API: [1/6] Generating brief overview...`)
    const result = await generateBriefOverview(fullText, userId, contentId, webContext)
    if (result) {
      await updateSummarySection(supabase, contentId, userId, { brief_overview: result })
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
    const result = await generateTriage(fullText, userId, contentId, webContext)
    if (result) {
      await updateSummarySection(supabase, contentId, userId, { triage: result as unknown as Json })
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
    const summaryResult = await getModelSummary(fullText, { shouldExtractTitle: titleNeedsFixing })
    if (summaryResult && !("error" in summaryResult)) {
      const validSummary = summaryResult as ModelSummary
      if (titleNeedsFixing && validSummary.title) {
        await supabase.from("content").update({ title: validSummary.title }).eq("id", contentId)
        console.log(`API: [5/6] Title updated from summary.`)
      }
      if (validSummary.mid_length_summary) {
        await updateSummarySection(supabase, contentId, userId, { mid_length_summary: validSummary.mid_length_summary })
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
    const result = await generateDetailedSummary(fullText, contentType, userId, contentId, webContext)
    if (result) {
      await updateSummarySection(supabase, contentId, userId, { detailed_summary: result })
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

  // Wait for all Phase 1 sections
  const [briefOverview, triage, , detailedSummary] = await Promise.all([
    overviewPromise, triagePromise, midSummaryPromise, detailedPromise, autoTagPromise,
  ])

  // ============================================
  // PHASE 2: Triage-dependent sections in parallel
  // truth check + action items (skip for music/entertainment)
  // ============================================
  const skipCategories = ["music", "entertainment"]
  const triageCategory = triage?.content_category
  const shouldSkipPhase2 = triageCategory && skipCategories.includes(triageCategory)

  let truthCheck: TruthCheckData | null = null

  if (shouldSkipPhase2) {
    console.log(`API: [Phase 2] Skipping truth check + action items for ${triageCategory} content`)
  } else {
    console.log(`API: [Phase 2] Starting truth check + action items in parallel...`)

    const [truthResult] = await Promise.all([
      (async () => {
        console.log(`API: [3/6] Generating truth check...`)
        const result = await generateTruthCheck(fullText, userId, contentId, webContext)
        if (result) {
          await updateSummarySection(supabase, contentId, userId, { truth_check: result as unknown as Json })
          responsePayload.sections_generated.push("truth_check")
          console.log(`API: [3/6] Truth check saved.`)
        } else {
          failedSections.push("truth_check")
          console.warn(`API: [3/6] Truth check failed.`)
        }
        return result
      })(),
      (async () => {
        console.log(`API: [4/6] Generating action items...`)
        const result = await generateActionItems(fullText, contentType, userId, contentId, webContext)
        if (result) {
          await updateSummarySection(supabase, contentId, userId, { action_items: result as unknown as Json })
          responsePayload.sections_generated.push("action_items")
          console.log(`API: [4/6] Action items saved.`)
        } else {
          console.warn(`API: [4/6] Action items failed.`)
        }
        return result
      })(),
    ])

    truthCheck = truthResult
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
        const result = await generateBriefOverview(fullText, userId, contentId)
        if (result) {
          await updateSummarySection(supabase, contentId, userId, { brief_overview: result })
          responsePayload.sections_generated.push("brief_overview")
          console.log(`API: RETRY SUCCESS - Brief overview saved.`)
        }
      } else if (section === "triage") {
        const result = await generateTriage(fullText, userId, contentId)
        if (result) {
          await updateSummarySection(supabase, contentId, userId, { triage: result as unknown as Json })
          responsePayload.sections_generated.push("triage")
          console.log(`API: RETRY SUCCESS - Triage saved.`)
          if (contentUrl) await updateDomainStats(supabase, contentUrl, result, truthCheck)
        }
      } else if (section === "detailed_summary") {
        const result = await generateDetailedSummary(fullText, contentType, userId, contentId)
        if (result) {
          await updateSummarySection(supabase, contentId, userId, { detailed_summary: result })
          responsePayload.sections_generated.push("detailed_summary")
          console.log(`API: RETRY SUCCESS - Detailed summary saved.`)
        }
      }
    }))
  }

  // Mark processing complete
  await updateSummarySection(supabase, contentId, userId, {
    processing_status: "complete",
  })

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
      await incrementUsage(supabase, content.user_id, "analyses_count")
    } catch (e) {
      console.error("[usage] Failed to track analysis usage:", e)
    }
  }

  return NextResponse.json(responsePayload, { status: 200 })
}

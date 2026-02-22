/**
 * @module lib/pipeline/ai-sections
 * @description AI-powered section generation for content analysis.
 * Includes the summarizer, section generator, and all individual section generators
 * (brief overview, triage, truth check, action items, detailed summary, auto-tags).
 */

import { createClient } from "@supabase/supabase-js"
import type { Database, TriageData, TruthCheckData, ActionItemsData, TopicSegmentData } from "@/types/database.types"
import { logApiUsage, logProcessingMetrics, createTimer } from "@/lib/api-usage"
import { sanitizeForPrompt, wrapUserContent, INSTRUCTION_ANCHOR, detectOutputLeakage } from "@/lib/prompt-sanitizer"
import { parseAiResponseOrThrow } from "@/lib/ai-response-parser"
import { logger } from "@/lib/logger"
import { getErrorMessage, getErrorName, AI_CALL_TIMEOUT_MS } from "./types"
import { fetchPromptFromDB } from "./web-search"
import type { WebSearchContext, ClaimSearchContext } from "./web-search"
import { NEUTRAL_TONE_DIRECTIVE } from "./tone-detection"

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const openRouterApiKey = process.env.OPENROUTER_API_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// ============================================
// INTERFACES
// ============================================

export interface ModelSummary {
  mid_length_summary: string | null
  title?: string | null
}

export interface ModelProcessingError {
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

export interface SectionGenerationResult {
  content: unknown
  error?: string
}

// ============================================
// SUMMARIZER
// ============================================

export async function getModelSummary(
  textToSummarize: string,
  options: { shouldExtractTitle?: boolean; toneDirective?: string | null; languageDirective?: string | null; metadataBlock?: string | null; typeInstructions?: string | null; contentType?: string } = {},
): Promise<ModelSummary | ModelProcessingError> {
  const { shouldExtractTitle = false, toneDirective, languageDirective, metadataBlock, typeInstructions, contentType } = options

  if (!openRouterApiKey) {
    const msg = "OpenRouter API key is not configured."
    logger.error(msg)
    return { error: true, modelName: "N/A", reason: "ClientNotInitialized", finalErrorMessage: msg }
  }
  if (!supabaseUrl || !supabaseKey) {
    const msg = "Supabase URL or Key not configured for fetching prompt in getModelSummary."
    logger.error(msg)
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
    logger.error(msg)
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

  const maxRetries = 3
  let lastError = ""

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
        lastError = `OpenRouter API Error (${response.status}): ${errorBody.substring(0, 200)}`
        logger.warn(`API: [summarizer] Attempt ${attempt}/${maxRetries} failed: ${lastError}`)
        if (attempt < maxRetries) continue
        return { error: true, modelName: openRouterModelId, reason: `APIError_${response.status}`, finalErrorMessage: lastError }
      }

      const result = await response.json()
      const rawContent = result.choices[0]?.message?.content

      if (!rawContent) {
        lastError = "OpenRouter response missing message content."
        logger.warn(`API: [summarizer] Attempt ${attempt}/${maxRetries}: ${lastError}`)
        if (attempt < maxRetries) continue
        return { error: true, modelName: openRouterModelId, reason: "InvalidResponse", finalErrorMessage: lastError }
      }

      if (typeof rawContent === "string") {
        detectOutputLeakage(rawContent, "summarizer")
      }

      let parsedContent: ParsedModelSummaryResponse
      try {
        parsedContent = parseAiResponseOrThrow<ParsedModelSummaryResponse>(rawContent, "summarizer")
      } catch (parseError: unknown) {
        lastError = `Failed to parse JSON: ${getErrorMessage(parseError)}`
        logger.warn(`API: [summarizer] Attempt ${attempt}/${maxRetries}: ${lastError}`)
        if (attempt < maxRetries) continue
        return { error: true, modelName: openRouterModelId, reason: "JSONParseFailed", finalErrorMessage: lastError }
      }

      const summary: ModelSummary = {
        mid_length_summary: parsedContent.mid_length_summary || null,
      }
      if (shouldExtractTitle) {
        summary.title = parsedContent.title || null
      }

      if (attempt > 1) {
        logger.info(`API: [summarizer] Succeeded on attempt ${attempt}/${maxRetries}`)
      }

      return summary
    } catch (error: unknown) {
      const isTimeout = getErrorName(error) === "AbortError"
      lastError = isTimeout ? "Request timed out" : getErrorMessage(error)
      logger.warn(`API: [summarizer] Attempt ${attempt}/${maxRetries} ${isTimeout ? "timed out" : "failed"}: ${lastError}`)
      if (attempt < maxRetries) continue
      return {
        error: true,
        modelName: openRouterModelId,
        reason: isTimeout ? "Timeout" : "RequestFailed",
        finalErrorMessage: lastError,
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  return { error: true, modelName: openRouterModelId, reason: "ExhaustedRetries", finalErrorMessage: lastError }
}

// ============================================
// SECTION GENERATION
// ============================================

export async function generateSectionWithAI(
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
        logger.warn(`API: [${promptType}] Attempt ${attempt} failed: HTTP ${response.status} — ${errorBody.substring(0, 200)}`)
        lastError = "AI analysis service returned an error"
        retryCount++

        // 429 = rate limited — retry with longer backoff
        if (response.status === 429) {
          if (attempt < maxRetries) {
            const delay = 10000 * Math.pow(2, attempt - 1)
            logger.warn(`API: [${promptType}] Rate limited (429), retrying in ${delay / 1000}s...`)
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
        logger.warn(`API: [${promptType}] Attempt ${attempt} failed: ${lastError}`)
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
          logger.warn(`API: [${promptType}] Attempt ${attempt} JSON parse error:`, parseError)
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
      logger.warn(`API: [${promptType}] Attempt ${attempt} failed: ${lastError}`)
      retryCount++

      if (attempt < maxRetries) {
        const delay = 5000 * Math.pow(2, attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  logger.error(`API: [${promptType}] All ${maxRetries} attempts failed. Last error: ${lastError}`)

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

// ============================================
// INDIVIDUAL SECTION GENERATORS
// ============================================

export async function generateBriefOverview(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, toneDirective?: string | null, languageDirective?: string | null, metadataBlock?: string | null, typeInstructions?: string | null): Promise<string | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 8000), "brief_overview", contentType, 3, userId, contentId, webContext, toneDirective, languageDirective, undefined, metadataBlock, typeInstructions)
  if (result.error) {
    logger.error(`API: Brief overview generation failed: ${result.error}`)
    return null
  }
  return typeof result.content === "string" ? result.content : null
}

export async function generateTriage(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, languageDirective?: string | null, preferencesBlock?: string | null, metadataBlock?: string | null, typeInstructions?: string | null): Promise<TriageData | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 10000), "triage", contentType, 3, userId, contentId, webContext, undefined, languageDirective, preferencesBlock, metadataBlock, typeInstructions)
  if (result.error) {
    logger.error(`API: Triage generation failed: ${result.error}`)
    return null
  }
  return result.content as TriageData
}

export async function generateTruthCheck(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, languageDirective?: string | null, webSearchContext?: WebSearchContext | null, preferencesBlock?: string | null, claimContext?: string | null, claimSearchCtx?: ClaimSearchContext | null, metadataBlock?: string | null, typeInstructions?: string | null, domainCredibility?: string | null): Promise<TruthCheckData | null> {
  const citationInstruction = `\n\nIMPORTANT: For each issue you identify, include a "sources" array with citation objects containing "url" and "title" for verification. Use URLs from the web verification context above when available. Format: "sources": [{"url": "https://...", "title": "Source Title"}]. If no source URL is available for an issue, omit the sources field for that issue.`

  // Combine domain credibility warning + generic web context + targeted claim context, capped at 8K
  const rawCombinedContext = (domainCredibility ? domainCredibility + "\n\n" : "") + (webContext || "") + (claimContext || "")
  const combinedContext = rawCombinedContext.length > 8000 ? rawCombinedContext.substring(0, 8000) : rawCombinedContext
  const enrichedWebContext = combinedContext ? combinedContext + citationInstruction : null

  const result = await generateSectionWithAI(fullText.substring(0, 20000), "truth_check", contentType, 3, userId, contentId, enrichedWebContext, undefined, languageDirective, preferencesBlock, metadataBlock, typeInstructions)
  if (result.error) {
    logger.error(`API: Truth check generation failed: ${result.error}`)
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

export async function generateActionItems(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, languageDirective?: string | null, preferencesBlock?: string | null, metadataBlock?: string | null, typeInstructions?: string | null): Promise<ActionItemsData | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 15000), "action_items", contentType, 3, userId, contentId, webContext, undefined, languageDirective, preferencesBlock, metadataBlock, typeInstructions)
  if (result.error) {
    logger.error(`API: Action items generation failed: ${result.error}`)
    return null
  }
  const content = result.content as { action_items?: ActionItemsData } | ActionItemsData | null
  if (content && typeof content === "object" && "action_items" in content && content.action_items) {
    return content.action_items
  }
  return content as ActionItemsData
}

export async function generateDetailedSummary(fullText: string, contentType: string, userId?: string | null, contentId?: string | null, webContext?: string | null, toneDirective?: string | null, languageDirective?: string | null, preferencesBlock?: string | null, metadataBlock?: string | null, typeInstructions?: string | null): Promise<string | null> {
  const result = await generateSectionWithAI(fullText.substring(0, 30000), "detailed_summary", contentType, 3, userId, contentId, webContext, toneDirective, languageDirective, preferencesBlock, metadataBlock, typeInstructions)
  if (result.error) {
    logger.error(`API: Detailed summary generation failed: ${result.error}`)
    return null
  }
  return typeof result.content === "string" ? result.content : null
}

export async function generateAutoTags(
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
    logger.error(`API: Auto-tag generation failed: ${result.error}`)
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

export async function generateTopicSegments(
  fullText: string,
  contentType: string,
  userId?: string | null,
  contentId?: string | null,
  languageDirective?: string | null,
  metadataBlock?: string | null,
): Promise<TopicSegmentData[] | null> {
  const result = await generateSectionWithAI(
    fullText.substring(0, 30000),
    "topic_segments",
    contentType,
    2,
    userId,
    contentId,
    undefined,
    undefined,
    languageDirective,
    undefined,
    metadataBlock,
    undefined,
  )
  if (result.error) {
    logger.error(`API: Topic segments generation failed: ${result.error}`)
    return null
  }

  const content = result.content as { segments?: TopicSegmentData[] } | TopicSegmentData[] | null
  if (!content) return null

  // Handle both { segments: [...] } and direct array shapes
  const segments = Array.isArray(content) ? content : content.segments
  if (!segments || !Array.isArray(segments)) return null

  // Validate and clean each segment
  return segments
    .filter((s): s is TopicSegmentData =>
      typeof s === "object" &&
      s !== null &&
      typeof s.title === "string" &&
      typeof s.start_time === "string" &&
      typeof s.end_time === "string" &&
      typeof s.summary === "string"
    )
    .slice(0, 12) // Cap at 12 segments
}

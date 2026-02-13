/**
 * @module lib/pipeline/tone-detection
 * @description Detects the tone of content using AI analysis, producing a tone label
 * and directive that guides subsequent analysis sections to match the content's voice.
 */

import { logApiUsage, createTimer } from "@/lib/api-usage"
import { sanitizeForPrompt, wrapUserContent, INSTRUCTION_ANCHOR } from "@/lib/prompt-sanitizer"
import { parseAiResponseOrThrow } from "@/lib/ai-response-parser"
import { logger } from "@/lib/logger"
import { getErrorMessage } from "./types"
import { fetchPromptFromDB } from "./web-search"

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const openRouterApiKey = process.env.OPENROUTER_API_KEY

// ============================================
// CONSTANTS
// ============================================

export const NEUTRAL_TONE_DIRECTIVE = "The content uses a standard informational tone. Write your analysis in a clear, neutral voice."
export const NEUTRAL_TONE_LABEL = "neutral"

// ============================================
// INTERFACES
// ============================================

export interface ToneDetectionResult {
  tone_label: string
  tone_directive: string
}

// ============================================
// TONE DETECTION
// ============================================

export async function detectContentTone(
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
      logger.warn(`API: [tone_detection] HTTP ${response.status}`)
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
    logger.warn(`API: [tone_detection] Failed (non-fatal): ${msg}`)

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

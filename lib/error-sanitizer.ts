/**
 * @module error-sanitizer
 * @description Error classification and user-facing message generation.
 *
 * Prevents information disclosure by mapping raw vendor error strings
 * (which may contain API keys, internal URLs, or stack traces) to a
 * closed set of generic categories before they reach the database or
 * API responses.
 *
 * Two-layer approach:
 * 1. Throw sites use {@link NonRetryableError} for known 4xx errors
 * 2. {@link classifyError} acts as a catch-all for anything that slips through
 *
 * @see {@link lib/auth.ts} AuthErrors for HTTP response factories
 */

/**
 * Custom error class for 4xx (non-retryable) vendor errors.
 *
 * Replaces fragile `msg.includes("Client Error")` string checks
 * with proper type discrimination via `instanceof`. When caught,
 * these errors should be returned to the user without retry.
 *
 * @example
 * ```ts
 * if (response.status === 404) {
 *   throw new NonRetryableError("Content not found on remote server")
 * }
 * ```
 */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NonRetryableError"
  }
}

/**
 * The closed set of error categories used across the application.
 * Each category maps to a user-friendly message via {@link getUserFriendlyError}.
 */
export type ErrorCategory =
  | "SCRAPE_FAILED"
  | "TRANSCRIPT_FAILED"
  | "METADATA_FAILED"
  | "TRANSCRIPTION_FAILED"
  | "TRANSCRIPTION_EMPTY"
  | "OCR_FAILED"
  | "AI_ANALYSIS_FAILED"
  | "RATE_LIMITED"
  | "CONTENT_UNAVAILABLE"
  | "TIMEOUT"
  | "CONTENT_POLICY_VIOLATION"
  | "MUSIC_CONTENT"
  | "UNKNOWN"

/**
 * Maps a raw error message to a generic {@link ErrorCategory}.
 *
 * Acts as a catch-all safety net: even if a throw site forgets to
 * classify an error, this function prevents raw vendor text from
 * reaching the user. Pattern matching is case-insensitive and
 * checks for common vendor-specific keywords.
 *
 * @param rawMessage - The unfiltered error message string
 * @returns The most specific matching {@link ErrorCategory}, or `"UNKNOWN"`
 *
 * @example
 * ```ts
 * const category = classifyError(error.message)
 * const userMsg = getUserFriendlyError("ARTICLE", category)
 * ```
 */
export function classifyError(rawMessage: string): ErrorCategory {
  const msg = rawMessage.toLowerCase()

  // Rate limiting (any vendor)
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("limit-exceeded") || msg.includes("too many")) {
    return "RATE_LIMITED"
  }

  // Timeouts
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("aborterror") || msg.includes("aborted")) {
    return "TIMEOUT"
  }

  // Content unavailable (403/404)
  if (msg.includes("unavailable") || msg.includes("not found") || msg.includes("private") || msg.includes("restricted")) {
    return "CONTENT_UNAVAILABLE"
  }

  // Music content rejection
  if (msg.includes("music content") || msg.includes("music_content")) {
    return "MUSIC_CONTENT"
  }

  // Firecrawl / scraping
  if (msg.includes("firecrawl") || msg.includes("scrape") || msg.includes("article content")) {
    return "SCRAPE_FAILED"
  }

  // Supadata transcript
  if (msg.includes("transcript")) {
    return "TRANSCRIPT_FAILED"
  }

  // Supadata metadata
  if (msg.includes("metadata")) {
    return "METADATA_FAILED"
  }

  // Deepgram transcription
  if (msg.includes("transcription")) {
    return "TRANSCRIPTION_FAILED"
  }

  // OCR
  if (msg.includes("ocr")) {
    return "OCR_FAILED"
  }

  // OpenRouter / AI analysis
  if (msg.includes("openrouter") || msg.includes("ai analysis") || msg.includes("analysis service")) {
    return "AI_ANALYSIS_FAILED"
  }

  return "UNKNOWN"
}

/**
 * Generates a user-friendly error message from a content type and error category.
 *
 * Messages are intentionally vague about internal implementation details
 * while being specific enough to help users understand what went wrong
 * and what they can do about it.
 *
 * @param contentType - The content type string (e.g., `"YOUTUBE"`, `"ARTICLE"`, `"PODCAST"`)
 * @param errorCategory - An {@link ErrorCategory} string (from {@link classifyError})
 * @returns A plain-English message suitable for display in the UI
 */
export function getUserFriendlyError(contentType: string, errorCategory: string): string {
  const typeLabel: Record<string, string> = {
    YOUTUBE: "video",
    ARTICLE: "article",
    PODCAST: "podcast",
    PDF: "document",
    DOCUMENT: "document",
    X_POST: "post",
    TRANSCRIPTION: "podcast",
  }

  const label = typeLabel[contentType] || "content"

  const messages: Record<string, string> = {
    SCRAPE_FAILED: `We couldn't extract the ${label} content. It may be behind a login or paywall.`,
    TRANSCRIPT_FAILED: `We couldn't retrieve the transcript. The ${label} may not have captions available.`,
    METADATA_FAILED: `We couldn't access this ${label}'s details. It may be private or unavailable.`,
    TRANSCRIPTION_FAILED: `Transcription failed. The audio may be too short or in an unsupported format.`,
    TRANSCRIPTION_EMPTY: `The transcription completed but no speech was detected.`,
    OCR_FAILED: `We couldn't extract text from this document.`,
    AI_ANALYSIS_FAILED: `Our analysis service encountered an error. Please try regenerating.`,
    RATE_LIMITED: `Our service is temporarily busy. Please try again in a few minutes.`,
    TIMEOUT: `Processing took too long. Please try again.`,
    CONTENT_UNAVAILABLE: `This ${label} appears to be unavailable or restricted.`,
    CONTENT_POLICY_VIOLATION: `This content could not be processed due to our content policy.`,
    MUSIC_CONTENT: `This appears to be primarily music content. Clarus analyzes spoken and written content — music videos, concerts, and albums don't have enough dialogue to analyze.`,
  }

  return messages[errorCategory] || `Something went wrong processing this ${label}. Please try again.`
}

/**
 * Error sanitization utilities.
 *
 * Prevents information disclosure by mapping raw vendor errors
 * to a closed set of generic categories before they reach the
 * database or API responses.
 */

// Custom error class for 4xx (non-retryable) vendor errors.
// Replaces fragile `msg.includes("Client Error")` string checks
// with proper type discrimination via `instanceof`.
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NonRetryableError"
  }
}

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
  | "UNKNOWN"

/**
 * Maps a raw error message to a generic category.
 * Used as Layer 2 — even if a throw site is missed, this
 * catch-all prevents raw vendor text from reaching users.
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

  // AssemblyAI transcription
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
 * Maps (contentType, errorCategory) → plain-English message.
 * Used for API responses and frontend display.
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
  }

  return messages[errorCategory] || `Something went wrong processing this ${label}. Please try again.`
}

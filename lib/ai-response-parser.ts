/**
 * Robust AI response parser for OpenRouter/LLM JSON outputs.
 *
 * Handles common failure modes:
 * - Markdown code fences (```json ... ```)
 * - Leading/trailing non-JSON text ("Here is the JSON:\n{...}")
 * - Truncated responses (missing closing brackets/braces)
 * - Multiple JSON blocks (picks the first valid one)
 */

import { logger } from "@/lib/logger"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParseSuccess<T> {
  success: true
  data: T
  /** true when the raw string needed cleanup before it would parse */
  usedFallback: boolean
}

interface ParseFailure {
  success: false
  error: string
  /** the raw string that could not be parsed */
  raw: string
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Strip markdown fenced code blocks: ```json ... ``` or ``` ... ``` */
function stripMarkdownFences(raw: string): string | null {
  // Match ```json ... ``` or ```JSON ... ``` or ``` ... ```
  const fenceMatch = raw.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```/)
  return fenceMatch?.[1]?.trim() ?? null
}

/**
 * Find the outermost JSON object or array in a string by locating the first
 * `{` or `[` and then scanning forward to find the balanced closing delimiter.
 * This is intentionally simple — it ignores strings containing braces, but
 * that is good enough for the common case where the model wraps its JSON in
 * prose like "Sure! Here is the result:\n{...}\nLet me know if..."
 */
function extractJsonSubstring(raw: string): string | null {
  const startObj = raw.indexOf("{")
  const startArr = raw.indexOf("[")

  // Pick whichever comes first, skipping -1 values
  let startIdx: number
  let openChar: string
  let closeChar: string

  if (startObj === -1 && startArr === -1) return null

  if (startArr === -1 || (startObj !== -1 && startObj < startArr)) {
    startIdx = startObj
    openChar = "{"
    closeChar = "}"
  } else {
    startIdx = startArr
    openChar = "["
    closeChar = "]"
  }

  let depth = 0
  let inString = false
  let escapeNext = false

  for (let i = startIdx; i < raw.length; i++) {
    const ch = raw[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (ch === "\\") {
      escapeNext = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === openChar) depth++
    else if (ch === closeChar) depth--

    if (depth === 0) {
      return raw.substring(startIdx, i + 1)
    }
  }

  // If we reach here the JSON is truncated — return what we have so we can
  // attempt bracket repair below
  return raw.substring(startIdx)
}

/**
 * Attempt to repair truncated JSON by closing open brackets/braces and
 * string literals. This is a best-effort heuristic that handles the most
 * common truncation case — the model ran out of tokens mid-object.
 */
function repairTruncatedJson(raw: string): string {
  let repaired = raw.trimEnd()

  // Remove a trailing comma that would make the JSON invalid
  repaired = repaired.replace(/,\s*$/, "")

  // If we're inside a string (odd number of unescaped quotes), close it
  let quoteCount = 0
  let escaped = false
  for (const ch of repaired) {
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === "\\") {
      escaped = true
      continue
    }
    if (ch === '"') quoteCount++
  }
  if (quoteCount % 2 !== 0) {
    repaired += '"'
  }

  // Count open/close brackets and braces
  let braces = 0
  let brackets = 0
  let inStr = false
  let esc = false

  for (const ch of repaired) {
    if (esc) {
      esc = false
      continue
    }
    if (ch === "\\") {
      esc = true
      continue
    }
    if (ch === '"') {
      inStr = !inStr
      continue
    }
    if (inStr) continue
    if (ch === "{") braces++
    else if (ch === "}") braces--
    else if (ch === "[") brackets++
    else if (ch === "]") brackets--
  }

  // Close any remaining open brackets/braces (inner first)
  for (let i = 0; i < brackets; i++) repaired += "]"
  for (let i = 0; i < braces; i++) repaired += "}"

  return repaired
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an AI model response that is expected to be JSON.
 *
 * Tries, in order:
 * 1. Direct `JSON.parse` on the trimmed string
 * 2. Extract content from markdown code fences and parse
 * 3. Extract the first JSON object/array substring and parse
 * 4. Repair truncated JSON (close open brackets) and parse
 *
 * @param raw - The raw string returned by the AI model
 * @returns A discriminated union: `{ success: true, data, usedFallback }` or `{ success: false, error, raw }`
 */
export function parseAiResponse<T>(raw: string): ParseResult<T> {
  if (!raw || typeof raw !== "string") {
    return { success: false, error: "Empty or non-string input", raw: String(raw ?? "") }
  }

  const trimmed = raw.trim()

  // 1. Direct parse — the happy path when the model returns clean JSON
  try {
    const data = JSON.parse(trimmed) as T
    return { success: true, data, usedFallback: false }
  } catch {
    // Fall through to fallback strategies
  }

  // 2. Markdown code fences
  const fenceContent = stripMarkdownFences(trimmed)
  if (fenceContent) {
    try {
      const data = JSON.parse(fenceContent) as T
      logger.warn("[ai-response-parser] Parsed JSON from markdown code fence")
      return { success: true, data, usedFallback: true }
    } catch {
      // Fall through — fence content itself may be malformed
    }
  }

  // 3. Extract JSON substring (handles leading/trailing prose)
  const jsonSubstring = extractJsonSubstring(trimmed)
  if (jsonSubstring) {
    try {
      const data = JSON.parse(jsonSubstring) as T
      logger.warn("[ai-response-parser] Parsed JSON by extracting substring from prose")
      return { success: true, data, usedFallback: true }
    } catch {
      // 4. Attempt truncation repair on the extracted substring
      try {
        const repaired = repairTruncatedJson(jsonSubstring)
        const data = JSON.parse(repaired) as T
        logger.warn("[ai-response-parser] Parsed JSON after repairing truncated response")
        return { success: true, data, usedFallback: true }
      } catch {
        // All strategies exhausted
      }
    }
  }

  return {
    success: false,
    error: `Unable to extract valid JSON from AI response (length=${trimmed.length})`,
    raw: trimmed.length > 500 ? trimmed.substring(0, 500) + "..." : trimmed,
  }
}

/**
 * Convenience wrapper that throws on failure — use when you want to let the
 * caller's existing try/catch handle the error.
 *
 * @param raw - The raw string returned by the AI model
 * @param context - Optional label for better error messages (e.g., "tone_detection")
 * @returns The parsed data of type T
 * @throws Error if parsing fails after all fallback strategies
 */
export function parseAiResponseOrThrow<T>(raw: string, context?: string): T {
  const result = parseAiResponse<T>(raw)
  if (result.success) return result.data
  const prefix = context ? `[${context}] ` : ""
  throw new Error(`${prefix}${result.error}`)
}

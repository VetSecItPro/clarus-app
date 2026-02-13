/**
 * @module lib/pipeline/transcript-correction
 * @description Speech-to-text transcript correction using title/description cross-referencing.
 *
 * Corrects common speech-to-text errors by comparing transcript words against
 * the authoritative title and description text.
 */

import { logger } from "@/lib/logger"

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Levenshtein edit distance between two strings (case-insensitive).
 * Used to detect speech-to-text misspellings by comparing title words
 * against transcript words.
 */
function editDistance(a: string, b: string): number {
  const la = a.length, lb = b.length
  if (la === 0) return lb
  if (lb === 0) return la
  let prev = Array.from({ length: lb + 1 }, (_, i) => i)
  for (let i = 1; i <= la; i++) {
    const curr = [i]
    for (let j = 1; j <= lb; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev = curr
  }
  return prev[lb]
}

/** Escape special regex characters in a string */
function escapeRegExpChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Common stop words to exclude from title entity extraction */
const TITLE_STOP_WORDS = new Set([
  "the", "a", "an", "in", "on", "at", "for", "to", "of", "and", "or",
  "is", "are", "was", "were", "be", "been", "have", "has", "had", "do",
  "does", "did", "will", "would", "could", "should", "may", "can",
  "this", "that", "with", "from", "by", "about", "how", "what", "when",
  "where", "who", "why", "which", "all", "both", "more", "most", "some",
  "any", "not", "only", "just", "also", "very", "so", "too", "up", "out",
  "if", "then", "than", "but", "yet", "it", "its", "my", "your", "our",
  "their", "his", "her", "new", "full", "you", "learn", "use", "get",
])

// ============================================
// EXPORTED FUNCTIONS
// ============================================

/**
 * Corrects speech-to-text transcription errors by cross-referencing the
 * title and description against the transcript text.
 *
 * Speech-to-text engines (YouTube auto-captions, AssemblyAI) frequently
 * misspell proper nouns, product names, and technical terms because they
 * optimize for common dictionary words. For example:
 * - "Claude Code" → "Cloud Code" (homophone)
 * - "Supabase" → "super base" (phonetic split)
 * - "Next.js" → "next JS" or "next yes"
 *
 * This function extracts significant phrases from the title (which is
 * almost always correctly spelled) and finds/replaces near-misses in
 * the transcript.
 *
 * Strategy:
 * 1. Extract bigrams (word pairs) from the title
 * 2. For each bigram NOT found in the transcript, look for a fuzzy variant
 *    where one word matches exactly and the other is within edit distance ≤ 2
 * 3. Replace the wrong variant with the title's version
 * 4. Also check individual proper nouns (capitalized words > 4 chars)
 *    with very strict matching (edit distance ≤ 1, must appear 3+ times)
 */
export function correctTranscriptFromMetadata(
  transcript: string,
  title: string | null,
  description: string | null,
): { text: string; corrections: Array<{ from: string; to: string; count: number }> } {
  if (!title) return { text: transcript, corrections: [] }

  const corrections: Array<{ from: string; to: string; count: number }> = []
  let corrected = transcript

  // Extract meaningful tokens from the title
  const titleTokens = title
    .split(/[\s:|\-–—,.!?()[\]]+/)
    .filter(w => w.length > 2 && !TITLE_STOP_WORDS.has(w.toLowerCase()))

  // Also extract from description (first 200 chars) for additional entity context
  const descTokens = description
    ? description
        .substring(0, 200)
        .split(/[\s:|\-–—,.!?()[\]]+/)
        .filter(w => w.length > 3 && !TITLE_STOP_WORDS.has(w.toLowerCase()))
    : []
  const allTokens = [...titleTokens, ...descTokens]

  // Shared regex match variable for all passes
  let m: RegExpExecArray | null

  // --- Pass 1: Bigram correction (most reliable) ---
  // Check consecutive word pairs from title against transcript
  for (let i = 0; i < titleTokens.length - 1; i++) {
    const w1 = titleTokens[i]
    const w2 = titleTokens[i + 1]
    const titleBigram = `${w1} ${w2}`

    // Skip if bigram already exists in transcript (case-insensitive)
    if (new RegExp(escapeRegExpChars(titleBigram), "i").test(corrected)) continue

    // Pattern A: first word is wrong, second word is correct
    // Find "[WORD] w2" in transcript where WORD is close to w1
    const lenMin1 = Math.max(2, w1.length - 2)
    const lenMax1 = w1.length + 2
    const pat1 = new RegExp(
      `\\b(\\w{${lenMin1},${lenMax1}})\\s+${escapeRegExpChars(w2)}\\b`,
      "gi"
    )
    while ((m = pat1.exec(corrected)) !== null) {
      const candidate = m[1]
      if (
        candidate.toLowerCase() !== w1.toLowerCase() &&
        editDistance(candidate.toLowerCase(), w1.toLowerCase()) <= 2
      ) {
        const wrongPhrase = m[0]
        const regex = new RegExp(escapeRegExpChars(wrongPhrase), "gi")
        const count = (corrected.match(regex) || []).length
        if (count > 0) {
          corrected = corrected.replace(regex, titleBigram)
          corrections.push({ from: wrongPhrase, to: titleBigram, count })
        }
        break
      }
    }

    // Re-check — bigram may now exist after Pass A
    if (new RegExp(escapeRegExpChars(titleBigram), "i").test(corrected)) continue

    // Pattern B: first word is correct, second word is wrong
    const lenMin2 = Math.max(2, w2.length - 2)
    const lenMax2 = w2.length + 2
    const pat2 = new RegExp(
      `\\b${escapeRegExpChars(w1)}\\s+(\\w{${lenMin2},${lenMax2}})\\b`,
      "gi"
    )
    while ((m = pat2.exec(corrected)) !== null) {
      const candidate = m[1]
      if (
        candidate.toLowerCase() !== w2.toLowerCase() &&
        editDistance(candidate.toLowerCase(), w2.toLowerCase()) <= 2
      ) {
        const wrongPhrase = m[0]
        const regex = new RegExp(escapeRegExpChars(wrongPhrase), "gi")
        const count = (corrected.match(regex) || []).length
        if (count > 0) {
          corrected = corrected.replace(regex, titleBigram)
          corrections.push({ from: wrongPhrase, to: titleBigram, count })
        }
        break
      }
    }
  }

  // --- Pass 2: Single-word proper noun correction (strict) ---
  // Only for capitalized words > 4 chars, edit distance ≤ 1, appearing 3+ times
  for (const word of allTokens) {
    if (word.length < 4 || word[0] !== word[0].toUpperCase()) continue
    // Skip if word already exists in transcript
    if (new RegExp(`\\b${escapeRegExpChars(word)}\\b`, "i").test(corrected)) continue

    // Scan for close matches
    const singlePat = new RegExp(
      `\\b(\\w{${Math.max(3, word.length - 1)},${word.length + 1}})\\b`,
      "gi"
    )
    const candidates = new Map<string, number>()
    while ((m = singlePat.exec(corrected)) !== null) {
      const c = m[1]
      if (c.toLowerCase() !== word.toLowerCase() && editDistance(c.toLowerCase(), word.toLowerCase()) <= 1) {
        candidates.set(c, (candidates.get(c) || 0) + 1)
      }
    }

    // Replace only systematic errors (3+ occurrences)
    for (const [candidate, freq] of candidates) {
      if (freq >= 3) {
        const regex = new RegExp(`\\b${escapeRegExpChars(candidate)}\\b`, "g")
        corrected = corrected.replace(regex, word)
        corrections.push({ from: candidate, to: word, count: freq })
      }
    }
  }

  if (corrections.length > 0 && process.env.NODE_ENV === "development") {
    logger.info(
      `[transcript-correction] Fixed ${corrections.length} error(s): ` +
      corrections.map(c => `"${c.from}" → "${c.to}" (×${c.count})`).join(", ")
    )
  }

  return { text: corrected, corrections }
}

/**
 * Builds a transcript accuracy notice that warns the AI about potential
 * speech-to-text errors and provides the authoritative title/description
 * for reference.
 *
 * This block is appended to the metadata block for YouTube and podcast
 * content, where automated transcription is used.
 */
export function buildTranscriptCorrectionNotice(
  title: string | null,
  description: string | null,
  contentType: string,
  corrections: Array<{ from: string; to: string; count: number }>,
): string {
  // Only for content types that use speech-to-text
  if (contentType !== "youtube" && contentType !== "podcast") return ""
  if (!title) return ""

  const lines: string[] = [
    "",
    "## CRITICAL: Transcript Accuracy Warning",
    "This content was transcribed using automated speech-to-text, which FREQUENTLY misspells proper nouns, product names, people's names, and technical terms.",
    `The TITLE is the authoritative source for correct terminology: "${title}"`,
  ]

  if (description) {
    const excerpt = description.substring(0, 300).replace(/\n/g, " ").trim()
    if (excerpt) lines.push(`Description: "${excerpt}"`)
  }

  if (corrections.length > 0) {
    lines.push("")
    lines.push("The following speech-to-text errors were automatically corrected in the transcript:")
    for (const c of corrections) {
      lines.push(`- "${c.from}" → "${c.to}" (corrected ${c.count} times)`)
    }
    lines.push("These corrections were based on cross-referencing the title against the transcript.")
  }

  lines.push("")
  lines.push("RULES FOR HANDLING TRANSCRIPT ERRORS:")
  lines.push("1. If a word in the transcript sounds similar to a term in the title but is spelled differently, the TITLE spelling is ALWAYS correct.")
  lines.push("2. NEVER dismiss content as 'non-existent', 'fake', or 'misleading' based on a potentially misspelled term — verify with web search results first.")
  lines.push("3. Use your web search context to confirm product names, tools, companies, and people before making accuracy judgments.")
  lines.push("4. The title and description are written by the content creator and are almost always correctly spelled.")

  return lines.join("\n")
}

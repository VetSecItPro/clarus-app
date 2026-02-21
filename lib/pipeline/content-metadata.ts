/**
 * @module lib/pipeline/content-metadata
 * @description Builds rich metadata blocks and type-specific analysis instructions
 * for the AI prompts in the content processing pipeline.
 */

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Formats a duration in seconds into a human-readable string.
 * Examples: 125 → "2m 5s", 7500 → "2h 5m", 45 → "45s"
 */
export function formatDuration(seconds: number): string {
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
export function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return count.toString()
}

/**
 * Counts unique speakers in a podcast transcript.
 * Looks for diarization format: "[MM:SS] Speaker A:" patterns.
 */
export function countSpeakers(transcript: string): number {
  const speakerPattern = /\bSpeaker ([A-Z])\b/g
  const speakers = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = speakerPattern.exec(transcript)) !== null) {
    speakers.add(match[1])
  }
  return speakers.size
}

// ============================================
// CONTENT METADATA BLOCK
// ============================================

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
export function buildContentMetadataBlock(content: {
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
    "IMPORTANT: YouTube auto-captions frequently misspell proper nouns (product names, people, companies, technical terms). Always cross-reference against the title, description, and web search results before assuming any proper noun is spelled correctly in the transcript.",
    "If the transcript uses a word that sounds like but differs from a term in the title (e.g., 'Cloud Code' vs 'Claude Code'), the TITLE is correct — use the title's spelling throughout your analysis.",
  ],
  podcast: [
    "Attribute claims to specific speakers (Speaker A, Speaker B, etc.) when identifiable.",
    "Note agreements and disagreements between speakers.",
    "Identify host vs. guest dynamics — who is being interviewed, who is the expert.",
    "Flag claims where speakers contradict each other.",
    "IMPORTANT: Podcast transcription frequently misspells proper nouns (product names, people, companies, technical terms). Always cross-reference against the title, description, and web search results before assuming any proper noun is spelled correctly in the transcript.",
    "If the transcript uses a word that sounds like but differs from a term in the title, the TITLE is correct — use the title's spelling throughout your analysis.",
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
export function buildTypeInstructions(
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

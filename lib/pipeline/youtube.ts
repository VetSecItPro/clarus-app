/**
 * @module lib/pipeline/youtube
 * @description YouTube metadata and transcript extraction via the Supadata API.
 *
 * Handles fetching video metadata (title, channel, duration, views, etc.)
 * and transcripts with timestamp grouping for the content processing pipeline.
 */

import type { Json } from "@/types/database.types"
import { logApiUsage, createTimer } from "@/lib/api-usage"
import { NonRetryableError } from "@/lib/error-sanitizer"
import { logger } from "@/lib/logger"
import { getErrorMessage } from "./types"

// ============================================
// INTERNAL TYPES
// ============================================

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

// ============================================
// EXPORTED TYPES
// ============================================

export interface ProcessedYouTubeMetadata {
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

// ============================================
// EXPORTED FUNCTIONS
// ============================================

export async function getYouTubeMetadata(url: string, apiKey: string, userId?: string | null, contentId?: string | null): Promise<ProcessedYouTubeMetadata> {
  const endpoint = `https://api.supadata.ai/v1/youtube/video?id=${encodeURIComponent(url)}`
  const retries = 3
  const delay = 1000
  const timer = createTimer()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      const response = await fetch(endpoint, {
        headers: { "x-api-key": apiKey },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.ok) {
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const errorText = await response.text()
          logger.error(`Metadata API error: Expected JSON, got ${contentType}. Response: ${errorText}`)
          throw new NonRetryableError("Video metadata response was invalid")
        }
        const data: SupadataYouTubeResponse = await response.json()

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
        logger.error(`Metadata API error (${response.status}) for content ${url}: ${errorText.substring(0, 200)}`)
        throw new NonRetryableError("Video metadata could not be retrieved")
      }

      const errorText = await response.text()
      logger.warn(
        `Supadata Metadata API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
          delay / 1000
        }s...`,
      )
    } catch (error: unknown) {
      if (error instanceof NonRetryableError) {
        throw error
      }
      const msg = getErrorMessage(error)
      logger.warn(
        `Metadata API attempt ${attempt} failed for ${url}: ${msg}. Retrying in ${
          delay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, delay))
    }
  }

  logger.error(`Metadata API failed for ${url} after ${retries} attempts`)

  logApiUsage({
    userId,
    contentId,
    apiName: "supadata",
    operation: "metadata",
    responseTimeMs: timer.elapsed(),
    status: "error",
    errorMessage: `Metadata fetch failed after ${retries} attempts`,
  })

  throw new Error("Video metadata unavailable after multiple attempts")
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// ============================================
// MUSIC CONTENT DETECTION
// ============================================

/**
 * Pre-screen YouTube metadata to detect music content BEFORE transcript fetch.
 *
 * This prevents the pipeline from wasting 60s+ trying to fetch a transcript
 * for a music video or concert that has no meaningful spoken content.
 * Detection uses title, description, tags, and channel signals.
 *
 * @returns true if the content is primarily music (should be rejected early)
 */

const MUSIC_TITLE_PATTERNS = [
  /\bofficial\s+(music\s+)?video\b/i,
  /\bofficial\s+audio\b/i,
  /\bofficial\s+lyric\s+video\b/i,
  /\blyrics?\s+video\b/i,
  /\blive\s+(concert|performance|session|show)\b/i,
  /\bfull\s+(album|concert|set)\b/i,
  /\bmix\s*(?:tape|set)\b/i,
  /\b(?:dj|lo-?fi|chill)\s+mix\b/i,
  /\bmusic\s+video\b/i,
  /\bvisualizer\b/i,
  /\baudio\s*(?:only)?\b.*\b(?:ft|feat)\b/i,
  /\b(?:ft|feat)\.?\s+/i,  // "feat." or "ft." — common in music titles
  /\[\s*(?:official|lyrics?|audio|mv|m\/v)\s*\]/i,
  /\(\s*(?:official|lyrics?|audio|mv|m\/v)\s*\)/i,
]

const MUSIC_TAG_KEYWORDS = new Set([
  "music", "music video", "official video", "official music video",
  "official audio", "lyrics", "lyric video", "concert", "live concert",
  "live performance", "live music", "album", "full album", "mixtape",
  "hip hop", "rap", "r&b", "pop music", "rock music", "jazz",
  "electronic music", "edm", "classical music", "country music",
  "reggae", "gospel", "k-pop", "latin music",
])

const MUSIC_DESCRIPTION_PATTERNS = [
  /\bofficial\s+(music\s+)?video\b/i,
  /\bstream\s+(\/\s*)?download\b/i,
  /\bavailable\s+(?:now\s+)?on\s+(?:spotify|apple\s+music|itunes|tidal|deezer|amazon\s+music)\b/i,
  /\b(?:℗|©)\s*\d{4}\b/,  // ℗ 2024 or © 2024 — record label copyright
  /\brecords?\b.*\b(?:distributed|released)\b/i,
  /\bproduced\s+by\b/i,
  /\bwritten\s+by\b.*\bcomposed\s+by\b/i,
]

const MUSIC_CHANNEL_KEYWORDS = [
  "vevo", "records", "music", "entertainment",
]

export function detectMusicContent(metadata: ProcessedYouTubeMetadata): boolean {
  const title = metadata.title ?? ""
  const description = metadata.description ?? ""
  const rawMeta = metadata.raw_youtube_metadata as SupadataYouTubeResponse | null
  const tags = rawMeta?.tags ?? []
  const channelName = metadata.author ?? ""

  let signals = 0

  // Title pattern match (strong signal — 2 points)
  if (MUSIC_TITLE_PATTERNS.some(p => p.test(title))) {
    signals += 2
  }

  // YouTube tags (strong signal — check for music-related tags)
  const lowerTags = tags.map(t => t.toLowerCase())
  const musicTagCount = lowerTags.filter(t => MUSIC_TAG_KEYWORDS.has(t)).length
  if (musicTagCount >= 2) signals += 2
  else if (musicTagCount >= 1) signals += 1

  // Description patterns (medium signal)
  const descriptionHits = MUSIC_DESCRIPTION_PATTERNS.filter(p => p.test(description)).length
  if (descriptionHits >= 2) signals += 2
  else if (descriptionHits >= 1) signals += 1

  // Channel name contains music keywords (weak signal)
  const lowerChannel = channelName.toLowerCase()
  if (MUSIC_CHANNEL_KEYWORDS.some(kw => lowerChannel.includes(kw))) {
    signals += 1
  }

  // "feat." or "ft." in title is a strong music indicator when combined with any other signal
  if (/\b(?:ft|feat)\.?\s+/i.test(title) && signals >= 1) {
    signals += 1
  }

  // Threshold: need at least 3 signal points to classify as music
  // This avoids false positives on videos that merely mention music
  return signals >= 3
}

// ============================================
// TRANSCRIPT EXTRACTION
// ============================================

export async function getYouTubeTranscript(url: string, apiKey: string, userId?: string | null, contentId?: string | null): Promise<{ full_text: string | null }> {
  const endpoint = `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}`
  const retries = 3
  const timer = createTimer()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)
      const response = await fetch(endpoint, {
        headers: { "x-api-key": apiKey },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.ok) {
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const errorText = await response.text()
          logger.error(`Transcript API error: Expected JSON, got ${contentType}. Response: ${errorText}`)
          throw new NonRetryableError("Video transcript response was invalid")
        }
        const data = await response.json()

        if (Array.isArray(data.content)) {
          const INTERVAL_MS = 30000
          const groupedChunks: { timestamp: number; texts: string[] }[] = []

          for (const chunk of data.content as { text: string; offset: number }[]) {
            const intervalStart = Math.floor(chunk.offset / INTERVAL_MS) * INTERVAL_MS

            let group = groupedChunks.find(g => g.timestamp === intervalStart)
            if (!group) {
              group = { timestamp: intervalStart, texts: [] }
              groupedChunks.push(group)
            }
            group.texts.push(chunk.text)
          }

          groupedChunks.sort((a, b) => a.timestamp - b.timestamp)
          const formattedText = groupedChunks
            .map(group => {
              const timestamp = formatTimestamp(group.timestamp)
              const combinedText = group.texts.join(' ')
              return `[${timestamp}] ${combinedText}`
            })
            .join('\n\n')

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

        logApiUsage({
          userId,
          contentId,
          apiName: "supadata",
          operation: "transcript",
          responseTimeMs: timer.elapsed(),
          status: "success",
        })

        return { full_text: data.content }
      }

      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text()
        logger.error(`Transcript API error (${response.status}) for content ${url}: ${errorText.substring(0, 200)}`)
        throw new NonRetryableError("Video transcript could not be retrieved")
      }

      const errorText = await response.text()
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      logger.warn(
        `Supadata Transcript API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
          retryDelay / 1000
        }s...`,
      )
    } catch (error: unknown) {
      if (error instanceof NonRetryableError) {
        throw error
      }
      const msg = getErrorMessage(error)
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      logger.warn(
        `Transcript API attempt ${attempt} failed for ${url}: ${msg}. Retrying in ${
          retryDelay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      await new Promise((res) => setTimeout(res, retryDelay))
    }
  }

  logger.error(`Transcript API failed for ${url} after ${retries} attempts`)

  logApiUsage({
    userId,
    contentId,
    apiName: "supadata",
    operation: "transcript",
    responseTimeMs: timer.elapsed(),
    status: "error",
    errorMessage: `Transcript fetch failed after ${retries} attempts`,
  })

  throw new Error("Video transcript unavailable after multiple attempts")
}

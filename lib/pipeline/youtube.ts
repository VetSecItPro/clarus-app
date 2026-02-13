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

/**
 * @module lib/pipeline/article-scraper
 * @description Article scraping via the Firecrawl API for the content processing pipeline.
 *
 * Handles fetching and extracting article content (title, full text, description,
 * thumbnail) with retry logic and timeout handling.
 */

import { logApiUsage, createTimer } from "@/lib/api-usage"
import { NonRetryableError } from "@/lib/error-sanitizer"
import { logger } from "@/lib/logger"
import { getErrorMessage, FIRECRAWL_TIMEOUT_MS } from "./types"

// ============================================
// EXPORTED TYPES
// ============================================

export interface ScrapedArticleData {
  title: string | null
  full_text: string | null
  description: string | null
  thumbnail_url: string | null
}

// ============================================
// EXPORTED FUNCTIONS
// ============================================

export async function scrapeArticle(url: string, apiKey: string, userId?: string | null, contentId?: string | null): Promise<ScrapedArticleData> {
  const endpoint = "https://api.firecrawl.dev/v0/scrape"
  const retries = 3
  const timer = createTimer()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS)

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
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
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
          logger.error("Scrape API indicated failure:", result.error)
          throw new NonRetryableError("Article content could not be extracted")
        }
      }

      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text()
        logger.error(`Scrape API error (${response.status}) for content ${url}: ${errorText.substring(0, 200)}`)
        throw new NonRetryableError("Article content could not be retrieved")
      }

      const errorText = await response.text()
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      logger.warn(
        `FireCrawl API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
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
        `Scrape API attempt ${attempt} failed for ${url}: ${msg}. Retrying in ${
          retryDelay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
      await new Promise((res) => setTimeout(res, retryDelay))
    }
  }

  logger.error(`Scrape API failed for ${url} after ${retries} attempts`)

  logApiUsage({
    userId,
    contentId,
    apiName: "firecrawl",
    operation: "scrape",
    responseTimeMs: timer.elapsed(),
    status: "error",
    errorMessage: `Scrape failed after ${retries} attempts`,
  })

  throw new Error("Article content unavailable after multiple attempts")
}

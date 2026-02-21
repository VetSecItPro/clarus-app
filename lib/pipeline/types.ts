/**
 * @module lib/pipeline/types
 * @description Shared types, constants, and error classes for the content processing pipeline.
 */

import type { AnalysisLanguage } from "@/lib/languages"

// ============================================
// TIMEOUT CONSTANTS
// ============================================

/** Timeout for individual AI API calls (2 minutes per call) */
export const AI_CALL_TIMEOUT_MS = 120000

/** Timeout for external service calls (web search, scraping) */
export const TAVILY_TIMEOUT_MS = 15000
export const FIRECRAWL_TIMEOUT_MS = 30000
export const EXTRACT_TOPICS_TIMEOUT_MS = 10000

/** Phase 1 (web search + tone + prefs) overall timeout */
export const PHASE1_TIMEOUT_MS = 20000

/** Global pipeline timeout (4 minutes) */
export const PIPELINE_TIMEOUT_MS = 240000

// ============================================
// ERROR CLASS
// ============================================

/**
 * Custom error class for content processing failures.
 * Carries HTTP status code and optional upgrade/tier info.
 */
export class ProcessContentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly upgradeRequired?: boolean,
    public readonly tier?: string
  ) {
    super(message)
    this.name = "ProcessContentError"
  }
}

// ============================================
// INTERFACES
// ============================================

/**
 * Options for the processContent function.
 */
export interface ProcessContentOptions {
  /** The content ID to process (UUID) */
  contentId: string
  /** User ID for ownership verification. Null for internal/webhook calls. */
  userId: string | null
  /** Target language for analysis output */
  language?: AnalysisLanguage
  /** If true, regenerate even if content already has analysis */
  forceRegenerate?: boolean
  /** If true, skip scraping (used when full_text is already populated, e.g., PDFs) */
  skipScraping?: boolean
  /** Decrypted auth header for private podcast feeds (Pro tier only). Passed through to Deepgram for authenticated audio. */
  feedAuthHeader?: string
}

/**
 * Result returned by processContent on success.
 */
export interface ProcessContentResult {
  success: boolean
  cached: boolean
  contentId: string
  sectionsGenerated: string[]
  language: string
  message?: string
  transcriptId?: string
  paywallWarning?: string | null
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}

export function getErrorName(error: unknown): string {
  if (error instanceof Error) return error.name
  return ""
}

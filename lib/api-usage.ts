/**
 * @module api-usage
 * @description API usage tracking and cost estimation for all external services.
 *
 * Logs every external API call (OpenRouter, Firecrawl, Supadata, Tavily,
 * AssemblyAI) to the `api_usage` and `processing_metrics` tables for
 * cost monitoring and debugging. Cost estimates are calculated from
 * per-model token pricing or per-request flat rates.
 *
 * Logging is fire-and-forget -- failures are caught and logged to stderr
 * so they never break the primary request flow.
 *
 * @see {@link lib/usage.ts} for user-facing usage limit enforcement
 */

import { createClient } from "@supabase/supabase-js"

// Server-side Supabase client with service role for logging
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: "clarus",
    },
  }
)

/**
 * Per-model and per-service pricing used to estimate costs.
 *
 * OpenRouter prices are per 1M tokens (input/output separately).
 * Other services use flat per-request rates. Legacy models are
 * retained for accurate cost tracking of historical usage.
 */
export const API_PRICING = {
  openrouter: {
    // Gemini 2.5 pricing via OpenRouter (primary models)
    "google/gemini-2.5-flash": { input: 0.3, output: 2.5 },
    "google/gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
    "google/gemini-2.5-pro": { input: 1.25, output: 10.0 },
    // Legacy models (kept for cost tracking of historical usage)
    "anthropic/claude-sonnet-4": { input: 3.0, output: 15.0 },
    "anthropic/claude-3.5-sonnet": { input: 3.0, output: 15.0 },
    "anthropic/claude-3-haiku": { input: 0.25, output: 1.25 },
    "openai/gpt-4o": { input: 2.5, output: 10.0 },
    "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
    "google/gemini-2.0-flash-001": { input: 0.1, output: 0.4 },
    default: { input: 0.3, output: 2.5 },
  },
  supadata: {
    transcript: 0.001, // ~$0.001 per transcript request
    metadata: 0.0005, // ~$0.0005 per metadata request
  },
  firecrawl: {
    scrape: 0.001, // ~$0.001 per scrape
  },
  tavily: {
    search: 0.01, // ~$0.01 per search
  },
  assemblyai: {
    transcribe: 0.0000472, // $0.17/hr ($0.15 transcription + $0.02 speaker diarization)
  },
}

/** Identifier for the external service being called. */
export type ApiName = "openrouter" | "supadata" | "firecrawl" | "tavily" | "polar" | "supabase" | "vercel" | "assemblyai"

/** Specific operation within a service (for granular cost tracking). */
export type ApiOperation =
  | "analyze" | "chat" | "summarize" | "tone_detection" | "translate"  // openrouter
  | "transcript" | "metadata"          // supadata
  | "scrape"                           // firecrawl
  | "search"                           // tavily
  | "transcribe"                       // assemblyai
  | "mrr_fetch" | "checkout" | "webhook"  // polar
  | "query" | "insert" | "update" | "auth"  // supabase
  | "deploy" | "status"                // vercel

interface LogApiUsageParams {
  userId?: string | null
  contentId?: string | null
  apiName: ApiName
  operation: ApiOperation
  tokensInput?: number
  tokensOutput?: number
  modelName?: string
  responseTimeMs: number
  status: "success" | "error" | "timeout"
  errorMessage?: string
  metadata?: Record<string, unknown>
}

/**
 * Calculates the estimated USD cost of an API call based on the service,
 * operation, and token counts.
 *
 * For OpenRouter, cost is computed from per-model input/output token
 * pricing. For other services, a flat per-request rate is used.
 * For AssemblyAI, `tokensInput` is repurposed to pass audio duration
 * in seconds.
 *
 * @param params - The API call details needed for cost calculation
 * @returns Estimated cost in USD (may be 0 for free operations)
 */
export function calculateCost(params: {
  apiName: ApiName
  operation: ApiOperation
  tokensInput?: number
  tokensOutput?: number
  modelName?: string
}): number {
  const { apiName, operation, tokensInput = 0, tokensOutput = 0, modelName } = params

  if (apiName === "openrouter") {
    const pricing = modelName && API_PRICING.openrouter[modelName as keyof typeof API_PRICING.openrouter]
      ? API_PRICING.openrouter[modelName as keyof typeof API_PRICING.openrouter]
      : API_PRICING.openrouter.default

    // Cost per 1M tokens
    const inputCost = (tokensInput / 1_000_000) * pricing.input
    const outputCost = (tokensOutput / 1_000_000) * pricing.output
    return inputCost + outputCost
  }

  if (apiName === "supadata") {
    return API_PRICING.supadata[operation as keyof typeof API_PRICING.supadata] || 0.001
  }

  if (apiName === "firecrawl") {
    return API_PRICING.firecrawl.scrape
  }

  if (apiName === "tavily") {
    return API_PRICING.tavily.search
  }

  if (apiName === "assemblyai") {
    // Cost is per second of audio; tokensInput is used to pass audio_duration_seconds
    return (tokensInput || 0) * API_PRICING.assemblyai.transcribe
  }

  return 0
}

/**
 * Persists an API usage record to the `api_usage` table.
 *
 * Automatically calculates the estimated cost and merges the model name
 * into the metadata object. This function is fire-and-forget -- errors
 * are logged but never thrown.
 *
 * @param params - The API call details to log
 *
 * @example
 * ```ts
 * const timer = createTimer()
 * const result = await callOpenRouter(...)
 * await logApiUsage({
 *   userId, contentId,
 *   apiName: "openrouter",
 *   operation: "analyze",
 *   tokensInput: result.usage.input,
 *   tokensOutput: result.usage.output,
 *   modelName: "google/gemini-2.5-flash",
 *   responseTimeMs: timer.elapsed(),
 *   status: "success",
 * })
 * ```
 */
export async function logApiUsage(params: LogApiUsageParams): Promise<void> {
  try {
    const estimatedCost = calculateCost({
      apiName: params.apiName,
      operation: params.operation,
      tokensInput: params.tokensInput,
      tokensOutput: params.tokensOutput,
      modelName: params.modelName,
    })

    // Merge model_name into metadata if provided
    const metadata = {
      ...params.metadata,
      ...(params.modelName && { model: params.modelName }),
    }

    await supabaseAdmin.from("api_usage").insert({
      user_id: params.userId || null,
      content_id: params.contentId || null,
      api_name: params.apiName,
      operation: params.operation,
      tokens_input: params.tokensInput || 0,
      tokens_output: params.tokensOutput || 0,
      estimated_cost_usd: estimatedCost,
      response_time_ms: params.responseTimeMs,
      status: params.status,
      error_message: params.errorMessage || null,
      metadata: metadata,
    })
  } catch (error) {
    // Don't throw - logging should never break the main flow
    console.error("Failed to log API usage:", error)
  }
}

/**
 * Persists per-section processing metrics to the `processing_metrics` table.
 *
 * Tracks how long each analysis section (e.g., triage, truth_check) took
 * to process, enabling performance monitoring and model comparison.
 * Fire-and-forget -- errors are logged but never thrown.
 *
 * @param params - The section processing details to log
 */
export async function logProcessingMetrics(params: {
  summaryId?: string
  contentId?: string
  userId?: string | null
  sectionType: string
  modelName?: string
  tokensInput?: number
  tokensOutput?: number
  processingTimeMs: number
  retryCount?: number
  status: "success" | "error" | "timeout"
  errorMessage?: string
}): Promise<void> {
  try {
    await supabaseAdmin.from("processing_metrics").insert({
      summary_id: params.summaryId || null,
      content_id: params.contentId || null,
      user_id: params.userId || null,
      section_type: params.sectionType,
      model_name: params.modelName || null,
      tokens_input: params.tokensInput || 0,
      tokens_output: params.tokensOutput || 0,
      processing_time_ms: params.processingTimeMs,
      retry_count: params.retryCount || 0,
      status: params.status,
      error_message: params.errorMessage || null,
    })
  } catch (error) {
    console.error("Failed to log processing metrics:", error)
  }
}

/**
 * Creates a simple stopwatch for measuring API call duration.
 *
 * @returns An object with an `elapsed()` method that returns milliseconds since creation
 *
 * @example
 * ```ts
 * const timer = createTimer()
 * await someApiCall()
 * console.log(`Took ${timer.elapsed()}ms`)
 * ```
 */
export function createTimer() {
  const start = Date.now()
  return {
    elapsed: () => Date.now() - start,
  }
}

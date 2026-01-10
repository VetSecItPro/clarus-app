import { createClient } from "@supabase/supabase-js"

// Server-side Supabase client with service role for logging
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// API pricing (per 1M tokens or per request)
export const API_PRICING = {
  openrouter: {
    // Claude Sonnet 3.5 pricing via OpenRouter
    "anthropic/claude-sonnet-4": { input: 3.0, output: 15.0 },
    "anthropic/claude-3.5-sonnet": { input: 3.0, output: 15.0 },
    "anthropic/claude-3-haiku": { input: 0.25, output: 1.25 },
    "openai/gpt-4o": { input: 2.5, output: 10.0 },
    "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
    "google/gemini-2.0-flash-001": { input: 0.1, output: 0.4 },
    default: { input: 3.0, output: 15.0 },
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
}

export type ApiName = "openrouter" | "supadata" | "firecrawl" | "tavily" | "stripe" | "supabase" | "vercel"
export type ApiOperation =
  | "analyze" | "chat" | "summarize"  // openrouter
  | "transcript" | "metadata"          // supadata
  | "scrape"                           // firecrawl
  | "search"                           // tavily
  | "mrr_fetch" | "checkout" | "webhook"  // stripe
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
 * Calculate estimated cost based on API and usage
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

  return 0
}

/**
 * Log API usage to the database
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
 * Log processing metrics for a summary section
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
 * Helper to measure execution time
 */
export function createTimer() {
  const start = Date.now()
  return {
    elapsed: () => Date.now() - start,
  }
}

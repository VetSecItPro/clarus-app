import { NextRequest, NextResponse } from "next/server"
import { authenticateAdmin, getAdminClient, AuthErrors } from "@/lib/auth"
import { checkRateLimit } from "@/lib/validation"
import { z } from "zod"
import { parseQuery } from "@/lib/schemas"

// Schema for metrics query params
const metricsQuerySchema = z.object({
  timeRange: z.coerce.number().int().min(1).max(365).optional().default(30),
})

function getSupabaseAdmin() {
  return getAdminClient()
}

// Types
interface ApiCostBreakdown {
  api: string
  cost: number
  calls: number
}

interface RecentError {
  timestamp: string
  api: string
  message: string
}

interface CostTrendData {
  date: string
  cost: number
}

interface ErrorTrendData {
  date: string
  errorRate: number
  errorCount: number
  totalCount: number
}

interface ProcessingTimeTrendData {
  date: string
  avgTime: number
  count: number
}

interface ModelCostBreakdown {
  model: string
  cost: number
  calls: number
  tokensInput: number
  tokensOutput: number
}

interface ErrorByType {
  type: string
  count: number
  percentage: number
}

interface ProcessingTimeBySection {
  section: string
  avgTime: number
  count: number
}

interface ContentByTypeMonthly {
  month: string
  youtube: number
  article: number
  x_post: number
  pdf: number
}

interface ApiStatusItem {
  name: string
  label: string
  status: "operational" | "degraded" | "down" | "unknown"
  errorRate: number
  totalCalls: number
}

interface SystemHealthDetails {
  apiCostBreakdown: ApiCostBreakdown[]
  recentErrors: RecentError[]
  processingTimeBySection: ProcessingTimeBySection[]
  apiStatuses: ApiStatusItem[]
  costTrend: CostTrendData[]
  modelCostBreakdown: ModelCostBreakdown[]
  errorTrend: ErrorTrendData[]
  errorsByType: ErrorByType[]
  processingTimeTrend: ProcessingTimeTrendData[]
}

export interface TierBreakdown {
  free: number
  starter: number
  pro: number
  day_pass: number
}

export interface DashboardMetrics {
  totalUsers: number
  activeUsers: number
  newUsersToday: number
  userGrowthPercent: number
  usersByTier: TierBreakdown
  totalContent: number
  contentToday: number
  contentGrowthPercent: number
  contentByType: { name: string; value: number; color: string }[]
  contentByTypeMonthly: ContentByTypeMonthly[]
  activeSubscriptions: number
  trialUsers: number
  mrr: number
  mrrGrowthPercent: number
  avgContentPerUser: number
  chatThreads: number
  chatMessages: number
  processingSuccessRate: number
  avgProcessingTime: number
  apiCostsToday: number
  errorRate: number
  signupTrend: { date: string; count: number }[]
  contentTrend: { date: string; count: number }[]
  topDomains: { domain: string; count: number; avgScore: number }[]
  truthRatingDistribution: { rating: string; count: number; color: string }[]
  systemHealthDetails: SystemHealthDetails
}

const COLORS = {
  blue: "#1d9bf0",
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  purple: "#a855f7",
  cyan: "#06b6d4",
  orange: "#f97316",
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate and verify admin status from session
    const auth = await authenticateAdmin()
    if (!auth.success) {
      return auth.response
    }

    // SECURITY: FIX-SEC-014 — Rate limit admin metrics endpoint
    const rateCheck = checkRateLimit(`admin-metrics:${auth.user.id}`, 30, 60000)
    if (!rateCheck.allowed) {
      return AuthErrors.rateLimit(rateCheck.resetIn)
    }

    // Validate query parameters
    const validation = parseQuery(metricsQuerySchema, request.nextUrl.searchParams)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    const timeRange = validation.data.timeRange

    // PERF: FIX-PERF-011 — Use server-side RPC instead of 22 parallel queries fetching 230K+ rows
    // The get_admin_metrics() function does all aggregation in Postgres with GROUP BY/COUNT,
    // returning a single JSONB result instead of transferring raw rows to the edge function.
    const { data: rpcData, error: rpcError } = await getSupabaseAdmin()
      .rpc("get_admin_metrics", { p_time_range_days: timeRange })

    if (rpcError) {
      console.error("Admin metrics RPC error:", rpcError)
      return NextResponse.json(
        { error: "Failed to fetch metrics" },
        { status: 500 }
      )
    }

    const raw = rpcData as Record<string, unknown>

    // Transform RPC result to match DashboardMetrics interface
    const totalUsers = (raw.total_users as number) || 0
    const totalContent = (raw.total_content as number) || 0
    const avgContentPerUser = totalUsers > 0 ? totalContent / totalUsers : 0

    const currentPeriodUsers = (raw.current_period_users as number) || 0
    const previousPeriodUsers = (raw.previous_period_users as number) || 0
    const userGrowthPercent = previousPeriodUsers > 0
      ? ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100
      : currentPeriodUsers > 0 ? 100 : 0

    const currentPeriodContent = (raw.current_period_content as number) || 0
    const previousPeriodContent = (raw.previous_period_content as number) || 0
    const contentGrowthPercent = previousPeriodContent > 0
      ? ((currentPeriodContent - previousPeriodContent) / previousPeriodContent) * 100
      : currentPeriodContent > 0 ? 100 : 0

    const usersByTierRaw = raw.users_by_tier as Record<string, number> || {}
    const subscriptionsRaw = raw.subscriptions as Record<string, number> || {}
    const contentByTypeRaw = raw.content_by_type as Record<string, number> || {}
    const processingMetricsRaw = raw.processing_metrics as Record<string, number> || {}
    const apiUsageTodayRaw = raw.api_usage_today as Record<string, number> || {}

    // Map signup/content trends — RPC returns { date, count }[]
    const signupTrendRaw = (raw.signup_trend as { date: string; count: number }[]) || []
    const contentTrendRaw = (raw.content_trend as { date: string; count: number }[]) || []
    const signupTrend = signupTrendRaw.map(d => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: d.count,
    }))
    const contentTrend = contentTrendRaw.map(d => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: d.count,
    }))

    // Top domains
    const topDomainsRaw = (raw.top_domains as { domain: string; count: number; avg_score: number }[]) || []
    const topDomains = topDomainsRaw.map(d => ({
      domain: d.domain,
      count: d.count,
      avgScore: d.avg_score || 0,
    }))

    // Truth rating distribution
    const truthRatingsRaw = raw.truth_rating_distribution as Record<string, number> || {}
    const truthRatingDistribution = [
      { rating: "Accurate", count: truthRatingsRaw["Accurate"] || 0, color: COLORS.green },
      { rating: "Mostly Accurate", count: truthRatingsRaw["Mostly Accurate"] || 0, color: COLORS.cyan },
      { rating: "Mixed", count: truthRatingsRaw["Mixed"] || 0, color: COLORS.yellow },
      { rating: "Questionable", count: truthRatingsRaw["Questionable"] || 0, color: COLORS.orange },
      { rating: "Unreliable", count: truthRatingsRaw["Unreliable"] || 0, color: COLORS.red },
    ]

    // Processing time by section
    const processingTimeBySectionRaw = (raw.processing_time_by_section as { section: string; avg_time: number; count: number }[]) || []
    const processingTimeBySection: ProcessingTimeBySection[] = processingTimeBySectionRaw.map(s => ({
      section: s.section,
      avgTime: s.avg_time,
      count: s.count,
    }))

    // API cost breakdown
    const apiCostBreakdownRaw = (raw.api_cost_breakdown as { api: string; cost: number; calls: number }[]) || []
    const apiCostBreakdown: ApiCostBreakdown[] = apiCostBreakdownRaw

    // Recent errors
    const recentErrorsRaw = (raw.recent_errors as { timestamp: string; api: string; message: string }[]) || []
    const recentErrors: RecentError[] = recentErrorsRaw.map(e => ({
      timestamp: e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : "Unknown",
      api: e.api,
      message: e.message,
    }))

    // Cost trend (7 days)
    const costTrendRaw = (raw.cost_trend_7d as { date: string; cost: number }[]) || []
    const costTrend: CostTrendData[] = costTrendRaw.map(d => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      cost: d.cost,
    }))

    // Model cost breakdown
    const modelCostRaw = (raw.model_cost_breakdown as { model: string; cost: number; calls: number; tokens_input: number; tokens_output: number }[]) || []
    const modelCostBreakdown: ModelCostBreakdown[] = modelCostRaw.map(m => ({
      model: m.model,
      cost: m.cost,
      calls: m.calls,
      tokensInput: m.tokens_input,
      tokensOutput: m.tokens_output,
    }))

    // Error trend (7 days)
    const errorTrendRaw = (raw.error_trend_7d as { date: string; error_rate: number; error_count: number; total_count: number }[]) || []
    const errorTrend: ErrorTrendData[] = errorTrendRaw.map(d => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      errorRate: d.error_rate,
      errorCount: d.error_count,
      totalCount: d.total_count,
    }))

    // Errors by type
    const errorsByTypeRaw = (raw.errors_by_type as { type: string; count: number }[]) || []
    const totalErrorCount = errorsByTypeRaw.reduce((sum, e) => sum + e.count, 0)
    const errorsByType: ErrorByType[] = errorsByTypeRaw.map(e => ({
      type: e.type,
      count: e.count,
      percentage: totalErrorCount > 0 ? Math.round((e.count / totalErrorCount) * 1000) / 10 : 0,
    }))

    // Processing time trend (7 days)
    const processingTimeTrendRaw = (raw.processing_time_trend_7d as { date: string; avg_time: number; count: number }[]) || []
    const processingTimeTrend: ProcessingTimeTrendData[] = processingTimeTrendRaw.map(d => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      avgTime: d.avg_time,
      count: d.count,
    }))

    // Content by type monthly
    const contentByTypeMonthlyRaw = (raw.content_by_type_monthly as { month: string; youtube: number; article: number; x_post: number; pdf: number }[]) || []
    const contentByTypeMonthly: ContentByTypeMonthly[] = contentByTypeMonthlyRaw

    // API statuses — derive from API cost breakdown (services that reported data today)
    const apiServices = [
      { name: "openrouter", label: "OpenRouter (AI Analysis)" },
      { name: "supadata", label: "Supadata (YouTube Transcripts)" },
      { name: "firecrawl", label: "FireCrawl (Article Scraping)" },
      { name: "tavily", label: "Tavily (Web Search)" },
      { name: "polar", label: "Polar (Payments)" },
      { name: "supabase", label: "Supabase (Database)" },
      { name: "vercel", label: "Vercel (Hosting)" },
    ]
    const apiStatusesRaw = (raw.api_statuses as { name: string; total_calls: number; error_count: number; error_rate: number }[]) || []
    const apiStatusMap = new Map(apiStatusesRaw.map(s => [s.name, s]))
    const apiStatuses: ApiStatusItem[] = apiServices.map(service => {
      const stats = apiStatusMap.get(service.name)
      if (!stats) {
        return { name: service.name, label: service.label, status: "operational" as const, errorRate: 0, totalCalls: -1 }
      }
      const er = stats.error_rate
      const status = er > 20 ? "down" as const : er > 5 ? "degraded" as const : "operational" as const
      return { name: service.name, label: service.label, status, errorRate: er, totalCalls: stats.total_calls }
    })

    const metrics: DashboardMetrics = {
      totalUsers,
      activeUsers: (raw.active_users as number) || 0,
      newUsersToday: (raw.new_users_today as number) || 0,
      userGrowthPercent: Math.round(userGrowthPercent * 10) / 10,
      usersByTier: {
        free: usersByTierRaw.free || 0,
        starter: usersByTierRaw.starter || 0,
        pro: usersByTierRaw.pro || 0,
        day_pass: usersByTierRaw.day_pass || 0,
      },
      totalContent,
      contentToday: (raw.content_today as number) || 0,
      contentGrowthPercent: Math.round(contentGrowthPercent * 10) / 10,
      contentByType: [
        { name: "YouTube", value: contentByTypeRaw.youtube || 0, color: COLORS.red },
        { name: "Articles", value: contentByTypeRaw.article || 0, color: COLORS.blue },
        { name: "X Posts", value: contentByTypeRaw.x_post || 0, color: COLORS.cyan },
        { name: "PDFs", value: contentByTypeRaw.pdf || 0, color: COLORS.purple },
      ],
      contentByTypeMonthly,
      activeSubscriptions: subscriptionsRaw.active || 0,
      trialUsers: subscriptionsRaw.trialing || 0,
      mrr: 0, // Real MRR comes from /api/admin/mrr endpoint
      mrrGrowthPercent: 0,
      avgContentPerUser: Math.round(avgContentPerUser * 10) / 10,
      chatThreads: (raw.chat_threads as number) || 0,
      chatMessages: (raw.chat_messages as number) || 0,
      processingSuccessRate: (processingMetricsRaw.success_rate as number) || 100,
      avgProcessingTime: (processingMetricsRaw.avg_processing_time_ms as number) || 0,
      apiCostsToday: (apiUsageTodayRaw.total_cost as number) || 0,
      errorRate: (apiUsageTodayRaw.error_rate as number) || 0,
      signupTrend,
      contentTrend,
      topDomains,
      truthRatingDistribution,
      systemHealthDetails: {
        apiCostBreakdown,
        recentErrors,
        processingTimeBySection,
        apiStatuses,
        costTrend,
        modelCostBreakdown,
        errorTrend,
        errorsByType,
        processingTimeTrend,
      },
    }

    // Return with cache headers - cache for 1 minute, stale-while-revalidate for 5 minutes
    return NextResponse.json(metrics, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    })
  } catch (error) {
    console.error("Admin metrics API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    )
  }
}

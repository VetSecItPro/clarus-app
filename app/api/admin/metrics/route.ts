import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateAdmin, AuthErrors } from "@/lib/auth"
import { z } from "zod"
import { parseQuery } from "@/lib/schemas"
import type { Database } from "@/types/database.types"

// Schema for metrics query params
const metricsQuerySchema = z.object({
  timeRange: z.coerce.number().int().min(1).max(365).optional().default(30),
})

// Lazy initialization of admin client to avoid build-time env var issues
let _adminClient: ReturnType<typeof createClient<Database, "clarus">> | null = null
function getSupabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient<Database, "clarus">(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: "clarus" } }
    )
  }
  return _adminClient
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

    // Validate query parameters
    const validation = parseQuery(metricsQuerySchema, request.nextUrl.searchParams)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    const timeRange = validation.data.timeRange

    const now = new Date()
    const startDate = new Date(now.getTime() - timeRange * 24 * 60 * 60 * 1000)
    const startDateStr = startDate.toISOString()
    const todayMidnight = new Date(now)
    todayMidnight.setHours(0, 0, 0, 0)
    const todayStart = todayMidnight.toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const previousPeriodStart = new Date(now.getTime() - timeRange * 2 * 24 * 60 * 60 * 1000).toISOString()
    const previousPeriodEnd = new Date(now.getTime() - timeRange * 24 * 60 * 60 * 1000).toISOString()

    // Fetch all metrics in parallel
    const [
      usersResult,
      newUsersResult,
      activeUsersResult,
      contentResult,
      contentTodayResult,
      contentByTypeResult,
      subscriptionsResult,
      chatThreadsResult,
      chatMessagesResult,
      signupTrendResult,
      contentTrendResult,
      domainsResult,
      truthRatingsResult,
      processingResult,
      apiUsageResult,
      apiUsage7DaysResult,
      processingMetrics7DaysResult,
      contentMonthlyResult,
      apiUsageHourlyResult,
      previousUsersResult,
      previousContentResult,
      userTiersResult,
    ] = await Promise.all([
      // Total users
      getSupabaseAdmin().from("users").select("id", { count: "exact", head: true }),
      // New users today
      getSupabaseAdmin().from("users").select("id", { count: "exact", head: true })
        .gte("created_at", todayStart),
      // Active users (content in last N days)
      getSupabaseAdmin().from("content").select("user_id")
        .gte("date_added", startDateStr),
      // Total content
      getSupabaseAdmin().from("content").select("id", { count: "exact", head: true }),
      // Content today
      getSupabaseAdmin().from("content").select("id", { count: "exact", head: true })
        .gte("date_added", todayStart),
      // Content by type
      getSupabaseAdmin().from("content").select("type"),
      // Subscriptions
      getSupabaseAdmin().from("users").select("subscription_status"),
      // Chat threads
      getSupabaseAdmin().from("chat_threads").select("id", { count: "exact", head: true }),
      // Chat messages
      getSupabaseAdmin().from("chat_messages").select("id", { count: "exact", head: true }),
      // Signup trend
      getSupabaseAdmin().from("users").select("created_at")
        .gte("created_at", startDateStr)
        .order("created_at", { ascending: true }),
      // Content trend
      getSupabaseAdmin().from("content").select("date_added")
        .gte("date_added", startDateStr)
        .order("date_added", { ascending: true }),
      // Top domains
      getSupabaseAdmin().from("domains").select("domain, total_analyses, avg_quality_score")
        .order("total_analyses", { ascending: false })
        .limit(10),
      // Truth ratings from summaries (only need overall_rating from the JSON)
      getSupabaseAdmin().from("summaries").select("truth_check->overall_rating"),
      // Processing metrics
      getSupabaseAdmin().from("processing_metrics").select("status, processing_time_ms, section_type")
        .gte("created_at", startDateStr),
      // API usage/costs today
      getSupabaseAdmin().from("api_usage").select("estimated_cost_usd, status, api_name, operation, error_message, created_at")
        .gte("created_at", todayStart),
      // API usage for 7 days (for trends)
      getSupabaseAdmin().from("api_usage").select("estimated_cost_usd, status, api_name, operation, error_message, created_at, tokens_input, tokens_output, metadata")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: true }),
      // Processing metrics for 7 days (for trends)
      getSupabaseAdmin().from("processing_metrics").select("processing_time_ms, created_at, status")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: true }),
      // Content by type with date for monthly breakdown
      getSupabaseAdmin().from("content").select("type, date_added")
        .gte("date_added", new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()),
      // API usage for last 24 hours (for status calculation)
      getSupabaseAdmin().from("api_usage").select("api_name, status")
        .gte("created_at", todayStart),
      // Previous period users (for growth calculation)
      getSupabaseAdmin().from("users").select("id", { count: "exact", head: true })
        .gte("created_at", previousPeriodStart)
        .lt("created_at", previousPeriodEnd),
      // Previous period content (for growth calculation)
      getSupabaseAdmin().from("content").select("id", { count: "exact", head: true })
        .gte("date_added", previousPeriodStart)
        .lt("date_added", previousPeriodEnd),
      // User tiers breakdown
      getSupabaseAdmin().from("users").select("tier"),
    ])

    // Calculate unique active users
    const activeUserIds = new Set(activeUsersResult.data?.map(c => c.user_id) || [])

    // Calculate content by type
    const typeCount: Record<string, number> = {}
    contentByTypeResult.data?.forEach(c => {
      const contentType = c.type || "unknown"
      typeCount[contentType] = (typeCount[contentType] || 0) + 1
    })
    const contentByType = [
      { name: "YouTube", value: typeCount["youtube"] || 0, color: COLORS.red },
      { name: "Articles", value: typeCount["article"] || 0, color: COLORS.blue },
      { name: "X Posts", value: typeCount["x_post"] || 0, color: COLORS.cyan },
      { name: "PDFs", value: typeCount["pdf"] || 0, color: COLORS.purple },
    ]

    // Calculate subscriptions
    const subCounts = { active: 0, trialing: 0, canceled: 0 }
    subscriptionsResult.data?.forEach(u => {
      if (u.subscription_status === "active") subCounts.active++
      else if (u.subscription_status === "trialing") subCounts.trialing++
      else if (u.subscription_status === "canceled") subCounts.canceled++
    })

    // Calculate users by tier
    const usersByTier: TierBreakdown = { free: 0, starter: 0, pro: 0 }
    userTiersResult.data?.forEach(u => {
      const tier = u.tier as string | null
      if (tier === "starter") usersByTier.starter++
      else if (tier === "pro") usersByTier.pro++
      else usersByTier.free++
    })

    // Calculate signup trend (group by day)
    const signupByDay: Record<string, number> = {}
    signupTrendResult.data?.forEach(u => {
      if (u.created_at) {
        const day = new Date(u.created_at).toISOString().split("T")[0]
        signupByDay[day] = (signupByDay[day] || 0) + 1
      }
    })
    const signupTrend = Object.entries(signupByDay).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    }))

    // Calculate content trend (group by day)
    const contentByDay: Record<string, number> = {}
    contentTrendResult.data?.forEach(c => {
      if (c.date_added) {
        const day = new Date(c.date_added).toISOString().split("T")[0]
        contentByDay[day] = (contentByDay[day] || 0) + 1
      }
    })
    const contentTrend = Object.entries(contentByDay).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    }))

    // Top domains
    const topDomains = (domainsResult.data || []).map(d => ({
      domain: d.domain,
      count: d.total_analyses,
      avgScore: d.avg_quality_score || 0,
    }))

    // Truth rating distribution
    const ratingCounts: Record<string, number> = {}
    truthRatingsResult.data?.forEach(s => {
      const rating = (s as Record<string, unknown>).overall_rating as string || "Unknown"
      ratingCounts[rating] = (ratingCounts[rating] || 0) + 1
    })
    const truthRatingDistribution = [
      { rating: "Accurate", count: ratingCounts["Accurate"] || 0, color: COLORS.green },
      { rating: "Mostly Accurate", count: ratingCounts["Mostly Accurate"] || 0, color: COLORS.cyan },
      { rating: "Mixed", count: ratingCounts["Mixed"] || 0, color: COLORS.yellow },
      { rating: "Questionable", count: ratingCounts["Questionable"] || 0, color: COLORS.orange },
      { rating: "Unreliable", count: ratingCounts["Unreliable"] || 0, color: COLORS.red },
    ]

    // Processing metrics
    const processingData = (processingResult.data || []) as { status: string; processing_time_ms: number | null; section_type: string | null }[]
    const successCount = processingData.filter(p => p.status === "success").length
    const processingSuccessRate = processingData.length > 0
      ? (successCount / processingData.length) * 100
      : 100
    const avgProcessingTime = processingData.length > 0
      ? processingData.reduce((sum, p) => sum + (p.processing_time_ms || 0), 0) / processingData.length
      : 0

    // Calculate processing time by section type
    const processingBySection: Record<string, { totalTime: number; count: number }> = {}
    processingData.forEach(p => {
      const section = p.section_type || "unknown"
      if (!processingBySection[section]) {
        processingBySection[section] = { totalTime: 0, count: 0 }
      }
      processingBySection[section].totalTime += p.processing_time_ms || 0
      processingBySection[section].count++
    })
    const processingTimeBySection: ProcessingTimeBySection[] = Object.entries(processingBySection)
      .map(([section, data]) => ({
        section,
        avgTime: Math.round(data.totalTime / data.count),
        count: data.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)

    // API costs
    const apiData = (apiUsageResult.data || []) as {
      estimated_cost_usd: number | string | null
      status: string
      api_name: string | null
      operation: string | null
      error_message: string | null
      created_at: string | null
    }[]
    const apiCostsToday = apiData.reduce((sum, a) => sum + (Number(a.estimated_cost_usd) || 0), 0)
    const apiErrors = apiData.filter(a => a.status === "error").length
    const errorRate = apiData.length > 0 ? (apiErrors / apiData.length) * 100 : 0

    // Calculate API cost breakdown by API name
    const costByApi: Record<string, { cost: number; calls: number }> = {}
    apiData.forEach(a => {
      const apiName = a.api_name || "unknown"
      if (!costByApi[apiName]) {
        costByApi[apiName] = { cost: 0, calls: 0 }
      }
      costByApi[apiName].cost += Number(a.estimated_cost_usd) || 0
      costByApi[apiName].calls++
    })
    const apiCostBreakdown: ApiCostBreakdown[] = Object.entries(costByApi)
      .map(([api, data]) => ({
        api,
        cost: Math.round(data.cost * 10000) / 10000,
        calls: data.calls,
      }))
      .sort((a, b) => b.cost - a.cost)

    // Get recent errors
    const recentErrors: RecentError[] = apiData
      .filter(a => a.status === "error" && a.error_message)
      .slice(0, 10)
      .map(a => ({
        timestamp: a.created_at ? new Date(a.created_at).toLocaleTimeString() : "Unknown",
        api: a.api_name || "unknown",
        message: a.error_message || "Unknown error",
      }))

    // Calculate content by type monthly for bar chart
    const monthlyContentData = (contentMonthlyResult.data || []) as { type: string | null; date_added: string | null }[]
    const last3Months = [
      new Date(now.getFullYear(), now.getMonth() - 2, 1),
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
      new Date(now.getFullYear(), now.getMonth(), 1),
    ]
    const contentByTypeMonthly: ContentByTypeMonthly[] = last3Months.map(monthStart => {
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
      const monthData = monthlyContentData.filter(c => {
        if (!c.date_added) return false
        const date = new Date(c.date_added)
        return date >= monthStart && date <= monthEnd
      })
      const counts = { youtube: 0, article: 0, x_post: 0, pdf: 0 }
      monthData.forEach(c => {
        const t = c.type as keyof typeof counts
        if (t && Object.prototype.hasOwnProperty.call(counts, t)) {
          counts[t]++
        }
      })
      return {
        month: monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        ...counts,
      }
    })

    // Calculate API statuses from last 24 hours of data
    const dailyApiData = (apiUsageHourlyResult.data || []) as { api_name: string | null; status: string }[]

    // All services we track
    const apiServices = [
      { name: "openrouter", label: "OpenRouter (AI Analysis)", tracked: true },
      { name: "supadata", label: "Supadata (YouTube Transcripts)", tracked: true },
      { name: "firecrawl", label: "FireCrawl (Article Scraping)", tracked: true },
      { name: "tavily", label: "Tavily (Web Search)", tracked: true },
      { name: "polar", label: "Polar (Payments)", tracked: true },
      { name: "supabase", label: "Supabase (Database)", tracked: false },
      { name: "vercel", label: "Vercel (Hosting)", tracked: false },
    ]

    const apiStatuses: ApiStatusItem[] = apiServices.map(service => {
      if (!service.tracked) {
        return {
          name: service.name,
          label: service.label,
          status: "operational" as const,
          errorRate: 0,
          totalCalls: -1,
        }
      }

      const serviceCalls = dailyApiData.filter(a => a.api_name === service.name)
      const totalCalls = serviceCalls.length
      const errorCalls = serviceCalls.filter(a => a.status === "error").length
      const serviceErrorRate = totalCalls > 0 ? (errorCalls / totalCalls) * 100 : 0

      let status: "operational" | "degraded" | "down" | "unknown"
      if (totalCalls === 0) {
        status = "operational"
      } else if (serviceErrorRate > 20) {
        status = "down"
      } else if (serviceErrorRate > 5) {
        status = "degraded"
      } else {
        status = "operational"
      }

      return {
        name: service.name,
        label: service.label,
        status,
        errorRate: Math.round(serviceErrorRate * 10) / 10,
        totalCalls,
      }
    })

    // ====== 7-Day Trend Calculations ======

    const apiData7Days = (apiUsage7DaysResult.data || []) as {
      estimated_cost_usd: number | string | null
      status: string
      api_name: string | null
      operation: string | null
      error_message: string | null
      created_at: string | null
      tokens_input: number | null
      tokens_output: number | null
      metadata: { model?: string } | null
    }[]

    // Calculate daily cost trend (last 7 days)
    const costByDayMap: Record<string, number> = {}
    apiData7Days.forEach(a => {
      if (a.created_at) {
        const day = new Date(a.created_at).toISOString().split("T")[0]
        costByDayMap[day] = (costByDayMap[day] || 0) + (Number(a.estimated_cost_usd) || 0)
      }
    })
    const costTrend: CostTrendData[] = Object.entries(costByDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cost]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        cost: Math.round(cost * 10000) / 10000,
      }))

    // Calculate OpenRouter model breakdown
    const modelCosts: Record<string, { cost: number; calls: number; tokensInput: number; tokensOutput: number }> = {}
    apiData7Days
      .filter(a => a.api_name === "openrouter")
      .forEach(a => {
        const model = a.metadata?.model || "unknown"
        if (!modelCosts[model]) {
          modelCosts[model] = { cost: 0, calls: 0, tokensInput: 0, tokensOutput: 0 }
        }
        modelCosts[model].cost += Number(a.estimated_cost_usd) || 0
        modelCosts[model].calls++
        modelCosts[model].tokensInput += a.tokens_input || 0
        modelCosts[model].tokensOutput += a.tokens_output || 0
      })
    const modelCostBreakdown: ModelCostBreakdown[] = Object.entries(modelCosts)
      .map(([model, data]) => ({
        model,
        cost: Math.round(data.cost * 10000) / 10000,
        calls: data.calls,
        tokensInput: data.tokensInput,
        tokensOutput: data.tokensOutput,
      }))
      .sort((a, b) => b.cost - a.cost)

    // Calculate daily error rate trend (last 7 days)
    const errorsByDay: Record<string, { errors: number; total: number }> = {}
    apiData7Days.forEach(a => {
      if (a.created_at) {
        const day = new Date(a.created_at).toISOString().split("T")[0]
        if (!errorsByDay[day]) {
          errorsByDay[day] = { errors: 0, total: 0 }
        }
        errorsByDay[day].total++
        if (a.status === "error") {
          errorsByDay[day].errors++
        }
      }
    })
    const errorTrend: ErrorTrendData[] = Object.entries(errorsByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        errorRate: data.total > 0 ? Math.round((data.errors / data.total) * 1000) / 10 : 0,
        errorCount: data.errors,
        totalCount: data.total,
      }))

    // Group errors by type/category
    const errorTypeMap: Record<string, number> = {}
    apiData7Days
      .filter(a => a.status === "error" && a.error_message)
      .forEach(a => {
        const message = a.error_message || "Unknown"
        let errorType = "Other"
        if (message.toLowerCase().includes("timeout")) {
          errorType = "Timeout"
        } else if (message.toLowerCase().includes("rate limit") || message.toLowerCase().includes("429")) {
          errorType = "Rate Limit"
        } else if (message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("401")) {
          errorType = "Auth Error"
        } else if (message.toLowerCase().includes("not found") || message.toLowerCase().includes("404")) {
          errorType = "Not Found"
        } else if (message.toLowerCase().includes("server") || message.toLowerCase().includes("500")) {
          errorType = "Server Error"
        } else if (message.toLowerCase().includes("network") || message.toLowerCase().includes("connection")) {
          errorType = "Network Error"
        }
        errorTypeMap[errorType] = (errorTypeMap[errorType] || 0) + 1
      })
    const totalErrorCount = Object.values(errorTypeMap).reduce((sum, count) => sum + count, 0)
    const errorsByType: ErrorByType[] = Object.entries(errorTypeMap)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalErrorCount > 0 ? Math.round((count / totalErrorCount) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Calculate daily processing time trend (last 7 days)
    const processingMetrics7Days = (processingMetrics7DaysResult.data || []) as {
      processing_time_ms: number | null
      created_at: string | null
      status: string
    }[]
    const processingByDay: Record<string, { totalTime: number; count: number }> = {}
    processingMetrics7Days
      .filter(p => p.status === "success")
      .forEach(p => {
        if (p.created_at) {
          const day = new Date(p.created_at).toISOString().split("T")[0]
          if (!processingByDay[day]) {
            processingByDay[day] = { totalTime: 0, count: 0 }
          }
          processingByDay[day].totalTime += p.processing_time_ms || 0
          processingByDay[day].count++
        }
      })
    const processingTimeTrend: ProcessingTimeTrendData[] = Object.entries(processingByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        avgTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0,
        count: data.count,
      }))

    // Calculate growth percentages
    const totalUsers = usersResult.count || 0
    const totalContent = contentResult.count || 0
    const avgContentPerUser = totalUsers > 0 ? totalContent / totalUsers : 0

    const currentPeriodSignups = signupTrend.reduce((sum, d) => sum + d.count, 0)
    const previousPeriodUsers = previousUsersResult.count || 0
    const userGrowthPercent = previousPeriodUsers > 0
      ? ((currentPeriodSignups - previousPeriodUsers) / previousPeriodUsers) * 100
      : currentPeriodSignups > 0 ? 100 : 0

    const currentPeriodContent = contentTrend.reduce((sum, d) => sum + d.count, 0)
    const previousPeriodContent = previousContentResult.count || 0
    const contentGrowthPercent = previousPeriodContent > 0
      ? ((currentPeriodContent - previousPeriodContent) / previousPeriodContent) * 100
      : currentPeriodContent > 0 ? 100 : 0

    const metrics: DashboardMetrics = {
      totalUsers,
      activeUsers: activeUserIds.size,
      newUsersToday: newUsersResult.count || 0,
      userGrowthPercent: Math.round(userGrowthPercent * 10) / 10,
      usersByTier,
      totalContent,
      contentToday: contentTodayResult.count || 0,
      contentGrowthPercent: Math.round(contentGrowthPercent * 10) / 10,
      contentByType,
      contentByTypeMonthly,
      activeSubscriptions: subCounts.active,
      trialUsers: subCounts.trialing,
      mrr: subCounts.active * 9.99, // Will be overridden by MRR API on client
      mrrGrowthPercent: 0,
      avgContentPerUser: Math.round(avgContentPerUser * 10) / 10,
      chatThreads: chatThreadsResult.count || 0,
      chatMessages: chatMessagesResult.count || 0,
      processingSuccessRate: Math.round(processingSuccessRate * 10) / 10,
      avgProcessingTime: Math.round(avgProcessingTime),
      apiCostsToday: Math.round(apiCostsToday * 100) / 100,
      errorRate: Math.round(errorRate * 10) / 10,
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

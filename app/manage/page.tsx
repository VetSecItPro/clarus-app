"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Users, FileText, TrendingUp, DollarSign,
  Activity, Youtube, Newspaper, MessageSquare,
  AlertTriangle, CheckCircle, Clock, Zap,
  ArrowUpRight, ArrowDownRight, Loader2,
  BarChart3, PieChart, RefreshCw, ChevronDown, ChevronUp,
  ArrowLeft
} from "lucide-react"
import Link from "next/link"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, BarChart, Bar, LineChart, Line
} from "recharts"
import { cn } from "@/lib/utils"

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

interface DashboardMetrics {
  totalUsers: number
  activeUsers: number
  newUsersToday: number
  userGrowthPercent: number
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

// Cache configuration
const CACHE_KEY = "admin_dashboard_metrics"
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

interface CachedData {
  metrics: DashboardMetrics
  timestamp: number
  timeRange: number
}

function getCachedMetrics(timeRange: number): DashboardMetrics | null {
  if (typeof window === "undefined") return null
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const data: CachedData = JSON.parse(cached)
    const isExpired = Date.now() - data.timestamp > CACHE_DURATION_MS
    const isSameTimeRange = data.timeRange === timeRange
    if (isExpired || !isSameTimeRange) return null
    return data.metrics
  } catch {
    return null
  }
}

function setCachedMetrics(metrics: DashboardMetrics, timeRange: number): void {
  if (typeof window === "undefined") return
  try {
    const data: CachedData = {
      metrics,
      timestamp: Date.now(),
      timeRange,
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors
  }
}

// Metric Card Component
function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "text-[#1d9bf0]",
  loading = false
}: {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ElementType
  iconColor?: string
  loading?: boolean
}) {
  const isPositive = change && change > 0
  const isNegative = change && change < 0

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-xl bg-white/[0.06]", iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            isPositive && "text-green-400 bg-green-500/10",
            isNegative && "text-red-400 bg-red-500/10",
            !isPositive && !isNegative && "text-white/50 bg-white/[0.06]"
          )}>
            {isPositive && <ArrowUpRight className="w-3 h-3" />}
            {isNegative && <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-white/[0.06] rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-semibold text-white mb-1">{value}</p>
      )}
      <p className="text-sm text-white/50">{title}</p>
      {changeLabel && <p className="text-xs text-white/30 mt-1">{changeLabel}</p>}
    </div>
  )
}

// Chart Card Component
function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5", className)}>
      <h3 className="text-sm font-medium text-white/70 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// Time filter component
function TimeFilter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const options = [
    { label: "7D", value: 7 },
    { label: "30D", value: 30 },
    { label: "60D", value: 60 },
    { label: "90D", value: 90 },
  ]

  return (
    <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
            value === opt.value
              ? "bg-[#1d9bf0] text-white"
              : "text-white/50 hover:text-white/70"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// System Health expandable item types
type HealthItemKey = "apiStatus" | "apiCosts" | "errorRate" | "processingTime"

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [timeRange, setTimeRange] = useState(30)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(AUTO_REFRESH_INTERVAL_MS / 1000)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const [expandedHealthItems, setExpandedHealthItems] = useState<Set<HealthItemKey>>(new Set())

  const toggleHealthItem = (key: HealthItemKey) => {
    setExpandedHealthItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // Load cached metrics on mount and set up auto-refresh
  useEffect(() => {
    // Try to load from cache first
    const cached = getCachedMetrics(timeRange)
    if (cached) {
      setMetrics(cached)
      setLoading(false)
    }

    checkAdminAndFetch()

    // Set up auto-refresh interval
    refreshTimerRef.current = setInterval(() => {
      fetchMetrics(false) // Silent refresh (no loading state)
    }, AUTO_REFRESH_INTERVAL_MS)

    // Set up countdown timer
    countdownRef.current = setInterval(() => {
      setNextRefreshIn(prev => {
        if (prev <= 1) return AUTO_REFRESH_INTERVAL_MS / 1000
        return prev - 1
      })
    }, 1000)

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // Refetch when time range changes
  useEffect(() => {
    if (isAdmin) {
      const cached = getCachedMetrics(timeRange)
      if (cached) {
        setMetrics(cached)
      } else {
        fetchMetrics(true)
      }
    }
  }, [timeRange, isAdmin])

  async function checkAdminAndFetch() {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace("/login")
        return
      }

      // Check if user is admin
      const { data: userData } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", session.user.id)
        .single()

      if (!userData?.is_admin) {
        router.replace("/")
        return
      }

      setIsAdmin(true)
      await fetchMetrics(true)
    } catch (error) {
      console.error("Admin check failed:", error)
      router.replace("/")
    }
  }

  async function fetchMetrics(showLoading = true) {
    if (showLoading) setRefreshing(true)
    try {
      const now = new Date()
      const startDate = new Date(now.getTime() - timeRange * 24 * 60 * 60 * 1000)
      const startDateStr = startDate.toISOString()
      const todayMidnight = new Date(now)
      todayMidnight.setHours(0, 0, 0, 0)
      const todayStart = todayMidnight.toISOString()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      // For growth calculations: compare current period to previous period
      const previousPeriodStart = new Date(now.getTime() - timeRange * 2 * 24 * 60 * 60 * 1000).toISOString()
      const previousPeriodEnd = new Date(now.getTime() - timeRange * 24 * 60 * 60 * 1000).toISOString()

      // Get current user ID for MRR API call
      const { data: { session } } = await supabase.auth.getSession()
      const currentUserId = session?.user?.id

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
        mrrApiResult,
        contentMonthlyResult,
        apiUsageHourlyResult,
        previousUsersResult,
        previousContentResult,
      ] = await Promise.all([
        // Total users
        supabase.from("users").select("id", { count: "exact", head: true }),
        // New users today
        supabase.from("users").select("id", { count: "exact", head: true })
          .gte("created_at", todayStart),
        // Active users (content in last 30 days)
        supabase.from("content").select("user_id")
          .gte("date_added", startDateStr),
        // Total content
        supabase.from("content").select("id", { count: "exact", head: true }),
        // Content today
        supabase.from("content").select("id", { count: "exact", head: true })
          .gte("date_added", todayStart),
        // Content by type
        supabase.from("content").select("type"),
        // Subscriptions
        supabase.from("users").select("subscription_status"),
        // Chat threads
        supabase.from("chat_threads").select("id", { count: "exact", head: true }),
        // Chat messages
        supabase.from("chat_messages").select("id", { count: "exact", head: true }),
        // Signup trend
        supabase.from("users").select("created_at")
          .gte("created_at", startDateStr)
          .order("created_at", { ascending: true }),
        // Content trend
        supabase.from("content").select("date_added")
          .gte("date_added", startDateStr)
          .order("date_added", { ascending: true }),
        // Top domains
        supabase.from("domains").select("domain, total_analyses, avg_quality_score")
          .order("total_analyses", { ascending: false })
          .limit(10),
        // Truth ratings from summaries
        supabase.from("summaries").select("truth_check"),
        // Processing metrics (new table - use any to bypass type check until types regenerated)
        (supabase.from as any)("processing_metrics").select("status, processing_time_ms, section_type")
          .gte("created_at", startDateStr),
        // API usage/costs today (new table - use any to bypass type check until types regenerated)
        (supabase.from as any)("api_usage").select("estimated_cost_usd, status, api_name, operation, error_message, created_at")
          .gte("created_at", todayStart),
        // API usage for 7 days (for trends)
        (supabase.from as any)("api_usage").select("estimated_cost_usd, status, api_name, operation, error_message, created_at, tokens_input, tokens_output, metadata")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: true }),
        // Processing metrics for 7 days (for trends)
        (supabase.from as any)("processing_metrics").select("processing_time_ms, created_at, status")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: true }),
        // MRR data from Stripe API
        fetch(`/api/admin/mrr?userId=${currentUserId}`).then(res => res.json()).catch(() => null),
        // Content by type with date for monthly breakdown
        supabase.from("content").select("type, date_added")
          .gte("date_added", new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()),
        // API usage for last 24 hours (for status calculation)
        (supabase.from as any)("api_usage").select("api_name, status")
          .gte("created_at", todayStart),
        // Previous period users (for growth calculation)
        supabase.from("users").select("id", { count: "exact", head: true })
          .gte("created_at", previousPeriodStart)
          .lt("created_at", previousPeriodEnd),
        // Previous period content (for growth calculation)
        supabase.from("content").select("id", { count: "exact", head: true })
          .gte("date_added", previousPeriodStart)
          .lt("date_added", previousPeriodEnd),
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
        const rating = (s.truth_check as { overall_rating?: string })?.overall_rating || "Unknown"
        ratingCounts[rating] = (ratingCounts[rating] || 0) + 1
      })
      const truthRatingDistribution = [
        { rating: "Accurate", count: ratingCounts["Accurate"] || 0, color: COLORS.green },
        { rating: "Mostly Accurate", count: ratingCounts["Mostly Accurate"] || 0, color: COLORS.cyan },
        { rating: "Mixed", count: ratingCounts["Mixed"] || 0, color: COLORS.yellow },
        { rating: "Questionable", count: ratingCounts["Questionable"] || 0, color: COLORS.orange },
        { rating: "Unreliable", count: ratingCounts["Unreliable"] || 0, color: COLORS.red },
      ]

      // Processing metrics (typed as any since table is new)
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

      // API costs (typed as any since table is new)
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
          if (t && counts.hasOwnProperty(t)) {
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

      // All services we track - some are logged, some are inferred
      const apiServices = [
        { name: "openrouter", label: "OpenRouter (AI Analysis)", tracked: true },
        { name: "supadata", label: "Supadata (YouTube Transcripts)", tracked: true },
        { name: "firecrawl", label: "FireCrawl (Article Scraping)", tracked: true },
        { name: "tavily", label: "Tavily (Web Search)", tracked: true },
        { name: "stripe", label: "Stripe (Payments)", tracked: true },
        { name: "supabase", label: "Supabase (Database)", tracked: false }, // Inferred from dashboard loading
        { name: "vercel", label: "Vercel (Hosting)", tracked: false }, // Inferred from page serving
      ]

      const apiStatuses: ApiStatusItem[] = apiServices.map(service => {
        // For services we don't log directly, they're operational if the dashboard loaded
        if (!service.tracked) {
          return {
            name: service.name,
            label: service.label,
            status: "operational" as const,
            errorRate: 0,
            totalCalls: -1, // -1 indicates inferred status
          }
        }

        const serviceCalls = dailyApiData.filter(a => a.api_name === service.name)
        const totalCalls = serviceCalls.length
        const errorCalls = serviceCalls.filter(a => a.status === "error").length
        const errorRate = totalCalls > 0 ? (errorCalls / totalCalls) * 100 : 0

        let status: "operational" | "degraded" | "down" | "unknown"
        if (totalCalls === 0) {
          status = "operational" // No activity today = assume operational
        } else if (errorRate > 20) {
          status = "down"
        } else if (errorRate > 5) {
          status = "degraded"
        } else {
          status = "operational"
        }

        return {
          name: service.name,
          label: service.label,
          status,
          errorRate: Math.round(errorRate * 10) / 10,
          totalCalls,
        }
      })

      // ====== 7-Day Trend Calculations ======

      // Type the 7-day api usage data
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
      const costByDay: Record<string, number> = {}
      apiData7Days.forEach(a => {
        if (a.created_at) {
          const day = new Date(a.created_at).toISOString().split("T")[0]
          costByDay[day] = (costByDay[day] || 0) + (Number(a.estimated_cost_usd) || 0)
        }
      })
      const costTrend: CostTrendData[] = Object.entries(costByDay)
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
          // Categorize error messages
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

      // MRR from Stripe API (fallback to estimate if API fails)
      const stripeData = mrrApiResult && !mrrApiResult.error ? mrrApiResult : null
      const mrr = stripeData?.mrr ?? (subCounts.active * 9.99)
      const mrrGrowthPercent = stripeData?.mrrGrowthPercent ?? 0
      const stripeSubs = stripeData?.activeSubscriptions ?? subCounts.active
      const stripeTrials = stripeData?.trialingSubscriptions ?? subCounts.trialing

      // Calculate growth percentages (comparing to previous period)
      const totalUsers = usersResult.count || 0
      const totalContent = contentResult.count || 0
      const avgContentPerUser = totalUsers > 0 ? totalContent / totalUsers : 0

      // Real growth calculations based on signup trend data
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

      const newMetrics: DashboardMetrics = {
        totalUsers,
        activeUsers: activeUserIds.size,
        newUsersToday: newUsersResult.count || 0,
        userGrowthPercent: Math.round(userGrowthPercent * 10) / 10,
        totalContent,
        contentToday: contentTodayResult.count || 0,
        contentGrowthPercent: Math.round(contentGrowthPercent * 10) / 10,
        contentByType,
        contentByTypeMonthly,
        activeSubscriptions: stripeSubs,
        trialUsers: stripeTrials,
        mrr,
        mrrGrowthPercent,
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

      setMetrics(newMetrics)
      setCachedMetrics(newMetrics, timeRange)
      setLastUpdated(new Date())
      setNextRefreshIn(AUTO_REFRESH_INTERVAL_MS / 1000) // Reset countdown
    } catch (error) {
      console.error("Failed to fetch metrics:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (!isAdmin && loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="text-sm hidden sm:inline">Back to App</span>
                </Link>
                <div className="h-6 w-px bg-white/10 hidden sm:block" />
                <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/50 mt-1">
                {lastUpdated && <span>Updated: {lastUpdated.toLocaleTimeString()}</span>}
                <span className="text-white/30">|</span>
                <span className="text-white/40">
                  Next refresh: {Math.floor(nextRefreshIn / 60)}:{String(nextRefreshIn % 60).padStart(2, "0")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TimeFilter value={timeRange} onChange={setTimeRange} />
              <button
                onClick={() => fetchMetrics(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] transition-colors disabled:opacity-50"
                title="Refresh now"
              >
                <RefreshCw className={cn("w-4 h-4 text-white/70", refreshing && "animate-spin")} />
                <span className="text-sm text-white/70 hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Total Users"
            value={metrics?.totalUsers.toLocaleString() || 0}
            change={metrics?.userGrowthPercent}
            changeLabel={`${metrics?.newUsersToday || 0} today`}
            icon={Users}
            iconColor="text-[#1d9bf0]"
            loading={loading}
          />
          <MetricCard
            title="Content Analyzed"
            value={metrics?.totalContent.toLocaleString() || 0}
            change={metrics?.contentGrowthPercent}
            changeLabel={`${metrics?.contentToday || 0} today`}
            icon={FileText}
            iconColor="text-purple-400"
            loading={loading}
          />
          <MetricCard
            title="Active Subscriptions"
            value={metrics?.activeSubscriptions || 0}
            changeLabel={`${metrics?.trialUsers || 0} in trial`}
            icon={TrendingUp}
            iconColor="text-green-400"
            loading={loading}
          />
          <MetricCard
            title="MRR"
            value={`$${metrics?.mrr.toFixed(2) || "0.00"}`}
            change={metrics?.mrrGrowthPercent}
            icon={DollarSign}
            iconColor="text-yellow-400"
            loading={loading}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Signup Trend */}
          <ChartCard title="User Signups">
            <div className="h-[200px]">
              {loading ? (
                <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics?.signupTrend || []}>
                    <defs>
                      <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    />
                    <Tooltip
                      wrapperStyle={{ outline: "none", background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
                      contentStyle={{
                        backgroundColor: "#000",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.9)", fontWeight: 500 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={COLORS.blue}
                      strokeWidth={2}
                      fill="url(#signupGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>

          {/* Content Trend */}
          <ChartCard title="Content Analyzed">
            <div className="h-[200px]">
              {loading ? (
                <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics?.contentTrend || []}>
                    <defs>
                      <linearGradient id="contentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    />
                    <Tooltip
                      wrapperStyle={{ outline: "none", background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
                      contentStyle={{
                        backgroundColor: "#000",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.9)", fontWeight: 500 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={COLORS.purple}
                      strokeWidth={2}
                      fill="url(#contentGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </div>

        {/* Second Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Active Users"
            value={metrics?.activeUsers || 0}
            changeLabel={`${timeRange} day period`}
            icon={Activity}
            iconColor="text-cyan-400"
            loading={loading}
          />
          <MetricCard
            title="Avg Content/User"
            value={metrics?.avgContentPerUser || 0}
            icon={BarChart3}
            iconColor="text-orange-400"
            loading={loading}
          />
          <MetricCard
            title="Chat Threads"
            value={metrics?.chatThreads.toLocaleString() || 0}
            changeLabel={`${metrics?.chatMessages.toLocaleString() || 0} messages`}
            icon={MessageSquare}
            iconColor="text-pink-400"
            loading={loading}
          />
          <MetricCard
            title="Processing Success"
            value={`${metrics?.processingSuccessRate || 100}%`}
            changeLabel={`${metrics?.avgProcessingTime || 0}ms avg`}
            icon={CheckCircle}
            iconColor="text-green-400"
            loading={loading}
          />
        </div>

        {/* Content Breakdown & Truth Ratings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Content by Type - Monthly Comparison */}
          <ChartCard title="Content by Type (Last 3 Months)">
            <div className="h-[200px]">
              {loading ? (
                <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
              ) : (() => {
                const monthlyData = metrics?.contentByTypeMonthly || []
                const hasData = monthlyData.some(m => m.youtube > 0 || m.article > 0 || m.x_post > 0 || m.pdf > 0)

                if (!hasData) {
                  // Fallback to current totals pie chart when no monthly data
                  return (
                    <div className="flex items-center w-full h-full gap-6">
                      <ResponsiveContainer width="50%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={metrics?.contentByType || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {(metrics?.contentByType || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            wrapperStyle={{ outline: "none", background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
                            contentStyle={{
                              backgroundColor: "#000",
                              border: "1px solid rgba(255,255,255,0.2)",
                              borderRadius: "8px",
                              fontSize: "12px",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                            }}
                            labelStyle={{ color: "rgba(255,255,255,0.9)", fontWeight: 500 }}
                          />
                        </RechartsPie>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {(metrics?.contentByType || []).map((item) => (
                          <div key={item.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-sm text-white/70">{item.name}</span>
                            </div>
                            <span className="text-sm font-medium text-white">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }

                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                      />
                      <Tooltip
                        wrapperStyle={{ outline: "none", background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
                        contentStyle={{
                          backgroundColor: "#000",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                        }}
                        labelStyle={{ color: "rgba(255,255,255,0.9)", fontWeight: 500, marginBottom: "4px" }}
                        cursor={{ fill: "transparent" }}
                      />
                      <Bar dataKey="youtube" name="YouTube" fill={COLORS.red} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="article" name="Articles" fill={COLORS.blue} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="x_post" name="X Posts" fill={COLORS.cyan} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="pdf" name="PDFs" fill={COLORS.purple} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              })()}
            </div>
            {/* Legend - only show for bar chart */}
            {metrics?.contentByTypeMonthly?.some(m => m.youtube > 0 || m.article > 0 || m.x_post > 0 || m.pdf > 0) && (
              <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-white/[0.06]">
                {[
                  { name: "YouTube", color: COLORS.red },
                  { name: "Articles", color: COLORS.blue },
                  { name: "X Posts", color: COLORS.cyan },
                  { name: "PDFs", color: COLORS.purple },
                ].map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-white/60">{item.name}</span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          {/* Truth Rating Distribution */}
          <ChartCard title="Truth Rating Distribution">
            <div className="h-[200px]">
              {loading ? (
                <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics?.truthRatingDistribution || []} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="rating"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip
                      wrapperStyle={{ outline: "none", background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
                      contentStyle={{
                        backgroundColor: "#000",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.9)", fontWeight: 500 }}
                      cursor={{ fill: "transparent" }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {(metrics?.truthRatingDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </div>

        {/* System Health & Top Domains */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* System Health - Expandable Items */}
          <ChartCard title="System Health">
            <div className="space-y-3">
              {/* API Status - Expandable */}
              {(() => {
                const statuses = metrics?.systemHealthDetails.apiStatuses || []
                const hasDown = statuses.some(s => s.status === "down")
                const hasDegraded = statuses.some(s => s.status === "degraded")
                const totalCalls = statuses.reduce((sum, s) => sum + s.totalCalls, 0)

                let statusLabel = "Operational"
                let statusColor = "green"
                let statusSubtext = totalCalls > 0
                  ? `${totalCalls} API calls today`
                  : "No activity today"

                if (hasDown) {
                  statusLabel = "Issues"
                  statusColor = "red"
                  statusSubtext = "Some services experiencing issues"
                } else if (hasDegraded) {
                  statusLabel = "Degraded"
                  statusColor = "yellow"
                  statusSubtext = "Some services degraded"
                }

                return (
                  <div className="bg-white/[0.03] rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleHealthItem("apiStatus")}
                      className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          statusColor === "green" && "bg-green-500/10",
                          statusColor === "yellow" && "bg-yellow-500/10",
                          statusColor === "red" && "bg-red-500/10",
                          statusColor === "gray" && "bg-white/[0.06]"
                        )}>
                          <Zap className={cn(
                            "w-4 h-4",
                            statusColor === "green" && "text-green-400",
                            statusColor === "yellow" && "text-yellow-400",
                            statusColor === "red" && "text-red-400",
                            statusColor === "gray" && "text-white/40"
                          )} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-white">API Status</p>
                          <p className="text-xs text-white/50">{statusSubtext}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-1 text-xs font-medium rounded-full",
                          statusColor === "green" && "text-green-400 bg-green-500/10",
                          statusColor === "yellow" && "text-yellow-400 bg-yellow-500/10",
                          statusColor === "red" && "text-red-400 bg-red-500/10",
                          statusColor === "gray" && "text-white/50 bg-white/[0.06]"
                        )}>
                          {statusLabel}
                        </span>
                        {expandedHealthItems.has("apiStatus") ? (
                          <ChevronUp className="w-4 h-4 text-white/40" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-white/40" />
                        )}
                      </div>
                    </button>
                    {expandedHealthItems.has("apiStatus") && (
                      <div className="px-3 pb-3 pt-1 border-t border-white/[0.06]">
                        <div className="space-y-2 text-xs">
                          {statuses.map((service) => (
                            <div key={service.name} className="flex justify-between items-center py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                              <div className="flex items-center gap-2">
                                {/* Status dot */}
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  service.status === "operational" && "bg-green-400",
                                  service.status === "degraded" && "bg-yellow-400",
                                  service.status === "down" && "bg-red-400"
                                )} />
                                <span className="text-white/80">{service.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {service.totalCalls > 0 && (
                                  <span className="text-white/30 text-[10px]">
                                    {service.totalCalls} calls
                                  </span>
                                )}
                                {service.totalCalls === -1 && (
                                  <span className="text-white/30 text-[10px]">
                                    inferred
                                  </span>
                                )}
                                {service.totalCalls === 0 && (
                                  <span className="text-white/30 text-[10px]">
                                    no calls
                                  </span>
                                )}
                                <span className={cn(
                                  "text-[11px] font-medium",
                                  service.status === "operational" && "text-green-400",
                                  service.status === "degraded" && "text-yellow-400",
                                  service.status === "down" && "text-red-400"
                                )}>
                                  {service.status === "operational" && "Operational"}
                                  {service.status === "degraded" && `Degraded (${service.errorRate}%)`}
                                  {service.status === "down" && `Down (${service.errorRate}%)`}
                                </span>
                              </div>
                            </div>
                          ))}
                          <p className="text-white/30 text-[10px] pt-2 border-t border-white/[0.06] mt-2">
                            Status based on error rates in the last 24 hours. Services with no calls are assumed operational.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* API Costs - Expandable */}
              <div className="bg-white/[0.03] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleHealthItem("apiCosts")}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <DollarSign className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">API Costs Today</p>
                      <p className="text-xs text-white/50">Click to see breakdown</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      ${metrics?.apiCostsToday.toFixed(2) || "0.00"}
                    </span>
                    {expandedHealthItems.has("apiCosts") ? (
                      <ChevronUp className="w-4 h-4 text-white/40" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/40" />
                    )}
                  </div>
                </button>
                {expandedHealthItems.has("apiCosts") && (
                  <div className="px-3 pb-3 pt-1 border-t border-white/[0.06] space-y-4">
                    {/* Cost Trend Chart */}
                    {(metrics?.systemHealthDetails.costTrend || []).length > 1 && (
                      <div>
                        <p className="text-white/50 text-xs mb-2">7-Day Cost Trend</p>
                        <div className="h-[100px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics?.systemHealthDetails.costTrend || []}>
                              <defs>
                                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={COLORS.yellow} stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor={COLORS.yellow} stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
                              />
                              <YAxis hide />
                              <Tooltip
                                wrapperStyle={{ outline: "none", background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
                                contentStyle={{
                                  backgroundColor: "#000",
                                  border: "1px solid rgba(255,255,255,0.2)",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                }}
                                labelStyle={{ color: "rgba(255,255,255,0.9)", fontWeight: 500 }}
                                formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                              />
                              <Area
                                type="monotone"
                                dataKey="cost"
                                stroke={COLORS.yellow}
                                strokeWidth={2}
                                fill="url(#costGradient)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Today's Breakdown by Service */}
                    <div>
                      <p className="text-white/50 text-xs mb-2">Today by Service</p>
                      <div className="space-y-1 text-xs">
                        {(metrics?.systemHealthDetails.apiCostBreakdown || []).length > 0 ? (
                          metrics?.systemHealthDetails.apiCostBreakdown.map((item) => (
                            <div key={item.api} className="flex justify-between items-center py-1">
                              <span className="text-white/60 capitalize">{item.api}</span>
                              <div className="text-right">
                                <span className="text-white">${item.cost.toFixed(4)}</span>
                                <span className="text-white/40 ml-2">({item.calls} calls)</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-white/40 text-center py-2">No API calls today</p>
                        )}
                      </div>
                    </div>

                    {/* OpenRouter Model Breakdown */}
                    {(metrics?.systemHealthDetails.modelCostBreakdown || []).length > 0 && (
                      <div>
                        <p className="text-white/50 text-xs mb-2">OpenRouter by Model (7 Days)</p>
                        <div className="space-y-1 text-xs">
                          {metrics?.systemHealthDetails.modelCostBreakdown.map((item) => (
                            <div key={item.model} className="flex justify-between items-center py-1">
                              <span className="text-white/60 truncate max-w-[140px]" title={item.model}>
                                {item.model.replace("anthropic/", "").replace("openai/", "").replace("google/", "")}
                              </span>
                              <div className="text-right">
                                <span className="text-white">${item.cost.toFixed(4)}</span>
                                <span className="text-white/40 ml-2">({item.calls} calls)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error Rate - Expandable */}
              <div className="bg-white/[0.03] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleHealthItem("errorRate")}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      (metrics?.errorRate || 0) > 5 ? "bg-red-500/10" : "bg-green-500/10"
                    )}>
                      <AlertTriangle className={cn(
                        "w-4 h-4",
                        (metrics?.errorRate || 0) > 5 ? "text-red-400" : "text-green-400"
                      )} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">Error Rate</p>
                      <p className="text-xs text-white/50">Last 24 hours</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      (metrics?.errorRate || 0) > 5 ? "text-red-400" : "text-green-400"
                    )}>
                      {metrics?.errorRate || 0}%
                    </span>
                    {expandedHealthItems.has("errorRate") ? (
                      <ChevronUp className="w-4 h-4 text-white/40" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/40" />
                    )}
                  </div>
                </button>
                {expandedHealthItems.has("errorRate") && (
                  <div className="px-3 pb-3 pt-1 border-t border-white/[0.06] space-y-4">
                    {/* Error Rate Trend Chart */}
                    {(metrics?.systemHealthDetails.errorTrend || []).length > 1 && (
                      <div>
                        <p className="text-white/50 text-xs mb-2">7-Day Error Rate Trend</p>
                        <div className="h-[100px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metrics?.systemHealthDetails.errorTrend || []}>
                              <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
                              />
                              <YAxis hide domain={[0, 'auto']} />
                              <Tooltip
                                wrapperStyle={{ outline: "none", background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
                                contentStyle={{
                                  backgroundColor: "#000",
                                  border: "1px solid rgba(255,255,255,0.2)",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                }}
                                labelStyle={{ color: "rgba(255,255,255,0.9)", fontWeight: 500 }}
                                formatter={(value: number, name: string) => {
                                  if (name === "errorRate") return [`${value}%`, "Error Rate"]
                                  if (name === "errorCount") return [value, "Errors"]
                                  return [value, name]
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="errorRate"
                                stroke={COLORS.red}
                                strokeWidth={2}
                                dot={{ fill: COLORS.red, strokeWidth: 0, r: 3 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Error Types Breakdown */}
                    {(metrics?.systemHealthDetails.errorsByType || []).length > 0 && (
                      <div>
                        <p className="text-white/50 text-xs mb-2">Error Types (7 Days)</p>
                        <div className="space-y-1 text-xs">
                          {metrics?.systemHealthDetails.errorsByType.map((item) => (
                            <div key={item.type} className="flex justify-between items-center py-1">
                              <span className="text-white/60">{item.type}</span>
                              <div className="text-right">
                                <span className="text-red-400">{item.count}</span>
                                <span className="text-white/40 ml-2">({item.percentage}%)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Errors */}
                    <div>
                      <p className="text-white/50 text-xs mb-2">Recent Errors (Today)</p>
                      {(metrics?.systemHealthDetails.recentErrors || []).length > 0 ? (
                        <div className="max-h-[120px] overflow-y-auto space-y-2">
                          {metrics?.systemHealthDetails.recentErrors.map((error, i) => (
                            <div key={i} className="bg-red-500/5 rounded-lg p-2 border border-red-500/10">
                              <div className="flex justify-between items-start">
                                <span className="text-white/60 capitalize">{error.api}</span>
                                <span className="text-white/40">{error.timestamp}</span>
                              </div>
                              <p className="text-red-300/80 mt-1 truncate" title={error.message}>{error.message}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-green-400/80 text-center py-2">No errors today</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Processing Time - Expandable */}
              <div className="bg-white/[0.03] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleHealthItem("processingTime")}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Clock className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">Avg Processing Time</p>
                      <p className="text-xs text-white/50">Per analysis section</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {metrics?.avgProcessingTime || 0}ms
                    </span>
                    {expandedHealthItems.has("processingTime") ? (
                      <ChevronUp className="w-4 h-4 text-white/40" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/40" />
                    )}
                  </div>
                </button>
                {expandedHealthItems.has("processingTime") && (
                  <div className="px-3 pb-3 pt-1 border-t border-white/[0.06] space-y-4">
                    {/* Processing Time Trend Chart */}
                    {(metrics?.systemHealthDetails.processingTimeTrend || []).length > 1 && (
                      <div>
                        <p className="text-white/50 text-xs mb-2">7-Day Avg Processing Time</p>
                        <div className="h-[100px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics?.systemHealthDetails.processingTimeTrend || []}>
                              <defs>
                                <linearGradient id="processingGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
                              />
                              <YAxis hide />
                              <Tooltip
                                wrapperStyle={{ outline: "none", background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
                                contentStyle={{
                                  backgroundColor: "#000",
                                  border: "1px solid rgba(255,255,255,0.2)",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                }}
                                labelStyle={{ color: "rgba(255,255,255,0.9)", fontWeight: 500 }}
                                formatter={(value: number, name: string) => {
                                  if (name === "avgTime") return [`${value}ms`, "Avg Time"]
                                  if (name === "count") return [value, "Analyses"]
                                  return [value, name]
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="avgTime"
                                stroke={COLORS.blue}
                                strokeWidth={2}
                                fill="url(#processingGradient)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Processing Time by Section */}
                    <div>
                      <p className="text-white/50 text-xs mb-2">By Section (Selected Period)</p>
                      <div className="space-y-1 text-xs">
                        {(metrics?.systemHealthDetails.processingTimeBySection || []).length > 0 ? (
                          metrics?.systemHealthDetails.processingTimeBySection.map((item) => (
                            <div key={item.section} className="flex justify-between items-center py-1">
                              <span className="text-white/60 capitalize">{item.section.replace(/_/g, " ")}</span>
                              <div className="text-right">
                                <span className={cn(
                                  "font-medium",
                                  item.avgTime > 5000 ? "text-red-400" :
                                  item.avgTime > 2000 ? "text-yellow-400" : "text-green-400"
                                )}>
                                  {item.avgTime}ms
                                </span>
                                <span className="text-white/40 ml-2">({item.count}x)</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-white/40 text-center py-2">No processing data yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ChartCard>

          {/* Top Domains */}
          <ChartCard title="Top Analyzed Domains">
            <div className="space-y-2 max-h-[280px] overflow-y-auto subtle-scrollbar">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-white/[0.03] rounded-lg animate-pulse" />
                ))
              ) : (
                (metrics?.topDomains || []).map((domain, index) => (
                  <div
                    key={domain.domain}
                    className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-white/30 w-5">{index + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-white truncate max-w-[180px]">
                          {domain.domain}
                        </p>
                        <p className="text-xs text-white/50">{domain.count} analyses</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-medium",
                        domain.avgScore >= 7 ? "text-green-400" :
                        domain.avgScore >= 5 ? "text-yellow-400" : "text-red-400"
                      )}>
                        {domain.avgScore.toFixed(1)}/10
                      </p>
                      <p className="text-xs text-white/40">avg score</p>
                    </div>
                  </div>
                ))
              )}
              {!loading && (metrics?.topDomains || []).length === 0 && (
                <p className="text-center text-white/40 py-8 text-sm">No domain data yet</p>
              )}
            </div>
          </ChartCard>
        </div>
      </main>
    </div>
  )
}

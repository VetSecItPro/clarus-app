"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Users, FileText, TrendingUp, DollarSign,
  Activity, MessageSquare,
  AlertTriangle, CheckCircle, Clock, Zap,
  ArrowUpRight, ArrowDownRight, Loader2,
  BarChart3, RefreshCw, ChevronDown, ChevronUp,
  ArrowLeft
} from "lucide-react"
import Link from "next/link"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, BarChart, Bar, LineChart, Line
} from "recharts"
import { cn } from "@/lib/utils"
import { useAdminMetrics, useAdminMrr } from "@/hooks/use-admin-metrics"
import type { DashboardMetrics } from "@/app/api/admin/metrics/route"

const COLORS = {
  blue: "#1d9bf0",
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  purple: "#a855f7",
  cyan: "#06b6d4",
  orange: "#f97316",
}

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

// Skeleton component for loading states
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white/[0.06] rounded animate-pulse", className)} />
  )
}

// Metric Card Component with improved skeleton
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
        <div className={cn("p-2.5 rounded-xl bg-white/[0.06]", loading ? "opacity-50" : iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        {loading ? (
          <Skeleton className="h-6 w-14 rounded-full" />
        ) : change !== undefined ? (
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
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24 mb-1" />
      ) : (
        <p className="text-2xl font-semibold text-white mb-1">{value}</p>
      )}
      <p className={cn("text-sm", loading ? "text-white/30" : "text-white/50")}>{title}</p>
      {loading ? (
        <Skeleton className="h-4 w-16 mt-1" />
      ) : changeLabel ? (
        <p className="text-xs text-white/30 mt-1">{changeLabel}</p>
      ) : null}
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState(30)
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(AUTO_REFRESH_INTERVAL_MS / 1000)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const [expandedHealthItems, setExpandedHealthItems] = useState<Set<HealthItemKey>>(new Set())
  const [authChecked, setAuthChecked] = useState(false)

  // Use SWR for data fetching with caching
  const { metrics, isLoading, isRefreshing, refresh } = useAdminMetrics({
    userId,
    timeRange,
    enabled: isAdmin && !!userId,
  })

  // Fetch MRR separately (it has its own caching)
  const { mrrData } = useAdminMrr({ userId, enabled: isAdmin && !!userId })

  // Combine metrics with MRR data
  const combinedMetrics: DashboardMetrics | null = metrics
    ? {
        ...metrics,
        mrr: mrrData?.mrr ?? metrics.mrr,
        mrrGrowthPercent: mrrData?.mrrGrowthPercent ?? metrics.mrrGrowthPercent,
        activeSubscriptions: mrrData?.activeSubscriptions ?? metrics.activeSubscriptions,
        trialUsers: mrrData?.trialingSubscriptions ?? metrics.trialUsers,
      }
    : null

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

  // Check admin status on mount
  useEffect(() => {
    async function checkAdmin() {
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

        setUserId(session.user.id)
        setIsAdmin(true)
      } catch (error) {
        console.error("Admin check failed:", error)
        router.replace("/")
      } finally {
        setAuthChecked(true)
      }
    }

    checkAdmin()
  }, [router])

  // Set up countdown timer
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setNextRefreshIn(prev => {
        if (prev <= 1) return AUTO_REFRESH_INTERVAL_MS / 1000
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // Reset countdown when metrics refresh
  useEffect(() => {
    if (!isRefreshing && !isLoading) {
      setNextRefreshIn(AUTO_REFRESH_INTERVAL_MS / 1000)
    }
  }, [isRefreshing, isLoading])

  const loading = !authChecked || isLoading
  const refreshing = isRefreshing

  if (!isAdmin && !authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
      </div>
    )
  }

  if (!isAdmin && authChecked) {
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
                <span className="text-white/40">
                  {refreshing ? "Refreshing..." : `Next refresh: ${Math.floor(nextRefreshIn / 60)}:${String(nextRefreshIn % 60).padStart(2, "0")}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TimeFilter value={timeRange} onChange={setTimeRange} />
              <button
                onClick={() => refresh()}
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
            value={combinedMetrics?.totalUsers.toLocaleString() || 0}
            change={combinedMetrics?.userGrowthPercent}
            changeLabel={`${combinedMetrics?.newUsersToday || 0} today`}
            icon={Users}
            iconColor="text-[#1d9bf0]"
            loading={loading}
          />
          <MetricCard
            title="Content Analyzed"
            value={combinedMetrics?.totalContent.toLocaleString() || 0}
            change={combinedMetrics?.contentGrowthPercent}
            changeLabel={`${combinedMetrics?.contentToday || 0} today`}
            icon={FileText}
            iconColor="text-purple-400"
            loading={loading}
          />
          <MetricCard
            title="Active Subscriptions"
            value={combinedMetrics?.activeSubscriptions || 0}
            changeLabel={`${combinedMetrics?.trialUsers || 0} in trial`}
            icon={TrendingUp}
            iconColor="text-green-400"
            loading={loading}
          />
          <MetricCard
            title="MRR"
            value={`$${combinedMetrics?.mrr.toFixed(2) || "0.00"}`}
            change={combinedMetrics?.mrrGrowthPercent}
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
                  <AreaChart data={combinedMetrics?.signupTrend || []}>
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
                  <AreaChart data={combinedMetrics?.contentTrend || []}>
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
            value={combinedMetrics?.activeUsers || 0}
            changeLabel={`${timeRange} day period`}
            icon={Activity}
            iconColor="text-cyan-400"
            loading={loading}
          />
          <MetricCard
            title="Avg Content/User"
            value={combinedMetrics?.avgContentPerUser || 0}
            icon={BarChart3}
            iconColor="text-orange-400"
            loading={loading}
          />
          <MetricCard
            title="Chat Threads"
            value={combinedMetrics?.chatThreads.toLocaleString() || 0}
            changeLabel={`${combinedMetrics?.chatMessages.toLocaleString() || 0} messages`}
            icon={MessageSquare}
            iconColor="text-pink-400"
            loading={loading}
          />
          <MetricCard
            title="Processing Success"
            value={`${combinedMetrics?.processingSuccessRate || 100}%`}
            changeLabel={`${combinedMetrics?.avgProcessingTime || 0}ms avg`}
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
                const monthlyData = combinedMetrics?.contentByTypeMonthly || []
                const hasData = monthlyData.some(m => m.youtube > 0 || m.article > 0 || m.x_post > 0 || m.pdf > 0)

                if (!hasData) {
                  // Fallback to current totals pie chart when no monthly data
                  return (
                    <div className="flex items-center w-full h-full gap-6">
                      <ResponsiveContainer width="50%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={combinedMetrics?.contentByType || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {(combinedMetrics?.contentByType || []).map((entry, index) => (
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
                        {(combinedMetrics?.contentByType || []).map((item) => (
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
            {combinedMetrics?.contentByTypeMonthly?.some(m => m.youtube > 0 || m.article > 0 || m.x_post > 0 || m.pdf > 0) && (
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
                  <BarChart data={combinedMetrics?.truthRatingDistribution || []} layout="vertical">
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
                      {(combinedMetrics?.truthRatingDistribution || []).map((entry, index) => (
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
                const statuses = combinedMetrics?.systemHealthDetails.apiStatuses || []
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
                      ${combinedMetrics?.apiCostsToday.toFixed(2) || "0.00"}
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
                    {(combinedMetrics?.systemHealthDetails.costTrend || []).length > 1 && (
                      <div>
                        <p className="text-white/50 text-xs mb-2">7-Day Cost Trend</p>
                        <div className="h-[100px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={combinedMetrics?.systemHealthDetails.costTrend || []}>
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
                        {(combinedMetrics?.systemHealthDetails.apiCostBreakdown || []).length > 0 ? (
                          combinedMetrics?.systemHealthDetails.apiCostBreakdown.map((item) => (
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
                    {(combinedMetrics?.systemHealthDetails.modelCostBreakdown || []).length > 0 && (
                      <div>
                        <p className="text-white/50 text-xs mb-2">OpenRouter by Model (7 Days)</p>
                        <div className="space-y-1 text-xs">
                          {combinedMetrics?.systemHealthDetails.modelCostBreakdown.map((item) => (
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
                      (combinedMetrics?.errorRate || 0) > 5 ? "bg-red-500/10" : "bg-green-500/10"
                    )}>
                      <AlertTriangle className={cn(
                        "w-4 h-4",
                        (combinedMetrics?.errorRate || 0) > 5 ? "text-red-400" : "text-green-400"
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
                      (combinedMetrics?.errorRate || 0) > 5 ? "text-red-400" : "text-green-400"
                    )}>
                      {combinedMetrics?.errorRate || 0}%
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
                    {(combinedMetrics?.systemHealthDetails.errorTrend || []).length > 1 && (
                      <div>
                        <p className="text-white/50 text-xs mb-2">7-Day Error Rate Trend</p>
                        <div className="h-[100px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={combinedMetrics?.systemHealthDetails.errorTrend || []}>
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
                    {(combinedMetrics?.systemHealthDetails.errorsByType || []).length > 0 && (
                      <div>
                        <p className="text-white/50 text-xs mb-2">Error Types (7 Days)</p>
                        <div className="space-y-1 text-xs">
                          {combinedMetrics?.systemHealthDetails.errorsByType.map((item) => (
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
                      {(combinedMetrics?.systemHealthDetails.recentErrors || []).length > 0 ? (
                        <div className="max-h-[120px] overflow-y-auto space-y-2">
                          {combinedMetrics?.systemHealthDetails.recentErrors.map((error, i) => (
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
                      {combinedMetrics?.avgProcessingTime || 0}ms
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
                    {(combinedMetrics?.systemHealthDetails.processingTimeTrend || []).length > 1 && (
                      <div>
                        <p className="text-white/50 text-xs mb-2">7-Day Avg Processing Time</p>
                        <div className="h-[100px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={combinedMetrics?.systemHealthDetails.processingTimeTrend || []}>
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
                        {(combinedMetrics?.systemHealthDetails.processingTimeBySection || []).length > 0 ? (
                          combinedMetrics?.systemHealthDetails.processingTimeBySection.map((item) => (
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
                (combinedMetrics?.topDomains || []).map((domain, index) => (
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
              {!loading && (combinedMetrics?.topDomains || []).length === 0 && (
                <p className="text-center text-white/40 py-8 text-sm">No domain data yet</p>
              )}
            </div>
          </ChartCard>
        </div>
      </main>
    </div>
  )
}

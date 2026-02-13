"use client"

import { useState, useEffect, useRef } from "react"
import {
  Users, FileText, TrendingUp, DollarSign,
  Activity, MessageSquare,
  CheckCircle,
  RefreshCw, ChevronDown, ChevronUp,
  Shield, Eye, XCircle, Flag, Loader2
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, BarChart, Bar
} from "recharts"
import { cn } from "@/lib/utils"
import { useAdminMetrics, useAdminMrr, useFlaggedContent } from "@/hooks/use-admin-metrics"
import type { DashboardMetrics } from "@/app/api/admin/metrics/route"
import { useAdmin } from "./admin-context"
import {
  MetricCard, ChartCard, TimeFilter,
  ADMIN_COLORS, CHART_TOOLTIP_STYLE, AXIS_TICK
} from "./components"
import { ExportButton } from "@/components/manage/export-button"

const COLORS = ADMIN_COLORS
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000

export default function AdminOverview() {
  const { userId } = useAdmin()
  const [timeRange, setTimeRange] = useState(30)
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(AUTO_REFRESH_INTERVAL_MS / 1000)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const { metrics, isLoading, isRefreshing, refresh } = useAdminMetrics({
    userId,
    timeRange,
    enabled: true,
  })

  const { mrrData } = useAdminMrr({ userId, enabled: true })
  const { flaggedContent, refresh: refreshFlags } = useFlaggedContent({ userId, enabled: true })
  const [updatingFlagId, setUpdatingFlagId] = useState<string | null>(null)
  const [expandedFlagId, setExpandedFlagId] = useState<string | null>(null)

  const combinedMetrics: DashboardMetrics | null = metrics
    ? {
        ...metrics,
        mrr: mrrData?.mrr ?? metrics.mrr,
        mrrGrowthPercent: mrrData?.mrrGrowthPercent ?? metrics.mrrGrowthPercent,
        activeSubscriptions: mrrData?.activeSubscriptions ?? metrics.activeSubscriptions,
        trialUsers: mrrData?.trialingSubscriptions ?? metrics.trialUsers,
      }
    : null

  const updateFlagStatus = async (id: string, status: "reviewed" | "reported" | "dismissed", extra?: { review_notes?: string; reported_to?: string; report_reference?: string }) => {
    setUpdatingFlagId(id)
    try {
      const res = await fetch("/api/admin/flagged-content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, ...extra }),
      })
      if (res.ok) {
        refreshFlags()
        setExpandedFlagId(null)
      }
    } catch (error) {
      console.error("Failed to update flag:", error)
    } finally {
      setUpdatingFlagId(null)
    }
  }

  // Countdown timer
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setNextRefreshIn((prev) => {
        if (prev <= 1) return AUTO_REFRESH_INTERVAL_MS / 1000
        return prev - 1
      })
    }, 1000)
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isRefreshing && !isLoading) {
      setNextRefreshIn(AUTO_REFRESH_INTERVAL_MS / 1000)
    }
  }, [isRefreshing, isLoading])

  const loading = isLoading

  return (
    <div className="space-y-6">
      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-white/50">
          <span>
            {isRefreshing
              ? "Refreshing..."
              : `Next refresh: ${Math.floor(nextRefreshIn / 60)}:${String(nextRefreshIn % 60).padStart(2, "0")}`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <TimeFilter value={timeRange} onChange={setTimeRange} />
          <ExportButton
            disabled={loading}
            filename="clarus-overview"
            data={combinedMetrics ? [{
              date: new Date().toISOString().slice(0, 10),
              time_range_days: timeRange,
              total_users: combinedMetrics.totalUsers,
              new_users_today: combinedMetrics.newUsersToday,
              user_growth_pct: combinedMetrics.userGrowthPercent,
              total_content: combinedMetrics.totalContent,
              active_subscriptions: combinedMetrics.activeSubscriptions,
              mrr: combinedMetrics.mrr,
              mrr_growth_pct: combinedMetrics.mrrGrowthPercent,
              active_users: combinedMetrics.activeUsers,
              avg_content_per_user: combinedMetrics.avgContentPerUser,
              chat_threads: combinedMetrics.chatThreads,
              processing_success_rate: combinedMetrics.processingSuccessRate,
              api_costs_today: combinedMetrics.apiCostsToday,
              error_rate: combinedMetrics.errorRate,
            }] : []}
          />
          <button
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] transition-colors disabled:opacity-50"
            aria-label="Refresh now"
          >
            <RefreshCw className={cn("w-4 h-4 text-white/70", isRefreshing && "animate-spin")} />
            <span className="text-sm text-white/70 hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Key Metrics — clickable cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Users"
          value={combinedMetrics?.totalUsers.toLocaleString() || 0}
          change={combinedMetrics?.userGrowthPercent}
          changeLabel={`${combinedMetrics?.newUsersToday || 0} today`}
          icon={Users}
          iconColor="text-brand"
          loading={loading}
          href="/manage/users"
        />
        <MetricCard
          title="Content Analyzed"
          value={combinedMetrics?.totalContent.toLocaleString() || 0}
          change={combinedMetrics?.contentGrowthPercent}
          changeLabel={`${combinedMetrics?.contentToday || 0} today`}
          icon={FileText}
          iconColor="text-purple-400"
          loading={loading}
          href="/manage/content"
        />
        <MetricCard
          title="Active Subscriptions"
          value={combinedMetrics?.activeSubscriptions || 0}
          changeLabel={`${combinedMetrics?.trialUsers || 0} in trial`}
          icon={TrendingUp}
          iconColor="text-green-400"
          loading={loading}
          href="/manage/users"
        />
        <MetricCard
          title="MRR"
          value={`$${combinedMetrics?.mrr.toFixed(2) || "0.00"}`}
          change={combinedMetrics?.mrrGrowthPercent}
          icon={DollarSign}
          iconColor="text-yellow-400"
          loading={loading}
          href="/manage/costs"
        />
      </div>

      {/* Content Moderation Queue */}
      {flaggedContent && flaggedContent.counts.pending > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10">
                <Shield className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">Content Moderation Queue</h3>
                <p className="text-xs text-white/50">
                  {flaggedContent.counts.pending} pending
                  {flaggedContent.counts.critical > 0 && (
                    <span className="text-red-400 font-medium ml-1">
                      ({flaggedContent.counts.critical} critical)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => refreshFlags()}
              className="text-xs text-white/50 hover:text-white/70 transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto subtle-scrollbar">
            {flaggedContent.items
              .filter((item) => item.status === "pending")
              .map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "bg-black/30 rounded-xl border transition-colors",
                    item.severity === "critical" ? "border-red-500/30" : "border-white/[0.06]"
                  )}
                >
                  <button
                    onClick={() => setExpandedFlagId(expandedFlagId === item.id ? null : item.id)}
                    aria-expanded={expandedFlagId === item.id}
                    className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors rounded-xl"
                  >
                    <div className="flex items-center gap-3 text-left min-w-0">
                      <div
                        className={cn(
                          "px-2 py-0.5 rounded text-[0.625rem] font-medium uppercase shrink-0",
                          item.severity === "critical" && "bg-red-500/20 text-red-400",
                          item.severity === "high" && "bg-orange-500/20 text-orange-400",
                          item.severity === "medium" && "bg-yellow-500/20 text-yellow-400"
                        )}
                      >
                        {item.severity}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{item.url}</p>
                        <p className="text-xs text-white/50 truncate">{item.flag_reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-[0.625rem] text-white/50">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      {expandedFlagId === item.id ? (
                        <ChevronUp className="w-4 h-4 text-white/50" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/50" />
                      )}
                    </div>
                  </button>
                  {expandedFlagId === item.id && (
                    <div className="px-3 pb-3 border-t border-white/[0.06] space-y-3">
                      <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                        <div>
                          <span className="text-white/50">Source</span>
                          <p className="text-white/80">{item.flag_source.replace(/_/g, " ")}</p>
                        </div>
                        <div>
                          <span className="text-white/50">Categories</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {item.flag_categories.map((cat) => (
                              <span
                                key={cat}
                                className="px-1.5 py-0.5 bg-white/[0.06] rounded text-white/60 text-[0.625rem]"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                        {item.content_type && (
                          <div>
                            <span className="text-white/50">Content Type</span>
                            <p className="text-white/80">{item.content_type}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-white/50">Flagged</span>
                          <p className="text-white/80">{new Date(item.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                        <button
                          onClick={() =>
                            updateFlagStatus(item.id, "reviewed", { review_notes: "Reviewed by admin" })
                          }
                          disabled={updatingFlagId === item.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                        >
                          <Eye className="w-3 h-3" />
                          Mark Reviewed
                        </button>
                        <button
                          onClick={() =>
                            updateFlagStatus(item.id, "dismissed", {
                              review_notes: "Dismissed by admin — false positive",
                            })
                          }
                          disabled={updatingFlagId === item.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.06] text-white/60 hover:bg-white/[0.1] transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3 h-3" />
                          Dismiss
                        </button>
                        {item.flag_categories.includes("csam") && (
                          <button
                            onClick={() =>
                              updateFlagStatus(item.id, "reported", {
                                review_notes: "Reported to NCMEC CyberTipline",
                                reported_to: "ncmec",
                              })
                            }
                            disabled={updatingFlagId === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            <Flag className="w-3 h-3" />
                            Report to NCMEC
                          </button>
                        )}
                        {updatingFlagId === item.id && (
                          <Loader2 className="w-3 h-3 text-white/50 animate-spin" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Users by Tier */}
      <ChartCard title="Users by Tier" href="/manage/users">
        <div className="flex items-center gap-6">
          {loading ? (
            <div className="h-[80px] w-full bg-white/[0.03] rounded animate-pulse" />
          ) : (
            (() => {
              const tiers = combinedMetrics?.usersByTier || { free: 0, starter: 0, pro: 0, day_pass: 0 }
              const total = tiers.free + tiers.starter + tiers.pro + tiers.day_pass
              const tierItems = [
                { label: "Free", count: tiers.free, color: "bg-white/40", pct: total > 0 ? ((tiers.free / total) * 100).toFixed(1) : "0" },
                { label: "Starter", count: tiers.starter, color: "bg-brand", pct: total > 0 ? ((tiers.starter / total) * 100).toFixed(1) : "0" },
                { label: "Pro", count: tiers.pro, color: "bg-purple-500", pct: total > 0 ? ((tiers.pro / total) * 100).toFixed(1) : "0" },
                { label: "Day Pass", count: tiers.day_pass, color: "bg-amber-500", pct: total > 0 ? ((tiers.day_pass / total) * 100).toFixed(1) : "0" },
              ]
              return (
                <div className="flex-1">
                  <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.06]">
                    {tierItems.map((t) =>
                      t.count > 0 ? (
                        <div key={t.label} className={cn(t.color, "transition-all")} style={{ width: `${t.pct}%` }} />
                      ) : null
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap mt-3">
                    {tierItems.map((t) => (
                      <div key={t.label} className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", t.color)} />
                        <div>
                          <span className="text-sm font-medium text-white">{t.count.toLocaleString()}</span>
                          <span className="text-xs text-white/50 ml-1">{t.label}</span>
                          <span className="text-xs text-white/50 ml-1">({t.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()
          )}
        </div>
      </ChartCard>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="User Signups" href="/manage/users">
          <div className="h-[200px]">
            {loading ? (
              <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combinedMetrics?.signupTrend || []}>
                  <defs>
                    <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                  <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="count" stroke={COLORS.blue} strokeWidth={2} fill="url(#signupGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Content Analyzed" href="/manage/content">
          <div className="h-[200px]">
            {loading ? (
              <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combinedMetrics?.contentTrend || []}>
                  <defs>
                    <linearGradient id="contentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                  <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="count" stroke={COLORS.purple} strokeWidth={2} fill="url(#contentGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Second Stats Row — clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Active Users"
          value={combinedMetrics?.activeUsers || 0}
          changeLabel={`${timeRange} day period`}
          icon={Activity}
          iconColor="text-cyan-400"
          loading={loading}
          href="/manage/users"
        />
        <MetricCard
          title="Avg Content/User"
          value={combinedMetrics?.avgContentPerUser || 0}
          icon={FileText}
          iconColor="text-orange-400"
          loading={loading}
          href="/manage/content"
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
          href="/manage/health"
        />
      </div>

      {/* Content Breakdown & Truth Ratings — clickable */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Content by Type (Last 3 Months)" href="/manage/content">
          <div className="h-[200px]">
            {loading ? (
              <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
            ) : (() => {
              const monthlyData = combinedMetrics?.contentByTypeMonthly || []
              const hasData = monthlyData.some((m) => m.youtube > 0 || m.article > 0 || m.x_post > 0 || m.pdf > 0)

              if (!hasData) {
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
                        <Tooltip {...CHART_TOOLTIP_STYLE} />
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
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} />
                    <Tooltip {...CHART_TOOLTIP_STYLE} cursor={{ fill: "transparent" }} />
                    <Bar dataKey="youtube" name="YouTube" fill={COLORS.red} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="article" name="Articles" fill={COLORS.blue} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="x_post" name="X Posts" fill={COLORS.cyan} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="pdf" name="PDFs" fill={COLORS.purple} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            })()}
          </div>
        </ChartCard>

        <ChartCard title="Truth Rating Distribution" href="/manage/content">
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
                  <Tooltip {...CHART_TOOLTIP_STYLE} cursor={{ fill: "transparent" }} />
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

      {/* Quick access cards to subpages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="API Costs Today" href="/manage/costs">
          <div className="text-3xl font-semibold text-white mb-2">
            ${combinedMetrics?.apiCostsToday.toFixed(2) || "0.00"}
          </div>
          <div className="space-y-1.5">
            {(combinedMetrics?.systemHealthDetails.apiCostBreakdown || []).slice(0, 4).map((item) => (
              <div key={item.api} className="flex justify-between items-center text-xs">
                <span className="text-white/60 capitalize">{item.api}</span>
                <span className="text-white">${item.cost.toFixed(4)} <span className="text-white/50">({item.calls} calls)</span></span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="System Health" href="/manage/health">
          <div className="space-y-2">
            {(combinedMetrics?.systemHealthDetails.apiStatuses || []).map((service) => (
              <div key={service.name} className="flex justify-between items-center py-1">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      service.status === "operational" && "bg-green-400",
                      service.status === "degraded" && "bg-yellow-400",
                      service.status === "down" && "bg-red-400"
                    )}
                  />
                  <span className="text-sm text-white/80">{service.label}</span>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    service.status === "operational" && "text-green-400",
                    service.status === "degraded" && "text-yellow-400",
                    service.status === "down" && "text-red-400"
                  )}
                >
                  {service.status === "operational" && "OK"}
                  {service.status === "degraded" && `Degraded (${service.errorRate}%)`}
                  {service.status === "down" && `Down (${service.errorRate}%)`}
                </span>
              </div>
            ))}
            {!loading && (combinedMetrics?.systemHealthDetails.apiStatuses || []).length === 0 && (
              <p className="text-sm text-white/50 text-center py-4">No data yet</p>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Top Domains */}
      <ChartCard title="Top Analyzed Domains" href="/manage/content">
        <div className="space-y-2 max-h-[280px] overflow-y-auto subtle-scrollbar">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-white/[0.03] rounded-lg animate-pulse" />
              ))
            : (combinedMetrics?.topDomains || []).map((domain, index) => (
                <div
                  key={domain.domain}
                  className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-white/50 w-5">{index + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-white truncate max-w-[180px]">{domain.domain}</p>
                      <p className="text-xs text-white/50">{domain.count} analyses</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        domain.avgScore >= 7 ? "text-green-400" : domain.avgScore >= 5 ? "text-yellow-400" : "text-red-400"
                      )}
                    >
                      {domain.avgScore.toFixed(1)}/10
                    </p>
                    <p className="text-xs text-white/50">avg score</p>
                  </div>
                </div>
              ))}
          {!loading && (combinedMetrics?.topDomains || []).length === 0 && (
            <p className="text-center text-white/50 py-8 text-sm">No domain data yet</p>
          )}
        </div>
      </ChartCard>
    </div>
  )
}

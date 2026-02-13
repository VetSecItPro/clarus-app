"use client"

import { useState } from "react"
import { FileText, TrendingUp, CheckCircle, Clock } from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts"
import { cn } from "@/lib/utils"
import { useAdminMetrics } from "@/hooks/use-admin-metrics"
import { useAdmin } from "../admin-context"
import {
  MetricCard, ChartCard, TimeFilter, SubpageHeader,
  ADMIN_COLORS, CHART_TOOLTIP_STYLE, AXIS_TICK
} from "../components"
import { ExportButton } from "@/components/manage/export-button"

const COLORS = ADMIN_COLORS

export default function ContentPage() {
  const { userId } = useAdmin()
  const [timeRange, setTimeRange] = useState(30)

  const { metrics, isLoading } = useAdminMetrics({ userId, timeRange, enabled: true })
  const loading = isLoading

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SubpageHeader title="Content" description="Analysis volume, types, quality scores, and domains" />
        <div className="flex items-center gap-3">
          <ExportButton
            disabled={loading}
            filename="clarus-content"
            data={metrics ? [{
              date: new Date().toISOString().slice(0, 10),
              total_analyzed: metrics.totalContent,
              content_today: metrics.contentToday,
              content_growth_pct: metrics.contentGrowthPercent,
              avg_content_per_user: metrics.avgContentPerUser,
              processing_success_rate: metrics.processingSuccessRate,
              avg_processing_time_s: metrics.avgProcessingTime,
            }] : []}
          />
          <TimeFilter value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Analyzed"
          value={metrics?.totalContent.toLocaleString() || 0}
          change={metrics?.contentGrowthPercent}
          changeLabel={`${metrics?.contentToday || 0} today`}
          icon={FileText}
          iconColor="text-purple-400"
          loading={loading}
        />
        <MetricCard
          title="Avg Content/User"
          value={metrics?.avgContentPerUser || 0}
          icon={TrendingUp}
          iconColor="text-orange-400"
          loading={loading}
        />
        <MetricCard
          title="Processing Success"
          value={`${metrics?.processingSuccessRate || 100}%`}
          icon={CheckCircle}
          iconColor="text-green-400"
          loading={loading}
        />
        <MetricCard
          title="Avg Processing Time"
          value={`${metrics?.avgProcessingTime || 0}ms`}
          icon={Clock}
          iconColor="text-blue-400"
          loading={loading}
        />
      </div>

      {/* Content trend — full width */}
      <ChartCard title="Content Analyzed Over Time">
        <div className="h-[280px]">
          {loading ? (
            <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.contentTrend || []}>
                <defs>
                  <linearGradient id="contentGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="count" stroke={COLORS.purple} strokeWidth={2} fill="url(#contentGrad2)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* Content by type + truth ratings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Content by Type (Last 3 Months)">
          <div className="h-[240px]">
            {loading ? (
              <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
            ) : (() => {
              const monthlyData = metrics?.contentByTypeMonthly || []
              const hasData = monthlyData.some((m) => m.youtube > 0 || m.article > 0 || m.x_post > 0 || m.pdf > 0)

              if (!hasData) {
                return (
                  <div className="h-full flex items-center justify-center">
                    <div className="space-y-3">
                      {(metrics?.contentByType || []).map((item) => (
                        <div key={item.name} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-white/70 w-20">{item.name}</span>
                          <div className="w-32 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                backgroundColor: item.color,
                                width: `${Math.min(100, (item.value / Math.max(...(metrics?.contentByType || []).map((c) => c.value), 1)) * 100)}%`,
                              }}
                            />
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
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={AXIS_TICK} />
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
        </ChartCard>

        <ChartCard title="Truth Rating Distribution">
          <div className="h-[240px]">
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
                    width={110}
                  />
                  <Tooltip {...CHART_TOOLTIP_STYLE} cursor={{ fill: "transparent" }} />
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

      {/* Processing by section */}
      <ChartCard title="Average Processing Time by Section">
        <div className="h-[220px]">
          {loading ? (
            <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
          ) : (() => {
            const sectionData = (metrics?.systemHealthDetails.processingTimeBySection || []).map((s) => ({
              section: s.section.replace(/_/g, " "),
              avgTime: s.avgTime,
              count: s.count,
            }))

            if (sectionData.length === 0) {
              return <div className="h-full flex items-center justify-center text-sm text-white/50">No processing data yet</div>
            }

            return (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectionData}>
                  <XAxis dataKey="section" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} />
                  <Tooltip
                    {...CHART_TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => {
                      if (name === "avgTime") return [`${value}ms`, "Avg Time"]
                      return [value, name]
                    }}
                    cursor={{ fill: "transparent" }}
                  />
                  <Bar dataKey="avgTime" name="avgTime" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          })()}
        </div>
      </ChartCard>

      {/* Top Domains */}
      <ChartCard title="Top Analyzed Domains">
        <div className="space-y-2 max-h-[400px] overflow-y-auto subtle-scrollbar">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 bg-white/[0.03] rounded-lg animate-pulse" />
              ))
            : (metrics?.topDomains || []).map((domain, index) => (
                <div
                  key={domain.domain}
                  className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-white/50 w-5">{index + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-white truncate max-w-[240px]">{domain.domain}</p>
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
          {!loading && (metrics?.topDomains || []).length === 0 && (
            <p className="text-center text-white/50 py-8 text-sm">No domain data yet</p>
          )}
        </div>
      </ChartCard>
    </div>
  )
}

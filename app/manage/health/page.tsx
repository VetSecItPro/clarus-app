"use client"

import { useState } from "react"
import { Activity, AlertTriangle, Clock, Zap } from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar
} from "recharts"
import { cn } from "@/lib/utils"
import { useAdminMetrics } from "@/hooks/use-admin-metrics"
import { useAdmin } from "../admin-context"
import {
  MetricCard, ChartCard, TimeFilter, SubpageHeader,
  ADMIN_COLORS, CHART_TOOLTIP_STYLE, AXIS_TICK_SMALL
} from "../components"

const COLORS = ADMIN_COLORS

export default function HealthPage() {
  const { userId } = useAdmin()
  const [timeRange, setTimeRange] = useState(30)

  const { metrics, isLoading } = useAdminMetrics({ userId, timeRange, enabled: true })
  const loading = isLoading

  const details = metrics?.systemHealthDetails
  const statuses = details?.apiStatuses || []
  const errorTrend = details?.errorTrend || []
  const errorsByType = details?.errorsByType || []
  const processingTrend = details?.processingTimeTrend || []
  const processingBySection = details?.processingTimeBySection || []
  const recentErrors = details?.recentErrors || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SubpageHeader title="System Health" description="Service status, errors, and processing performance" />
        <TimeFilter value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Error Rate"
          value={`${metrics?.errorRate || 0}%`}
          icon={AlertTriangle}
          iconColor={(metrics?.errorRate || 0) > 5 ? "text-red-400" : "text-green-400"}
          loading={loading}
        />
        <MetricCard
          title="Avg Processing Time"
          value={`${metrics?.avgProcessingTime || 0}ms`}
          icon={Clock}
          iconColor="text-blue-400"
          loading={loading}
        />
        <MetricCard
          title="Processing Success"
          value={`${metrics?.processingSuccessRate || 100}%`}
          icon={Activity}
          iconColor="text-green-400"
          loading={loading}
        />
        <MetricCard
          title="Services Up"
          value={`${statuses.filter((s) => s.status === "operational").length}/${statuses.length}`}
          icon={Zap}
          iconColor="text-cyan-400"
          loading={loading}
        />
      </div>

      {/* Service Status Grid — always visible */}
      <ChartCard title="Service Status">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
              ))
            : statuses.map((service) => (
                <div
                  key={service.name}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-colors",
                    service.status === "operational" && "bg-green-500/5 border-green-500/10",
                    service.status === "degraded" && "bg-yellow-500/5 border-yellow-500/10",
                    service.status === "down" && "bg-red-500/5 border-red-500/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full",
                        service.status === "operational" && "bg-green-400",
                        service.status === "degraded" && "bg-yellow-400",
                        service.status === "down" && "bg-red-400"
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{service.label}</p>
                      <p className="text-xs text-white/40">
                        {service.totalCalls > 0 && `${service.totalCalls} calls`}
                        {service.totalCalls === 0 && "no calls"}
                        {service.totalCalls === -1 && "inferred"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-1 rounded-full",
                        service.status === "operational" && "text-green-400 bg-green-500/10",
                        service.status === "degraded" && "text-yellow-400 bg-yellow-500/10",
                        service.status === "down" && "text-red-400 bg-red-500/10"
                      )}
                    >
                      {service.status === "operational" && "Operational"}
                      {service.status === "degraded" && `Degraded (${service.errorRate}%)`}
                      {service.status === "down" && `Down (${service.errorRate}%)`}
                    </span>
                  </div>
                </div>
              ))}
        </div>
        <p className="text-white/30 text-[0.625rem] mt-3">
          Status based on error rates in the last 24 hours. Services with no calls are assumed operational.
        </p>
      </ChartCard>

      {/* Error trend + Processing trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Error Rate Trend (7 Days)">
          <div className="h-[220px]">
            {loading ? (
              <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
            ) : errorTrend.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={errorTrend}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={AXIS_TICK_SMALL} />
                  <YAxis hide domain={[0, "auto"]} />
                  <Tooltip
                    {...CHART_TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => {
                      if (name === "errorRate") return [`${value}%`, "Error Rate"]
                      if (name === "errorCount") return [value, "Errors"]
                      return [value, name]
                    }}
                  />
                  <Line type="monotone" dataKey="errorRate" stroke={COLORS.red} strokeWidth={2} dot={{ fill: COLORS.red, strokeWidth: 0, r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-white/40">Not enough data</div>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Avg Processing Time (7 Days)">
          <div className="h-[220px]">
            {loading ? (
              <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
            ) : processingTrend.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={processingTrend}>
                  <defs>
                    <linearGradient id="procGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={AXIS_TICK_SMALL} />
                  <YAxis hide />
                  <Tooltip
                    {...CHART_TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => {
                      if (name === "avgTime") return [`${value}ms`, "Avg Time"]
                      if (name === "count") return [value, "Analyses"]
                      return [value, name]
                    }}
                  />
                  <Area type="monotone" dataKey="avgTime" stroke={COLORS.blue} strokeWidth={2} fill="url(#procGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-white/40">Not enough data</div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Error breakdown + Processing by section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Errors by Type (7 Days)">
          {loading ? (
            <div className="h-[200px] bg-white/[0.03] rounded animate-pulse" />
          ) : errorsByType.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={errorsByType} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="type"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                    width={90}
                  />
                  <Tooltip
                    {...CHART_TOOLTIP_STYLE}
                    cursor={{ fill: "transparent" }}
                    formatter={(value: number, name: string) => {
                      if (name === "count") return [value, "Errors"]
                      return [value, name]
                    }}
                  />
                  <Bar dataKey="count" name="count" fill={COLORS.red} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-green-400">No errors in the last 7 days</div>
          )}
        </ChartCard>

        <ChartCard title="Processing Time by Section">
          {loading ? (
            <div className="h-[200px] bg-white/[0.03] rounded animate-pulse" />
          ) : processingBySection.length > 0 ? (
            <div className="space-y-2">
              {processingBySection.map((item) => (
                <div key={item.section} className="flex items-center gap-3">
                  <span className="text-xs text-white/60 w-28 truncate capitalize" title={item.section}>
                    {item.section.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        item.avgTime > 5000 ? "bg-red-400" : item.avgTime > 2000 ? "bg-yellow-400" : "bg-green-400"
                      )}
                      style={{
                        width: `${Math.min(100, (item.avgTime / Math.max(...processingBySection.map((s) => s.avgTime), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="text-right w-24 shrink-0">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        item.avgTime > 5000 ? "text-red-400" : item.avgTime > 2000 ? "text-yellow-400" : "text-green-400"
                      )}
                    >
                      {item.avgTime}ms
                    </span>
                    <span className="text-xs text-white/30 ml-1">({item.count}x)</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-white/40">No processing data yet</div>
          )}
        </ChartCard>
      </div>

      {/* Recent Errors */}
      <ChartCard title="Recent Errors (Today)">
        {loading ? (
          <div className="h-[120px] bg-white/[0.03] rounded animate-pulse" />
        ) : recentErrors.length > 0 ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto subtle-scrollbar">
            {recentErrors.map((error, i) => (
              <div key={i} className="bg-red-500/5 rounded-xl p-3 border border-red-500/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs text-white/60 capitalize font-medium">{error.api}</span>
                  <span className="text-xs text-white/40">{error.timestamp}</span>
                </div>
                <p className="text-sm text-red-300/80 truncate" title={error.message}>
                  {error.message}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-green-400">No errors today</div>
        )}
      </ChartCard>
    </div>
  )
}

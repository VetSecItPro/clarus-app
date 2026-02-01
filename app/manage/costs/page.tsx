"use client"

import { useState } from "react"
import { DollarSign, Zap, TrendingUp, Database } from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts"
import { cn } from "@/lib/utils"
import { useAdminMetrics, useAdminMrr } from "@/hooks/use-admin-metrics"
import { useAdmin } from "../admin-context"
import {
  MetricCard, ChartCard, TimeFilter, SubpageHeader,
  ADMIN_COLORS, CHART_TOOLTIP_STYLE, AXIS_TICK, AXIS_TICK_SMALL
} from "../components"

const COLORS = ADMIN_COLORS

const SERVICE_COLORS: Record<string, string> = {
  openrouter: COLORS.blue,
  supadata: COLORS.cyan,
  firecrawl: COLORS.orange,
  tavily: COLORS.green,
  assemblyai: COLORS.purple,
  polar: COLORS.yellow,
  supabase: COLORS.red,
  vercel: COLORS.blue,
}

export default function CostsPage() {
  const { userId } = useAdmin()
  const [timeRange, setTimeRange] = useState(30)

  const { metrics, isLoading } = useAdminMetrics({ userId, timeRange, enabled: true })
  const { mrrData } = useAdminMrr({ userId, enabled: true })
  const loading = isLoading

  const details = metrics?.systemHealthDetails
  const costBreakdown = details?.apiCostBreakdown || []
  const modelBreakdown = details?.modelCostBreakdown || []
  const costTrend = details?.costTrend || []

  const totalCostToday = metrics?.apiCostsToday ?? 0
  const totalCalls = costBreakdown.reduce((sum, c) => sum + c.calls, 0)
  const mrr = mrrData?.mrr ?? metrics?.mrr ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SubpageHeader title="Costs" description="API spending, cost per service, model usage, and revenue" />
        <TimeFilter value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="API Cost Today"
          value={`$${totalCostToday.toFixed(2)}`}
          icon={DollarSign}
          iconColor="text-yellow-400"
          loading={loading}
        />
        <MetricCard
          title="API Calls Today"
          value={totalCalls.toLocaleString()}
          icon={Zap}
          iconColor="text-blue-400"
          loading={loading}
        />
        <MetricCard
          title="MRR"
          value={`$${mrr.toFixed(2)}`}
          change={mrrData?.mrrGrowthPercent ?? metrics?.mrrGrowthPercent}
          icon={TrendingUp}
          iconColor="text-green-400"
          loading={loading}
        />
        <MetricCard
          title="Cost/Analysis"
          value={
            metrics?.totalContent && metrics.totalContent > 0
              ? `$${(totalCostToday / Math.max(metrics.contentToday, 1)).toFixed(3)}`
              : "$0.00"
          }
          changeLabel="estimated avg"
          icon={Database}
          iconColor="text-purple-400"
          loading={loading}
        />
      </div>

      {/* Cost trend — full width */}
      <ChartCard title="7-Day Cost Trend">
        <div className="h-[280px]">
          {loading ? (
            <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
          ) : costTrend.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costTrend}>
                <defs>
                  <linearGradient id="costGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.yellow} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.yellow} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} />
                <Tooltip
                  {...CHART_TOOLTIP_STYLE}
                  formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                />
                <Area type="monotone" dataKey="cost" stroke={COLORS.yellow} strokeWidth={2} fill="url(#costGrad2)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-white/40">Not enough data for trend</div>
          )}
        </div>
      </ChartCard>

      {/* Cost by service (bar chart) + Cost by model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Cost by Service (Today)">
          <div className="h-[260px]">
            {loading ? (
              <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
            ) : costBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costBreakdown} layout="vertical">
                  <XAxis type="number" axisLine={false} tickLine={false} tick={AXIS_TICK_SMALL} tickFormatter={(v: number) => `$${v.toFixed(3)}`} />
                  <YAxis
                    type="category"
                    dataKey="api"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                    width={90}
                  />
                  <Tooltip
                    {...CHART_TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => {
                      if (name === "cost") return [`$${value.toFixed(4)}`, "Cost"]
                      return [value, name]
                    }}
                    cursor={{ fill: "transparent" }}
                  />
                  <Bar dataKey="cost" name="cost" radius={[0, 4, 4, 0]}>
                    {costBreakdown.map((entry) => (
                      <Cell key={entry.api} fill={SERVICE_COLORS[entry.api] || COLORS.blue} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-white/40">No API calls today</div>
            )}
          </div>
          {/* Call counts table */}
          {costBreakdown.length > 0 && (
            <div className="space-y-1 mt-3 pt-3 border-t border-white/[0.06]">
              {costBreakdown.map((item) => (
                <div key={item.api} className="flex justify-between items-center text-xs py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SERVICE_COLORS[item.api] || COLORS.blue }} />
                    <span className="text-white/60 capitalize">{item.api}</span>
                  </div>
                  <div>
                    <span className="text-white font-medium">${item.cost.toFixed(4)}</span>
                    <span className="text-white/40 ml-2">({item.calls} calls)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Cost by AI Model (7 Days)">
          <div className="h-[260px]">
            {loading ? (
              <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
            ) : modelBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={modelBreakdown.map((m) => ({
                    ...m,
                    shortModel: m.model.replace("google/", "").replace("anthropic/", "").replace("openai/", ""),
                  }))}
                  layout="vertical"
                >
                  <XAxis type="number" axisLine={false} tickLine={false} tick={AXIS_TICK_SMALL} tickFormatter={(v: number) => `$${v.toFixed(3)}`} />
                  <YAxis
                    type="category"
                    dataKey="shortModel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                    width={120}
                  />
                  <Tooltip
                    {...CHART_TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => {
                      if (name === "cost") return [`$${value.toFixed(4)}`, "Cost"]
                      return [value, name]
                    }}
                    cursor={{ fill: "transparent" }}
                  />
                  <Bar dataKey="cost" name="cost" fill={COLORS.purple} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-white/40">No model data yet</div>
            )}
          </div>
          {/* Token usage table */}
          {modelBreakdown.length > 0 && (
            <div className="space-y-1 mt-3 pt-3 border-t border-white/[0.06]">
              {modelBreakdown.map((item) => (
                <div key={item.model} className="flex justify-between items-center text-xs py-1">
                  <span className="text-white/60 truncate max-w-[140px]" title={item.model}>
                    {item.model.replace("google/", "").replace("anthropic/", "").replace("openai/", "")}
                  </span>
                  <div className="flex items-center gap-3 text-white/40">
                    <span>{item.calls} calls</span>
                    <span>{(item.tokensInput / 1000).toFixed(0)}K in</span>
                    <span>{(item.tokensOutput / 1000).toFixed(0)}K out</span>
                    <span className="text-white font-medium">${item.cost.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Revenue vs Cost comparison */}
      <ChartCard title="Revenue vs Infrastructure Cost">
        <div className="grid grid-cols-2 gap-6 py-4">
          <div className="text-center">
            <p className="text-xs text-white/50 mb-1">Monthly Revenue (MRR)</p>
            <p className="text-3xl font-semibold text-green-400">${mrr.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/50 mb-1">Daily API Cost (Projected Monthly)</p>
            <p className="text-3xl font-semibold text-yellow-400">${(totalCostToday * 30).toFixed(2)}</p>
          </div>
        </div>
        <div className="border-t border-white/[0.06] pt-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/50">Net margin (projected)</span>
            <span className={cn("font-semibold", mrr - totalCostToday * 30 >= 0 ? "text-green-400" : "text-red-400")}>
              ${(mrr - totalCostToday * 30).toFixed(2)}
            </span>
          </div>
        </div>
      </ChartCard>
    </div>
  )
}

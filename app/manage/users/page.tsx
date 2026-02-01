"use client"

import { useState } from "react"
import { Users, TrendingUp, UserPlus, UserMinus } from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell
} from "recharts"
import { cn } from "@/lib/utils"
import { useAdminMetrics, useAdminMrr } from "@/hooks/use-admin-metrics"
import { useAdmin } from "../admin-context"
import {
  MetricCard, ChartCard, TimeFilter, SubpageHeader,
  ADMIN_COLORS, CHART_TOOLTIP_STYLE, AXIS_TICK
} from "../components"

const COLORS = ADMIN_COLORS

export default function UsersPage() {
  const { userId } = useAdmin()
  const [timeRange, setTimeRange] = useState(30)

  const { metrics, isLoading } = useAdminMetrics({ userId, timeRange, enabled: true })
  const { mrrData } = useAdminMrr({ userId, enabled: true })

  const loading = isLoading

  const tiers = metrics?.usersByTier || { free: 0, starter: 0, pro: 0 }
  const tierData = [
    { name: "Free", value: tiers.free, color: COLORS.blue },
    { name: "Starter", value: tiers.starter, color: COLORS.cyan },
    { name: "Pro", value: tiers.pro, color: COLORS.purple },
  ].filter((t) => t.value > 0)

  const churnRate = mrrData?.churnRate ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SubpageHeader title="Users" description="User growth, tiers, and subscription analytics" />
        <TimeFilter value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Key metrics */}
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
          title="Active Users"
          value={metrics?.activeUsers || 0}
          changeLabel={`${timeRange} day period`}
          icon={TrendingUp}
          iconColor="text-cyan-400"
          loading={loading}
        />
        <MetricCard
          title="Active Subscriptions"
          value={mrrData?.activeSubscriptions ?? metrics?.activeSubscriptions ?? 0}
          changeLabel={`${mrrData?.trialingSubscriptions ?? metrics?.trialUsers ?? 0} in trial`}
          icon={UserPlus}
          iconColor="text-green-400"
          loading={loading}
        />
        <MetricCard
          title="Churn Rate"
          value={`${churnRate.toFixed(1)}%`}
          changeLabel="monthly"
          icon={UserMinus}
          iconColor="text-red-400"
          loading={loading}
        />
      </div>

      {/* Signup trend — full width */}
      <ChartCard title="User Signups Over Time">
        <div className="h-[280px]">
          {loading ? (
            <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.signupTrend || []}>
                <defs>
                  <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="count" stroke={COLORS.blue} strokeWidth={2} fill="url(#signupGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* Tier breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Users by Tier">
          <div className="h-[240px]">
            {loading ? (
              <div className="h-full w-full bg-white/[0.03] rounded animate-pulse" />
            ) : tierData.length > 0 ? (
              <div className="flex items-center h-full gap-6">
                <ResponsiveContainer width="55%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={tierData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {tierData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP_STYLE} />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {tierData.map((t) => {
                    const total = tiers.free + tiers.starter + tiers.pro
                    const pct = total > 0 ? ((t.value / total) * 100).toFixed(1) : "0"
                    return (
                      <div key={t.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                          <span className="text-sm text-white/70">{t.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-white">{t.value.toLocaleString()}</span>
                          <span className="text-xs text-white/40 ml-2">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-white/40">No user data yet</div>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Subscription Revenue">
          <div className="space-y-4">
            <div className="text-3xl font-semibold text-white">
              ${(mrrData?.mrr ?? metrics?.mrr ?? 0).toFixed(2)}
              <span className="text-sm text-white/40 font-normal ml-2">/ month</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] rounded-xl p-3">
                <p className="text-xs text-white/50">Active</p>
                <p className="text-lg font-semibold text-white">{mrrData?.activeSubscriptions ?? metrics?.activeSubscriptions ?? 0}</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3">
                <p className="text-xs text-white/50">Trialing</p>
                <p className="text-lg font-semibold text-white">{mrrData?.trialingSubscriptions ?? metrics?.trialUsers ?? 0}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-t border-white/[0.06]">
                <span className="text-white/50">Churn rate</span>
                <span className={cn("font-medium", churnRate > 5 ? "text-red-400" : "text-green-400")}>
                  {churnRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-white/50">Avg revenue/user</span>
                <span className="text-white font-medium">
                  ${((mrrData?.mrr ?? 0) / Math.max(mrrData?.activeSubscriptions ?? 1, 1)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-white/50">Avg content/user</span>
                <span className="text-white font-medium">{metrics?.avgContentPerUser ?? 0}</span>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

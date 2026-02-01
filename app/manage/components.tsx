"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"

// Shared color palette across admin pages
export const ADMIN_COLORS = {
  blue: "#1d9bf0",
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  purple: "#a855f7",
  cyan: "#06b6d4",
  orange: "#f97316",
  amber: "#f59e0b",
}

// Shared tooltip style for all Recharts charts
export const CHART_TOOLTIP_STYLE = {
  wrapperStyle: {
    outline: "none",
    background: "transparent",
    border: "none",
    boxShadow: "none",
    padding: 0,
  } as React.CSSProperties,
  contentStyle: {
    backgroundColor: "#000",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "8px",
    fontSize: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  } as React.CSSProperties,
  labelStyle: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: 500,
  } as React.CSSProperties,
}

// Shared axis tick style
export const AXIS_TICK = { fill: "rgba(255,255,255,0.4)", fontSize: 11 }
export const AXIS_TICK_SMALL = { fill: "rgba(255,255,255,0.3)", fontSize: 9 }

// Skeleton loading placeholder
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-white/[0.06] rounded animate-pulse", className)} />
}

// Metric card — optionally clickable via href
export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "text-[#1d9bf0]",
  loading = false,
  href,
}: {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ElementType
  iconColor?: string
  loading?: boolean
  href?: string
}) {
  const isPositive = change && change > 0
  const isNegative = change && change < 0

  const content = (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-xl bg-white/[0.06]", loading ? "opacity-50" : iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        {loading ? (
          <Skeleton className="h-6 w-14 rounded-full" />
        ) : change !== undefined ? (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              isPositive && "text-green-400 bg-green-500/10",
              isNegative && "text-red-400 bg-red-500/10",
              !isPositive && !isNegative && "text-white/50 bg-white/[0.06]"
            )}
          >
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
    </>
  )

  const cardClass = cn(
    "bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 transition-colors",
    href ? "hover:bg-white/[0.06] hover:border-white/[0.1] cursor-pointer group" : "hover:bg-white/[0.05]"
  )

  if (href) {
    return (
      <Link href={href} className={cardClass}>
        {content}
        <div className="flex items-center gap-1 mt-2 text-xs text-white/0 group-hover:text-white/40 transition-colors">
          <span>View details</span>
          <ArrowUpRight className="w-3 h-3" />
        </div>
      </Link>
    )
  }

  return <div className={cardClass}>{content}</div>
}

// Chart container card
export function ChartCard({
  title,
  children,
  className,
  href,
}: {
  title: string
  children: React.ReactNode
  className?: string
  href?: string
}) {
  const inner = (
    <div className={cn("bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5", href && "hover:border-white/[0.1] transition-colors group", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/70">{title}</h3>
        {href && (
          <span className="text-xs text-white/0 group-hover:text-white/40 transition-colors flex items-center gap-1">
            View details <ArrowUpRight className="w-3 h-3" />
          </span>
        )}
      </div>
      {children}
    </div>
  )

  if (href) {
    return <Link href={href}>{inner}</Link>
  }

  return inner
}

// Time range filter buttons
export function TimeFilter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
            value === opt.value ? "bg-[#1d9bf0] text-white" : "text-white/50 hover:text-white/70"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// Page header used in subpages
export function SubpageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {description && <p className="text-sm text-white/50 mt-1">{description}</p>}
    </div>
  )
}

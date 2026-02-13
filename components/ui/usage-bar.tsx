import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface UsageBarProps {
  label: string
  used: number
  limit: number
  icon?: LucideIcon
  /** Compact variant for inline display (e.g., settings dropdown) */
  compact?: boolean
}

/**
 * Returns the progress bar color based on usage percentage.
 * Matches the podcast page pattern (blue → amber → red).
 */
function getBarColor(percentage: number): string {
  if (percentage >= 95) return "bg-red-500"
  if (percentage >= 80) return "bg-amber-500"
  return "bg-brand"
}

/**
 * Returns text color for the usage count based on percentage.
 */
function getTextColor(percentage: number): string {
  if (percentage >= 95) return "text-red-400"
  if (percentage >= 80) return "text-amber-400"
  return "text-white/60"
}

/**
 * Reusable usage progress bar with full and compact variants.
 *
 * Full variant: icon + label + used/limit + progress bar (for dashboard page)
 * Compact variant: label + used/limit + tiny progress bar (for dropdown/inline)
 */
export function UsageBar({ label, used, limit, icon: Icon, compact = false }: UsageBarProps) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const barColor = getBarColor(percentage)
  const textColor = getTextColor(percentage)

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/50">{label}</span>
        <span className={cn("text-xs font-medium tabular-nums", textColor)}>
          {used}/{limit}
        </span>
        <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
              <Icon className="w-4 h-4 text-white/50" />
            </div>
          )}
          <span className="text-sm text-white/70">{label}</span>
        </div>
        <span className={cn("text-sm font-medium tabular-nums", textColor)}>
          {used}
          <span className="text-white/50"> / {limit}</span>
        </span>
      </div>
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

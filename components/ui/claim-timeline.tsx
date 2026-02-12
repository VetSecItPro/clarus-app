"use client"

import { useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface TimelineIssue {
  claim_or_issue: string
  severity: "low" | "medium" | "high"
  timestamp?: string
}

interface ClaimTimelineProps {
  /** Content duration in seconds */
  duration: number
  /** Truth check issues with optional timestamps */
  issues: TimelineIssue[]
  /** Callback when a marker is clicked — receives issue index (in original issues array) and timestamp seconds */
  onMarkerClick?: (issueIndex: number, seconds: number) => void
  /** Index of the currently highlighted issue (-1 for none) */
  highlightedIndex?: number
}

const SEVERITY_COLORS = {
  high: { bg: "bg-red-500", ring: "ring-red-400/50", hover: "hover:bg-red-400" },
  medium: { bg: "bg-amber-500", ring: "ring-amber-400/50", hover: "hover:bg-amber-400" },
  low: { bg: "bg-emerald-500", ring: "ring-emerald-400/50", hover: "hover:bg-emerald-400" },
} as const

/** Parse "M:SS" or "H:MM:SS" timestamp to seconds */
function parseTimestamp(ts: string): number | null {
  const parts = ts.split(":").map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

export function ClaimTimeline({ duration, issues, onMarkerClick, highlightedIndex = -1 }: ClaimTimelineProps) {
  // Filter to issues that have valid timestamps and compute positions
  const markers = useMemo(() => {
    if (!duration || duration <= 0) return []

    return issues
      .map((issue, originalIndex) => {
        if (!issue.timestamp) return null
        const seconds = parseTimestamp(issue.timestamp)
        if (seconds === null || seconds < 0 || seconds > duration) return null
        return {
          originalIndex,
          seconds,
          position: (seconds / duration) * 100,
          severity: issue.severity,
          label: issue.claim_or_issue,
          timestamp: issue.timestamp,
        }
      })
      .filter(Boolean) as Array<{
        originalIndex: number
        seconds: number
        position: number
        severity: "low" | "medium" | "high"
        label: string
        timestamp: string
      }>
  }, [issues, duration])

  const handleClick = useCallback(
    (issueIndex: number, seconds: number) => {
      onMarkerClick?.(issueIndex, seconds)
    },
    [onMarkerClick]
  )

  // Don't render if no valid markers
  if (markers.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="relative"
    >
      {/* Track */}
      <div className="relative h-6 flex items-center group">
        <div className="w-full h-1.5 rounded-full bg-white/[0.08]" />

        {/* Markers */}
        {markers.map((marker) => {
          const colors = SEVERITY_COLORS[marker.severity]
          const isHighlighted = marker.originalIndex === highlightedIndex

          return (
            <button
              key={`${marker.originalIndex}-${marker.timestamp}`}
              onClick={() => handleClick(marker.originalIndex, marker.seconds)}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-200 cursor-pointer",
                "w-3 h-3",
                colors.bg,
                colors.hover,
                isHighlighted && `ring-2 ${colors.ring} scale-150`,
                !isHighlighted && "hover:scale-125"
              )}
              style={{ left: `${marker.position}%` }}
              title={`${marker.timestamp} — ${marker.label}`}
              aria-label={`${marker.severity} severity issue at ${marker.timestamp}: ${marker.label}`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-3">
          {markers.some((m) => m.severity === "high") && (
            <span className="flex items-center gap-1 text-[10px] text-white/40">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              High
            </span>
          )}
          {markers.some((m) => m.severity === "medium") && (
            <span className="flex items-center gap-1 text-[10px] text-white/40">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Medium
            </span>
          )}
          {markers.some((m) => m.severity === "low") && (
            <span className="flex items-center gap-1 text-[10px] text-white/40">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Low
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/30">
          {markers.length} issue{markers.length !== 1 ? "s" : ""} found
        </span>
      </div>
    </motion.div>
  )
}

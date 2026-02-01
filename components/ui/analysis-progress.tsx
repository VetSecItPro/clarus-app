"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check, Mic } from "lucide-react"
import { useState, useEffect, useRef } from "react"

interface AnalysisProgressProps {
  processingStatus: string | null
  briefOverview: string | null
  triage: unknown | null
  midLengthSummary: string | null
  truthCheck: unknown | null
  actionItems: unknown | null
  detailedSummary: string | null
  contentType: string | null
  isPolling: boolean
}

const SEGMENTS = [
  { key: "briefOverview", label: "Overview", color: "bg-blue-500", glow: "shadow-blue-500/40" },
  { key: "triage", label: "Assessment", color: "bg-amber-500", glow: "shadow-amber-500/40" },
  { key: "midLengthSummary", label: "Takeaways", color: "bg-cyan-500", glow: "shadow-cyan-500/40" },
  { key: "truthCheck", label: "Accuracy", color: "bg-emerald-500", glow: "shadow-emerald-500/40" },
  { key: "actionItems", label: "Actions", color: "bg-orange-500", glow: "shadow-orange-500/40" },
  { key: "detailedSummary", label: "Deep Dive", color: "bg-violet-500", glow: "shadow-violet-500/40" },
] as const

type SegmentKey = (typeof SEGMENTS)[number]["key"]

function getCompletedSegments(props: AnalysisProgressProps): Set<SegmentKey> {
  const completed = new Set<SegmentKey>()
  if (props.briefOverview) completed.add("briefOverview")
  if (props.triage) completed.add("triage")
  if (props.midLengthSummary) completed.add("midLengthSummary")
  if (props.truthCheck) completed.add("truthCheck")
  if (props.actionItems) completed.add("actionItems")
  if (props.detailedSummary) completed.add("detailedSummary")
  return completed
}

export function AnalysisProgress(props: AnalysisProgressProps) {
  const {
    processingStatus,
    contentType,
    isPolling,
  } = props

  const [showComplete, setShowComplete] = useState(false)
  const [shouldRender, setShouldRender] = useState(true)
  const wasPollingRef = useRef(false)

  const completed = getCompletedSegments(props)
  const completedCount = completed.size
  const isTranscribing = processingStatus === "transcribing"
  const isComplete = processingStatus === "complete" || completedCount === 6
  const isError = processingStatus === "error" || processingStatus === "refused"

  // Track if we were ever polling (to show exit animation)
  useEffect(() => {
    if (isPolling) {
      wasPollingRef.current = true
    }
  }, [isPolling])

  // Handle completion: show checkmark briefly, then collapse
  useEffect(() => {
    if (isComplete && wasPollingRef.current) {
      setShowComplete(true)
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isComplete])

  // Don't render if analysis was already complete on page load
  if (!isPolling && !wasPollingRef.current) return null
  // Don't render for error/refused states
  if (isError) return null
  // Don't render after exit animation
  if (!shouldRender) return null

  // Find the first incomplete segment (active segment)
  const activeIndex = SEGMENTS.findIndex((seg) => !completed.has(seg.key))

  return (
    <AnimatePresence>
      {shouldRender && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 sm:p-5"
        >
          {/* Transcribing phase (podcast only) */}
          {isTranscribing && contentType === "podcast" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Mic className="w-4 h-4 text-blue-400" />
                  <motion.div
                    className="absolute inset-0 rounded-full bg-blue-400/30"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <span className="text-sm text-white/70 font-medium">Transcribing audio...</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full w-1/3 bg-gradient-to-r from-blue-500/80 to-blue-400/40 rounded-full"
                  animate={{ x: ["-100%", "400%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Segmented progress bar */}
              <div className="flex gap-[3px] h-2 rounded-full bg-white/[0.06] overflow-hidden">
                {SEGMENTS.map((seg, i) => {
                  const isFilled = completed.has(seg.key)
                  const isActive = i === activeIndex && !isComplete

                  return (
                    <div key={seg.key} className="flex-1 relative overflow-hidden rounded-[2px]">
                      {/* Filled state */}
                      {isFilled && (
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 25 }}
                          className={`absolute inset-0 ${seg.color} shadow-sm ${seg.glow}`}
                          style={{ transformOrigin: "left" }}
                        />
                      )}
                      {/* Active shimmer */}
                      {isActive && (
                        <div
                          className={`absolute inset-0 ${seg.color} opacity-30 analysis-shimmer`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Label */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {showComplete ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Check className="w-4 h-4 text-emerald-400" />
                    </motion.div>
                  ) : null}
                  <span className="text-sm text-white/60">
                    {showComplete
                      ? "Analysis complete"
                      : `Analyzing... ${completedCount} of 6 sections`}
                  </span>
                </div>
                {!showComplete && completedCount > 0 && completedCount < 6 && (
                  <span className="text-xs text-white/40">
                    {SEGMENTS[activeIndex]?.label ?? ""}
                  </span>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

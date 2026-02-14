"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check, Mic, Clock, AlertTriangle, RefreshCw } from "lucide-react"
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
  /** When the content was created — used to detect stale transcription on page load */
  contentDateAdded?: string | null
  /** Callback to retry processing (re-submit to AssemblyAI) */
  onRetry?: () => void
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
    contentDateAdded,
    onRetry,
  } = props

  const [showComplete, setShowComplete] = useState(false)
  const [shouldRender, setShouldRender] = useState(true)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const wasPollingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const completed = getCompletedSegments(props)
  const completedCount = completed.size
  const isTranscribing = processingStatus === "transcribing"
  const isComplete = processingStatus === "complete" || completedCount === 6
  const isError = processingStatus === "error" || processingStatus === "refused"

  // Calculate how long ago the content was created (for detecting stale transcription on load)
  const contentAgeSeconds = contentDateAdded
    ? Math.floor((Date.now() - new Date(contentDateAdded).getTime()) / 1000)
    : 0
  // Total effective elapsed = local timer + age at load (if already stale)
  const totalTranscriptionSeconds = isTranscribing
    ? Math.max(elapsedSeconds, contentAgeSeconds)
    : elapsedSeconds
  const isTranscriptionSlow = totalTranscriptionSeconds >= 300 // 5 minutes
  const isTranscriptionStuck = totalTranscriptionSeconds >= 600 // 10 minutes

  // Track if we were ever polling (to show exit animation)
  useEffect(() => {
    if (isPolling) {
      wasPollingRef.current = true
    }
  }, [isPolling])

  // Elapsed timer for transcription phase
  useEffect(() => {
    if (isTranscribing) {
      setElapsedSeconds(0)
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isTranscribing])

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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    {isTranscriptionStuck ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <>
                        <Mic className="w-4 h-4 text-blue-400" />
                        <motion.div
                          className="absolute inset-0 rounded-full bg-blue-400/30"
                          animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${isTranscriptionStuck ? "text-amber-300/80" : "text-white/70"}`} aria-live="polite">
                    {isTranscriptionStuck
                      ? "Transcription appears stuck"
                      : isTranscriptionSlow
                        ? "Still transcribing — longer episodes take more time"
                        : "Transcribing audio..."}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                  <Clock className="w-3 h-3" />
                  <span>{Math.floor(totalTranscriptionSeconds / 60)}:{String(totalTranscriptionSeconds % 60).padStart(2, "0")}</span>
                </div>
              </div>
              {!isTranscriptionStuck && (
                <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full w-1/3 bg-gradient-to-r from-blue-500/80 to-blue-400/40 rounded-full"
                    animate={{ x: ["-100%", "400%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              )}
              {isTranscriptionStuck ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.6875rem] text-amber-300/60">
                    The transcription service may have encountered an issue. You can retry to re-submit the audio.
                  </p>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition-all text-xs whitespace-nowrap"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  )}
                </div>
              ) : isTranscriptionSlow ? (
                <p className="text-[0.6875rem] text-white/50">Long episodes (1hr+) can take 5-10 minutes to transcribe</p>
              ) : (
                <p className="text-[0.6875rem] text-white/50">Typically takes 2-5 minutes depending on episode length</p>
              )}
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
                  <span className="text-sm text-white/60" aria-live="polite">
                    {showComplete
                      ? "Analysis complete"
                      : `Analyzing... ${completedCount} of 6 sections`}
                  </span>
                </div>
                {!showComplete && completedCount > 0 && completedCount < 6 && (
                  <span className="text-xs text-white/50">
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

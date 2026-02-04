"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

// ── Types ──────────────────────────────────────────

interface ActiveAnalysis {
  contentId: string
  title: string
  type: string | null
  startedAt: number // Date.now()
  completedAt: number | null // Date.now() when analysis finished
}

interface ActiveAnalysisContextValue {
  activeAnalysis: ActiveAnalysis | null
  isComplete: boolean
  startTracking: (contentId: string, title: string, type?: string | null) => void
  markComplete: (contentId: string, title?: string) => void
  clearTracking: () => void
  pausePolling: () => void
  resumePolling: () => void
}

// ── Constants ──────────────────────────────────────

const STORAGE_KEY = "clarus:active-analysis"
const PROCESSING_TTL_MS = 30 * 60 * 1000 // 30 minutes for in-progress analyses
const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours for completed analyses
const POLL_INTERVAL_MS = 5000
const MAX_CONSECUTIVE_ERRORS = 3

// ── Helpers ────────────────────────────────────────

function loadFromStorage(): ActiveAnalysis | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: ActiveAnalysis = JSON.parse(raw)
    // Use longer TTL for completed analyses (24h vs 30min)
    const ttl = parsed.completedAt ? COMPLETED_TTL_MS : PROCESSING_TTL_MS
    const anchor = parsed.completedAt || parsed.startedAt
    if (Date.now() - anchor > ttl) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function saveToStorage(analysis: ActiveAnalysis): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(analysis))
}

function clearStorage(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

// ── Context ────────────────────────────────────────

const ActiveAnalysisContext = createContext<ActiveAnalysisContextValue | null>(null)

export function useActiveAnalysis(): ActiveAnalysisContextValue {
  const ctx = useContext(ActiveAnalysisContext)
  if (!ctx) {
    throw new Error("useActiveAnalysis must be used within an ActiveAnalysisProvider")
  }
  return ctx
}

// ── Provider ───────────────────────────────────────

export function ActiveAnalysisProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [activeAnalysis, setActiveAnalysis] = useState<ActiveAnalysis | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  const consecutiveErrorsRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track whether we've already fired the toast for the current analysis
  const toastFiredRef = useRef<string | null>(null)
  // Refs to avoid stale closures in callbacks
  const activeAnalysisRef = useRef<ActiveAnalysis | null>(null)
  const isCompleteRef = useRef(false)

  // Keep refs in sync with state (for stable callbacks)
  useEffect(() => {
    activeAnalysisRef.current = activeAnalysis
  }, [activeAnalysis])

  useEffect(() => {
    isCompleteRef.current = isComplete
  }, [isComplete])

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage()
    if (stored) {
      setActiveAnalysis(stored)
      activeAnalysisRef.current = stored
      if (stored.completedAt) {
        setIsComplete(true)
        isCompleteRef.current = true
      }
    }
  }, [])

  // ── Start tracking ─────────────────────────────

  const startTracking = useCallback(
    (contentId: string, title: string, type?: string | null) => {
      setIsComplete(false)
      isCompleteRef.current = false
      consecutiveErrorsRef.current = 0
      toastFiredRef.current = null

      const analysis: ActiveAnalysis = {
        contentId,
        title,
        type: type ?? null,
        startedAt: Date.now(),
        completedAt: null,
      }
      setActiveAnalysis(analysis)
      activeAnalysisRef.current = analysis
      saveToStorage(analysis)
    },
    []
  )

  // ── Clear tracking ─────────────────────────────

  const clearTracking = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setActiveAnalysis(null)
    activeAnalysisRef.current = null
    setIsComplete(false)
    isCompleteRef.current = false
    setIsPaused(false)
    consecutiveErrorsRef.current = 0
    toastFiredRef.current = null
    clearStorage()
  }, [])

  // ── Pause / Resume ─────────────────────────────

  const pausePolling = useCallback(() => {
    setIsPaused(true)
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const resumePolling = useCallback(() => {
    setIsPaused(false)
  }, [])

  // ── Mark complete (called by item page when its polling detects completion)
  // Uses refs to avoid stale closure issues — this function is stable across renders

  const markComplete = useCallback(
    (contentId: string, title?: string) => {
      // Use refs to get current values (avoids stale closure)
      const currentAnalysis = activeAnalysisRef.current
      const currentIsComplete = isCompleteRef.current

      // Only mark complete if this is the currently tracked content
      if (!currentAnalysis || currentAnalysis.contentId !== contentId) return
      if (currentIsComplete) return // Already complete

      const updated: ActiveAnalysis = {
        ...currentAnalysis,
        title: title || currentAnalysis.title,
        completedAt: Date.now(),
      }
      setActiveAnalysis(updated)
      activeAnalysisRef.current = updated
      saveToStorage(updated)
      setIsComplete(true)
      isCompleteRef.current = true
    },
    [] // Empty deps — uses refs for latest values
  )

  // ── Completion handler ─────────────────────────

  const handleCompletion = useCallback(
    (analysis: ActiveAnalysis, updatedTitle?: string) => {
      // Persist as "Current" — update title + mark completed
      const updated: ActiveAnalysis = {
        ...analysis,
        title: updatedTitle || analysis.title,
        completedAt: Date.now(),
      }
      setActiveAnalysis(updated)
      activeAnalysisRef.current = updated
      saveToStorage(updated)
      setIsComplete(true)
      isCompleteRef.current = true

      // Fire toast only once per analysis
      if (toastFiredRef.current !== analysis.contentId) {
        toastFiredRef.current = analysis.contentId
        const displayTitle = updated.title
        const truncatedTitle =
          displayTitle.length > 50
            ? displayTitle.substring(0, 50) + "…"
            : displayTitle
        toast.success(`Analysis complete! ${truncatedTitle}`, {
          action: {
            label: "View",
            onClick: () => router.push(`/item/${analysis.contentId}`),
          },
          duration: 6000,
        })
      }
    },
    [router]
  )

  // ── Polling effect ─────────────────────────────

  useEffect(() => {
    if (!activeAnalysis || isComplete || isPaused) {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    // Check TTL expiry for in-progress analyses
    if (Date.now() - activeAnalysis.startedAt > PROCESSING_TTL_MS) {
      clearTracking()
      return
    }

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/content-status/${activeAnalysis.contentId}`
        )

        if (!response.ok) {
          consecutiveErrorsRef.current++
          if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
            clearTracking()
            return
          }
          // Schedule next poll despite error
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
          return
        }

        consecutiveErrorsRef.current = 0
        const data = await response.json()

        // Update title if we got a real one (replace "Processing..." placeholder)
        if (data.title && !data.title.startsWith("Analyzing:")) {
          const updated = { ...activeAnalysis, title: data.title }
          if (data.type) updated.type = data.type
          setActiveAnalysis(updated)
          activeAnalysisRef.current = updated
          saveToStorage(updated)
        }

        // Check if complete
        if (data.processing_status === "complete") {
          handleCompletion(activeAnalysis, data.title)
          return
        }

        // Check if failed
        if (data.processing_status === "failed") {
          clearTracking()
          return
        }

        // Schedule next poll
        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        consecutiveErrorsRef.current++
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
          clearTracking()
          return
        }
        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    // Start first poll after a short delay
    pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [activeAnalysis, isComplete, isPaused, clearTracking, handleCompletion])

  // ── Cleanup timers on unmount ──────────────────

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  return (
    <ActiveAnalysisContext.Provider
      value={{
        activeAnalysis,
        isComplete,
        startTracking,
        markComplete,
        clearTracking,
        pausePolling,
        resumePolling,
      }}
    >
      {children}
    </ActiveAnalysisContext.Provider>
  )
}

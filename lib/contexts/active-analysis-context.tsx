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
}

interface ActiveAnalysisContextValue {
  activeAnalysis: ActiveAnalysis | null
  isComplete: boolean
  startTracking: (contentId: string, title: string, type?: string | null) => void
  clearTracking: () => void
  pausePolling: () => void
  resumePolling: () => void
}

// ── Constants ──────────────────────────────────────

const STORAGE_KEY = "clarus:active-analysis"
const TTL_MS = 30 * 60 * 1000 // 30 minutes
const POLL_INTERVAL_MS = 5000
const MAX_CONSECUTIVE_ERRORS = 3
const COMPLETE_DISPLAY_MS = 8000 // Show "Ready" state for 8s then clear

// ── Helpers ────────────────────────────────────────

function loadFromStorage(): ActiveAnalysis | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: ActiveAnalysis = JSON.parse(raw)
    // Expire if older than TTL
    if (Date.now() - parsed.startedAt > TTL_MS) {
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
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track whether we've already fired the toast for the current analysis
  const toastFiredRef = useRef<string | null>(null)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage()
    if (stored) {
      setActiveAnalysis(stored)
    }
  }, [])

  // ── Start tracking ─────────────────────────────

  const startTracking = useCallback(
    (contentId: string, title: string, type?: string | null) => {
      // Clear any previous complete/clear timers
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }
      setIsComplete(false)
      consecutiveErrorsRef.current = 0
      toastFiredRef.current = null

      const analysis: ActiveAnalysis = {
        contentId,
        title,
        type: type ?? null,
        startedAt: Date.now(),
      }
      setActiveAnalysis(analysis)
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
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current)
      clearTimerRef.current = null
    }
    setActiveAnalysis(null)
    setIsComplete(false)
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

  // ── Completion handler ─────────────────────────

  const handleCompletion = useCallback(
    (analysis: ActiveAnalysis, updatedTitle?: string) => {
      // Update title if the API returned a real one
      if (updatedTitle && updatedTitle !== analysis.title) {
        const updated = { ...analysis, title: updatedTitle }
        setActiveAnalysis(updated)
      }

      setIsComplete(true)

      // Fire toast only once per analysis
      if (toastFiredRef.current !== analysis.contentId) {
        toastFiredRef.current = analysis.contentId
        const displayTitle = updatedTitle || analysis.title
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

      // Auto-clear after delay
      clearTimerRef.current = setTimeout(() => {
        setActiveAnalysis(null)
        setIsComplete(false)
        clearStorage()
      }, COMPLETE_DISPLAY_MS)
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

    // Check TTL expiry
    if (Date.now() - activeAnalysis.startedAt > TTL_MS) {
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
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    }
  }, [])

  return (
    <ActiveAnalysisContext.Provider
      value={{
        activeAnalysis,
        isComplete,
        startTracking,
        clearTracking,
        pausePolling,
        resumePolling,
      }}
    >
      {children}
    </ActiveAnalysisContext.Provider>
  )
}

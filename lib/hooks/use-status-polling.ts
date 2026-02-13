"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { AnalysisLanguage } from "@/lib/languages"

interface ContentStatus {
  id: string
  title: string | null
  url: string
  type: "youtube" | "article" | "x_post" | "podcast"
  thumbnail_url?: string | null
  author?: string | null
  duration?: number | null
  processing_status: string | null
  triage: import("@/types/database.types").TriageData | null
  brief_overview: string | null
  detailed_summary: string | null
  truth_check: import("@/types/database.types").TruthCheckData | null
  hasError?: boolean
  errorMessage?: string
}

interface UseStatusPollingOptions {
  analysisLanguage: AnalysisLanguage
  onStatusUpdate: (data: ContentStatus) => void
  onInitialReady: (data: ContentStatus) => void
  onError: (error: string) => void
}

/**
 * Manages status polling for content analysis with timeout, error handling, and cleanup.
 *
 * Polls `/api/content-status/:id` every 2 seconds until:
 * - Initial analysis (triage + brief_overview) is ready
 * - Processing completes
 * - An error or timeout (5 minutes) occurs
 *
 * Also provides `retryAnalysis` to re-trigger processing after a failure.
 */
export function useStatusPolling({
  analysisLanguage,
  onStatusUpdate,
  onInitialReady,
  onError,
}: UseStatusPollingOptions) {
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const pollCountRef = useRef<number>(0)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback((id: string) => {
    stopPolling()
    pollCountRef.current = 0
    setAnalysisError(null)

    const MAX_POLL_COUNT = 150 // 5 minutes at 2s intervals

    const poll = async () => {
      pollCountRef.current++

      try {
        const langParam = analysisLanguage !== "en" ? `?language=${analysisLanguage}` : ""
        const response = await fetch(`/api/content-status/${id}${langParam}`)
        if (!response.ok) {
          if (response.status === 404) {
            const errorMsg = "Content not found. Please try again."
            setAnalysisError(errorMsg)
            onError(errorMsg)
            stopPolling()
          }
          return
        }

        const data: ContentStatus = await response.json()
        onStatusUpdate(data)

        // Check for error status
        if (data.processing_status === "error") {
          const errorMsg = "Analysis failed. Please try again."
          setAnalysisError(errorMsg)
          onError(errorMsg)
          stopPolling()
          return
        }

        // Check for timeout
        if (pollCountRef.current > MAX_POLL_COUNT && !data.brief_overview) {
          const errorMsg = "Analysis is taking too long. Please try again later."
          setAnalysisError(errorMsg)
          onError(errorMsg)
          stopPolling()
          return
        }

        // Check if initial analysis is ready
        if (data.triage && data.brief_overview) {
          onInitialReady(data)

          // Stop polling when complete
          if (data.processing_status === "complete") {
            stopPolling()
          }
        }
      } catch (error) {
        console.error("Polling error:", error)
        // Don't set error on transient network issues
      }
    }

    // Poll immediately, then every 2 seconds
    poll()
    pollingRef.current = setInterval(poll, 2000)
  }, [analysisLanguage, onStatusUpdate, onInitialReady, onError, stopPolling])

  const retryAnalysis = useCallback(async (contentId: string) => {
    setAnalysisError(null)

    try {
      await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: contentId, force_regenerate: true, language: analysisLanguage }),
      })

      startPolling(contentId)
    } catch (error) {
      console.error("Retry error:", error)
      setAnalysisError("Failed to retry analysis. Please try again.")
    }
  }, [analysisLanguage, startPolling])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  return {
    startPolling,
    stopPolling,
    retryAnalysis,
    analysisError,
    setAnalysisError,
  }
}

export type { ContentStatus }

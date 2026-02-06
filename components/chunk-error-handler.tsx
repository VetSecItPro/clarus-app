"use client"

import { useEffect } from "react"

/**
 * Handles chunk loading failures caused by deployment skew.
 *
 * When a new deployment happens, old chunk files are eventually removed.
 * Users with cached HTML may try to load old chunks that no longer exist,
 * resulting in 404 errors. This component detects those failures and
 * triggers a page refresh to load the new deployment's assets.
 *
 * DEPLOYMENT-SKEW: This prevents 404 errors on lazy-loaded routes after deploys
 */
export function ChunkErrorHandler() {
  useEffect(() => {
    // Track if we've already triggered a refresh to prevent loops
    const REFRESH_KEY = "clarus-chunk-refresh"
    const REFRESH_COOLDOWN = 10000 // 10 seconds between refresh attempts

    const handleError = (event: ErrorEvent) => {
      const error = event.error || event.message || ""
      const errorString = typeof error === "string" ? error : error?.toString?.() || ""

      // Detect chunk loading failures
      const isChunkError =
        errorString.includes("Loading chunk") ||
        errorString.includes("ChunkLoadError") ||
        errorString.includes("Failed to fetch dynamically imported module") ||
        (event.message && event.message.includes("_next/static/chunks"))

      if (isChunkError) {
        const lastRefresh = sessionStorage.getItem(REFRESH_KEY)
        const now = Date.now()

        // Prevent refresh loops — only refresh once per cooldown period
        if (!lastRefresh || now - parseInt(lastRefresh, 10) > REFRESH_COOLDOWN) {
          console.warn("[Clarus] Detected stale deployment assets. Refreshing...")
          sessionStorage.setItem(REFRESH_KEY, now.toString())
          window.location.reload()
        }
      }
    }

    // Also handle unhandled promise rejections (dynamic imports fail this way)
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.toString?.() || ""

      const isChunkError =
        reason.includes("Loading chunk") ||
        reason.includes("ChunkLoadError") ||
        reason.includes("Failed to fetch dynamically imported module") ||
        reason.includes("_next/static/chunks")

      if (isChunkError) {
        const lastRefresh = sessionStorage.getItem(REFRESH_KEY)
        const now = Date.now()

        if (!lastRefresh || now - parseInt(lastRefresh, 10) > REFRESH_COOLDOWN) {
          console.warn("[Clarus] Detected stale deployment assets. Refreshing...")
          sessionStorage.setItem(REFRESH_KEY, now.toString())
          window.location.reload()
        }
      }
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleRejection)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleRejection)
    }
  }, [])

  return null
}

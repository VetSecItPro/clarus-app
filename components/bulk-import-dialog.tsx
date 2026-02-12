"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Layers,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  AlertTriangle,
  X,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { validateUrl } from "@/lib/validation"
import { toast } from "sonner"
import type { UserTier } from "@/types/database.types"
import { TIER_LIMITS } from "@/lib/tier-limits"

type ItemStatus = "queued" | "processing" | "complete" | "failed"

interface BulkImportItem {
  url: string
  contentId: string | null
  status: ItemStatus
  error?: string
  type?: string
}

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string | null
  userTier: UserTier
}

/** Parse a raw text block into individual URLs (newline or comma separated) */
function parseUrls(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function BulkImportDialog({
  open,
  onOpenChange,
  userId,
  userTier,
}: BulkImportDialogProps) {
  const router = useRouter()
  const [rawInput, setRawInput] = useState("")
  const [parsedUrls, setParsedUrls] = useState<
    Array<{ url: string; valid: boolean; error?: string }>
  >([])
  const [items, setItems] = useState<BulkImportItem[]>([])
  const [phase, setPhase] = useState<"input" | "progress" | "complete">("input")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [overallError, setOverallError] = useState<string | null>(null)
  const pollIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const batchLimit = TIER_LIMITS[userTier].bulkImportBatchSize

  // Validate URLs as user types (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const urls = parseUrls(rawInput)
      const validated = urls.map((url) => {
        const result = validateUrl(url)
        return {
          url,
          valid: result.isValid,
          error: result.error,
        }
      })
      setParsedUrls(validated)
    }, 300)
    return () => clearTimeout(timer)
  }, [rawInput])

  // Cleanup polling intervals on unmount or dialog close
  useEffect(() => {
    const intervals = pollIntervalsRef.current
    return () => {
      for (const interval of intervals.values()) {
        clearInterval(interval)
      }
      intervals.clear()
    }
  }, [])

  // Poll for content status
  const pollContentStatus = useCallback((contentId: string, _url: string) => {
    let pollCount = 0
    const MAX_POLLS = 150 // 5 min at 2s intervals

    const interval = setInterval(async () => {
      pollCount++

      if (pollCount > MAX_POLLS) {
        clearInterval(interval)
        pollIntervalsRef.current.delete(contentId)
        setItems((prev) =>
          prev.map((item) =>
            item.contentId === contentId
              ? { ...item, status: "failed", error: "Analysis timed out" }
              : item
          )
        )
        return
      }

      try {
        const response = await fetch(`/api/content-status/${contentId}`)
        if (!response.ok) return

        const data = await response.json()

        if (data.processing_status === "error") {
          clearInterval(interval)
          pollIntervalsRef.current.delete(contentId)
          setItems((prev) =>
            prev.map((item) =>
              item.contentId === contentId
                ? { ...item, status: "failed", error: "Analysis failed" }
                : item
            )
          )
          return
        }

        if (data.processing_status === "complete" || (data.triage && data.brief_overview)) {
          clearInterval(interval)
          pollIntervalsRef.current.delete(contentId)
          setItems((prev) =>
            prev.map((item) =>
              item.contentId === contentId
                ? { ...item, status: "complete" }
                : item
            )
          )
        } else {
          // Still processing
          setItems((prev) =>
            prev.map((item) =>
              item.contentId === contentId && item.status === "queued"
                ? { ...item, status: "processing" }
                : item
            )
          )
        }
      } catch {
        // Transient network error — keep polling
      }
    }, 2000)

    pollIntervalsRef.current.set(contentId, interval)
  }, [])

  // Handle submission
  const handleSubmit = useCallback(async () => {
    if (!userId) {
      toast.error("Please sign in to continue")
      return
    }

    const validUrls = parsedUrls.filter((u) => u.valid).map((u) => u.url)
    if (validUrls.length === 0) {
      toast.error("No valid URLs to analyze")
      return
    }

    setIsSubmitting(true)
    setOverallError(null)

    try {
      const response = await fetch("/api/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: validUrls }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.upgrade_required) {
          setOverallError(data.error || "Upgrade required")
          toast.error("Limit reached", {
            description: data.error,
            action: {
              label: "View Plans",
              onClick: () => window.open("/pricing", "_blank"),
            },
          })
        } else {
          setOverallError(data.error || "Something went wrong")
        }
        setIsSubmitting(false)
        return
      }

      // Build items from results
      const newItems: BulkImportItem[] = []

      // Successfully created items
      if (data.results) {
        for (const result of data.results as Array<{
          url: string
          contentId: string | null
          type: string
          error?: string
        }>) {
          if (result.contentId) {
            newItems.push({
              url: result.url,
              contentId: result.contentId,
              status: "queued",
              type: result.type,
            })
          } else {
            newItems.push({
              url: result.url,
              contentId: null,
              status: "failed",
              error: result.error || "Failed to create",
            })
          }
        }
      }

      // Invalid URLs
      if (data.invalid) {
        for (const inv of data.invalid as Array<{ url: string; error: string }>) {
          newItems.push({
            url: inv.url,
            contentId: null,
            status: "failed",
            error: inv.error,
          })
        }
      }

      setItems(newItems)
      setPhase("progress")

      // Start polling for each queued item
      for (const item of newItems) {
        if (item.contentId && item.status === "queued") {
          pollContentStatus(item.contentId, item.url)
        }
      }

      if (data.skipped_due_to_limit > 0) {
        toast.warning(
          `${data.skipped_due_to_limit} URL(s) skipped — monthly analysis limit reached`
        )
      }
    } catch {
      setOverallError("Network error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }, [userId, parsedUrls, pollContentStatus])

  // Check if all items are done
  const completedCount = items.filter((i) => i.status === "complete").length
  const failedCount = items.filter((i) => i.status === "failed").length
  const totalItems = items.length
  const allDone = totalItems > 0 && completedCount + failedCount === totalItems
  const processingCount = items.filter(
    (i) => i.status === "queued" || i.status === "processing"
  ).length

  // Switch to complete phase when all done
  useEffect(() => {
    if (allDone && phase === "progress") {
      setPhase("complete")
    }
  }, [allDone, phase])

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Clean up polling
      for (const interval of pollIntervalsRef.current.values()) {
        clearInterval(interval)
      }
      pollIntervalsRef.current.clear()

      // Reset state after animation
      setTimeout(() => {
        setRawInput("")
        setParsedUrls([])
        setItems([])
        setPhase("input")
        setIsSubmitting(false)
        setOverallError(null)
      }, 300)
    }
    onOpenChange(newOpen)
  }

  const validCount = parsedUrls.filter((u) => u.valid).length
  const invalidCount = parsedUrls.filter((u) => !u.valid).length

  const statusIcon = (status: ItemStatus) => {
    switch (status) {
      case "queued":
        return <Clock className="w-4 h-4 text-white/40" />
      case "processing":
        return <Loader2 className="w-4 h-4 text-brand animate-spin" />
      case "complete":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />
    }
  }

  const statusLabel = (status: ItemStatus) => {
    switch (status) {
      case "queued":
        return "Queued"
      case "processing":
        return "Analyzing..."
      case "complete":
        return "Complete"
      case "failed":
        return "Failed"
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="bg-[#0a0a0a] border-white/10 text-white sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand" />
            Bulk Import
          </DialogTitle>
          <DialogDescription className="text-white/50">
            {phase === "input"
              ? `Paste up to ${batchLimit} URLs to analyze them all at once.`
              : phase === "progress"
              ? `Analyzing ${processingCount > 0 ? `${completedCount} of ${totalItems}` : "..."}`
              : `${completedCount} of ${totalItems} completed successfully.`}
          </DialogDescription>
        </DialogHeader>

        {/* Input Phase */}
        {phase === "input" && (
          <div className="flex flex-col gap-4">
            <Textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={"Paste URLs here, one per line:\nhttps://example.com/article-1\nhttps://youtube.com/watch?v=abc123\nhttps://example.com/article-2"}
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 min-h-[140px] resize-none focus:border-brand/50 focus:ring-brand/20"
              disabled={isSubmitting}
            />

            {/* Validation Preview */}
            {parsedUrls.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs">
                  {validCount > 0 && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {validCount} valid
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="text-red-400 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      {invalidCount} invalid
                    </span>
                  )}
                  {validCount > batchLimit && (
                    <span className="text-yellow-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Max {batchLimit} per batch ({userTier} plan)
                    </span>
                  )}
                </div>

                {/* URL list preview */}
                <div className="max-h-[160px] overflow-y-auto space-y-1 scrollbar-thin">
                  {parsedUrls.map((item, i) => (
                    <div
                      key={`${item.url}-${i}`}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs",
                        item.valid
                          ? "bg-emerald-500/5 border border-emerald-500/10"
                          : "bg-red-500/5 border border-red-500/10"
                      )}
                    >
                      {item.valid ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                      )}
                      <span
                        className={cn(
                          "truncate flex-1",
                          item.valid ? "text-white/70" : "text-red-300/70"
                        )}
                      >
                        {item.url}
                      </span>
                      {!item.valid && item.error && (
                        <span className="text-red-400/60 flex-shrink-0">
                          {item.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overall error */}
            {overallError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-300">{overallError}</span>
              </div>
            )}

            {/* Submit button */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/30">
                Each URL counts against your monthly limit
              </span>
              <Button
                onClick={handleSubmit}
                disabled={
                  isSubmitting || validCount === 0 || !userId
                }
                className="bg-brand hover:bg-brand-hover text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    Analyze {Math.min(validCount, batchLimit)} URL{Math.min(validCount, batchLimit) !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Progress / Complete Phase */}
        {(phase === "progress" || phase === "complete") && (
          <div className="flex flex-col gap-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>
                  {allDone
                    ? `Done - ${completedCount} succeeded, ${failedCount} failed`
                    : `Analyzing ${completedCount + failedCount} of ${totalItems}...`}
                </span>
                <span>
                  {Math.round(((completedCount + failedCount) / Math.max(totalItems, 1)) * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-brand rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((completedCount + failedCount) / Math.max(totalItems, 1)) * 100}%`,
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Item list */}
            <div className="max-h-[300px] overflow-y-auto space-y-1.5 scrollbar-thin">
              <AnimatePresence initial={false}>
                {items.map((item, i) => (
                  <motion.div
                    key={`${item.url}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.05 }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
                      item.status === "complete"
                        ? "bg-emerald-500/5 border-emerald-500/10"
                        : item.status === "failed"
                        ? "bg-red-500/5 border-red-500/10"
                        : "bg-white/[0.02] border-white/[0.06]"
                    )}
                  >
                    {statusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80 truncate">
                        {item.url}
                      </p>
                      <p
                        className={cn(
                          "text-[0.625rem] mt-0.5",
                          item.status === "complete"
                            ? "text-emerald-400/70"
                            : item.status === "failed"
                            ? "text-red-400/70"
                            : "text-white/30"
                        )}
                      >
                        {item.error || statusLabel(item.status)}
                      </p>
                    </div>

                    {/* View button for completed items */}
                    {item.status === "complete" && item.contentId && (
                      <button
                        onClick={() => {
                          router.push(`/item/${item.contentId}`)
                          handleOpenChange(false)
                        }}
                        className="flex items-center gap-1 text-xs text-brand hover:text-brand-hover transition-colors flex-shrink-0"
                        aria-label={`View analysis for ${item.url}`}
                      >
                        View
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Actions */}
            {phase === "complete" && (
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRawInput("")
                    setParsedUrls([])
                    setItems([])
                    setPhase("input")
                    setOverallError(null)
                  }}
                  className="text-white/50 hover:text-white"
                >
                  Import More
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                  className="bg-brand hover:bg-brand-hover text-white"
                >
                  <X className="w-4 h-4" />
                  Close
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

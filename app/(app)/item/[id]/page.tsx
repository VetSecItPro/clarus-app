"use client"
import Link from "next/link"
import Image from "next/image"
import dynamic from "next/dynamic"
import { ArrowLeft, Loader2, FileText, Mail, RefreshCw, Download, MessageSquare, Bookmark, BookmarkCheck, MoreHorizontal, Trash2 } from "lucide-react"
import { useState, useEffect, useCallback, useRef, use } from "react"
import { supabase } from "@/lib/supabase"
import type { Tables, TriageData, TruthCheckData, ContentCategory } from "@/types/database.types"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import { getCachedSession } from "@/components/with-auth"
import { cn, formatDuration, getYouTubeVideoId, getDomainFromUrl } from "@/lib/utils"
import { detectPaywallTruncation } from "@/lib/paywall-detection"
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/ui/youtube-player"
import { toast } from "sonner"
import type { CrossReference } from "@/components/ui/truth-check-card"
import { useUpgradeModal } from "@/lib/hooks/use-upgrade-modal"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useIsDesktop } from "@/lib/hooks/use-media-query"
import type { Session } from "@supabase/supabase-js"
import { type AnalysisLanguage, getLanguageConfig, LANGUAGE_STORAGE_KEY } from "@/lib/languages"
import { LanguageSelector } from "@/components/ui/language-selector"
// PERF: use shared SWR hook instead of independent Supabase query for tier data
import { useUserTier } from "@/lib/hooks/use-user-tier"
import { useActiveAnalysis } from "@/lib/contexts/active-analysis-context"
import { type AnalysisMode } from "@/lib/analysis-modes"
import { TagsManager } from "./tags-manager"
import { SourceHistoryCard } from "./source-history-card"
import { ContentInfoCard } from "./content-info-card"
import { ItemAnalysis } from "./item-analysis"
import { FullTextContent } from "./full-text-content"

// PERF: Dynamic imports — reduce initial bundle by lazy-loading heavy/conditional components
const InlineChat = dynamic(() => import("@/components/inline-chat").then(m => ({ default: m.InlineChat })), { ssr: false })
const ShareModal = dynamic(() => import("@/components/share-modal").then(m => ({ default: m.ShareModal })), { ssr: false })
const UpgradeModal = dynamic(() => import("@/components/upgrade-modal").then(m => ({ default: m.UpgradeModal })), { ssr: false })
const EditAIPromptsModal = dynamic(() => import("@/components/edit-ai-prompts-modal").then(m => ({ default: m.EditAIPromptsModal })), { ssr: false })
const ClaimTimeline = dynamic(() => import("@/components/ui/claim-timeline").then(m => ({ default: m.ClaimTimeline })), { ssr: false })
const SubscribePrompt = dynamic(() => import("@/components/subscribe-prompt").then(m => ({ default: m.SubscribePrompt })), { ssr: false })
// Next.js page props
interface PageProps {
  params: Promise<{ id: string }>
}

type ContentItem = Tables<"content">
type SummaryItem = Tables<"summaries">

interface ContentWithSummary extends ContentItem {
  summary?: SummaryItem | null
}

/**
 * Parses PROCESSING_FAILED::TYPE::CATEGORY into user-friendly text.
 * Handles both new category codes (e.g. TRANSCRIPT_FAILED) and
 * legacy data where CATEGORY may be raw vendor error text.
 */
function parseProcessingError(fullText: string, contentType: string | null): string {
  const parts = fullText.split("::")
  const type = parts[1] || contentType?.toUpperCase() || "CONTENT"
  const category = parts[2] || "UNKNOWN"

  const typeLabel: Record<string, string> = {
    YOUTUBE: "video",
    ARTICLE: "article",
    PODCAST: "podcast",
    PDF: "document",
    DOCUMENT: "document",
    X_POST: "post",
    TRANSCRIPTION: "podcast",
  }
  const label = typeLabel[type] || "content"

  const messages: Record<string, string> = {
    SCRAPE_FAILED: `We couldn't extract the ${label} content. It may be behind a login or paywall.`,
    TRANSCRIPT_FAILED: `We couldn't retrieve the transcript. The ${label} may not have captions available.`,
    METADATA_FAILED: `We couldn't access this ${label}'s details. It may be private or unavailable.`,
    TRANSCRIPTION_FAILED: `Transcription failed. The audio may be too short or in an unsupported format.`,
    TRANSCRIPTION_EMPTY: `The transcription completed but no speech was detected.`,
    OCR_FAILED: `We couldn't extract text from this document.`,
    AI_ANALYSIS_FAILED: `Our analysis service encountered an error. Please try regenerating.`,
    RATE_LIMITED: `Our service is temporarily busy. Please try again in a few minutes.`,
    TIMEOUT: `Processing took too long. Please try again.`,
    CONTENT_UNAVAILABLE: `This ${label} appears to be unavailable or restricted.`,
    CONTENT_POLICY_VIOLATION: `This content could not be processed due to our content policy.`,
  }

  // Known category → clean message; unknown (legacy raw text) → generic fallback
  return messages[category] || `We couldn't process this ${label}. Please try again.`
}

function ItemDetailPageContent({ contentId, session }: { contentId: string; session: Session }) {
  const itemRouter = useRouter()
  const [item, setItem] = useState<ContentWithSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeMainTab, setActiveMainTab] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("clarus-last-tab") || "summary"
    }
    return "summary"
  })

  // Mobile tab state: "analysis" or "chat"
  const [mobileTab, setMobileTab] = useState<"analysis" | "chat">("analysis")
  // Preserve scroll positions per mobile tab
  const analysisScrollRef = useRef<number>(0)
  const chatScrollRef = useRef<number>(0)
  const mobileContentRef = useRef<HTMLDivElement>(null)

  const handleMobileTabChange = (tab: "analysis" | "chat") => {
    // Save current scroll position
    if (mobileContentRef.current) {
      if (mobileTab === "analysis") {
        analysisScrollRef.current = mobileContentRef.current.scrollTop
      } else {
        chatScrollRef.current = mobileContentRef.current.scrollTop
      }
    }
    setMobileTab(tab)
    // Restore scroll position after render
    requestAnimationFrame(() => {
      if (mobileContentRef.current) {
        mobileContentRef.current.scrollTop = tab === "analysis" ? analysisScrollRef.current : chatScrollRef.current
      }
    })
  }

  const handleTabChange = (tab: string) => {
    setActiveMainTab(tab)
    if (typeof window !== "undefined") {
      localStorage.setItem("clarus-last-tab", tab)
    }
  }
  const [isEditPromptModalOpen, setIsEditPromptModalOpen] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isPdf, setIsPdf] = useState(false)
  const [, setCurrentUserContentRating] = useState<{ signal_score: number } | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isDetailedExpanded, setIsDetailedExpanded] = useState(true)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const youtubePlayerRef = useRef<YouTubePlayerRef>(null)
  const [domainStats, setDomainStats] = useState<{
    total_analyses: number
    avg_quality_score: number | null
    accurate_count: number
    mostly_accurate_count: number
    mixed_count: number
    questionable_count: number
    unreliable_count: number
  } | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<{ tag: string; count: number }[]>([])
  const [newTagInput, setNewTagInput] = useState("")
  const [showTagInput, setShowTagInput] = useState(false)
  const [isAddingTag, setIsAddingTag] = useState(false)

  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false)
  const [crossReferences, setCrossReferences] = useState<CrossReference[]>([])
  const upgradeModal = useUpgradeModal()
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("apply")

  // Section-level feedback state
  type FeedbackMap = Record<string, boolean | null>
  type ClaimFlagEntry = { claim_index: number; flag_reason: string | null }
  const [sectionFeedback, setSectionFeedback] = useState<FeedbackMap>({})
  const [claimFlags, setClaimFlags] = useState<ClaimFlagEntry[]>([])
  const [highlightedIssueIndex, setHighlightedIssueIndex] = useState(-1)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDesktop = useIsDesktop()
  const { startTracking: startAnalysisTracking, markComplete: markAnalysisComplete, pausePolling, resumePolling } = useActiveAnalysis()

  // Analysis language — read from content record or localStorage
  const [analysisLanguage, setAnalysisLanguage] = useState<AnalysisLanguage>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (saved && ["ar","es","fr","de","pt","ja","ko","zh","it","nl"].includes(saved)) {
        return saved as AnalysisLanguage
      }
    }
    return "en"
  })
  const langConfig = getLanguageConfig(analysisLanguage)
  const [isTranslating, setIsTranslating] = useState(false)
  // PERF: shared SWR hook eliminates duplicate tier query (was independent useEffect+fetch)
  const { features: tierFeatures } = useUserTier(session?.user?.id ?? null)
  const multiLanguageEnabled = tierFeatures.multiLanguageAnalysis
  // Track the language before a translation attempt so we can revert on failure
  const prevLanguageRef = useRef<AnalysisLanguage>(analysisLanguage)

  // Fetch user's analysis mode preference for badge display
  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false
    fetch("/api/preferences")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data?.preferences?.analysis_mode) {
          setAnalysisMode(data.preferences.analysis_mode as AnalysisMode)
        }
      })
      .catch(() => { /* use default */ })
    return () => { cancelled = true }
  }, [session?.user?.id])

  const isContentProcessing = useCallback((content: ContentWithSummary | null): boolean => {
    if (!content) return true
    const hasPlaceholderTitle = content.title?.startsWith("Analyzing:")
    const noFullText = !content.full_text || content.full_text.startsWith("PROCESSING_FAILED::")
    const summaryNotComplete = !content.summary?.processing_status || content.summary.processing_status !== "complete"
    return hasPlaceholderTitle || noFullText || summaryNotComplete
  }, [])

  const handleTimestampClick = useCallback((seconds: number) => {
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(seconds)
    }
  }, [])

  /** Timeline marker click: seek player + scroll to issue + highlight briefly */
  const handleTimelineMarkerClick = useCallback((issueIndex: number, seconds: number) => {
    // Seek the player
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(seconds)
    }
    // Highlight the issue in the truth check card
    setHighlightedIssueIndex(issueIndex)
    // Clear any previous timeout
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    // Auto-clear highlight after 3 seconds
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedIssueIndex(-1)
    }, 3000)
    // Scroll to the issue element
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-issue-index="${issueIndex}"]`)
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [])

  const regenerationCount = item?.regeneration_count ?? 0
  const maxRegenerations = 3

  const handleRegenerate = useCallback(async () => {
    if (!item) return
    if (regenerationCount >= maxRegenerations) {
      toast.error(`Regeneration limit reached (${maxRegenerations}/${maxRegenerations})`)
      return
    }
    setIsRegenerating(true)
    // Snapshot for rollback on failure
    const prevItem = item
    setItem(prev => prev ? { ...prev, summary: null, regeneration_count: (prev.regeneration_count ?? 0) + 1 } : null)

    // Increment regeneration_count in the database
    supabase
      .from("content")
      .update({ regeneration_count: regenerationCount + 1 })
      .eq("id", item.id)
      .then()

    fetch("/api/process-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_id: item.id, force_regenerate: true, language: analysisLanguage }),
    })
      .then(async response => {
        if (!response.ok) throw new Error("Failed to regenerate")
        const data = await response.json().catch(() => ({}))
        // Podcasts return early after submitting transcription — don't show "complete" yet
        if (data.transcriptId) {
          toast.success("Transcription resubmitted — analysis will begin when audio processing completes.")
        } else {
          markAnalysisComplete(item.id, item.title || undefined)
          toast.success("Analysis complete!")
        }
      })
      .catch(() => {
        toast.error("Failed to regenerate content")
        // Restore previous state so the old analysis is still visible
        setItem(prevItem)
      })
      .finally(() => {
        setIsRegenerating(false)
      })

    setIsPolling(true)
  }, [item, regenerationCount, analysisLanguage, markAnalysisComplete])

  const handleToggleBookmark = useCallback(async () => {
    if (!item || isTogglingBookmark) return
    const newState = !isBookmarked
    setIsBookmarked(newState) // Optimistic
    setIsTogglingBookmark(true)
    try {
      const response = await fetch(`/api/content/${item.id}/bookmark`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_bookmarked: newState }),
      })
      const data = await response.json()
      if (!data.success) {
        setIsBookmarked(!newState) // Revert
        if (data.upgrade_required) {
          upgradeModal.showUpgrade({
            feature: "Bookmarks",
            currentTier: data.tier ?? "free",
            currentCount: data.limit,
            limit: data.limit,
          })
        } else {
          toast.error("Failed to update bookmark")
        }
      } else {
        toast.success(newState ? "Added to Reading List" : "Removed from Reading List")
      }
    } catch {
      setIsBookmarked(!newState) // Revert
      toast.error("Failed to update bookmark")
    } finally {
      setIsTogglingBookmark(false)
    }
  }, [item, isBookmarked, isTogglingBookmark, upgradeModal])

  const handleExport = useCallback(async (format: "pdf" | "markdown") => {
    if (!item) return
    try {
      const langParam = analysisLanguage !== "en" ? `&language=${analysisLanguage}` : ""
      const response = await fetch(`/api/export/${format}?id=${item.id}${langParam}`)
      if (response.status === 403) {
        const data = await response.json()
        if (data.upgrade_required) {
          upgradeModal.showUpgrade({
            feature: "Exports",
            currentTier: data.tier ?? "free",
            requiredTier: "starter",
          })
          return
        }
      }
      if (!response.ok) {
        toast.error("Export failed")
        return
      }
      // Download the file
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const ext = format === "pdf" ? "pdf" : "md"
      const safeTitle = (item.title || "report").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50)
      a.download = `clarus-${safeTitle}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Export failed")
    }
  }, [item, upgradeModal, analysisLanguage])

  const handleDelete = useCallback(async () => {
    if (!item || isDeleting) return
    if (!window.confirm(`Delete "${item.title || "this item"}"? This cannot be undone.`)) return
    setIsDeleting(true)
    try {
      const { error: deleteError } = await supabase.from("content").delete().eq("id", item.id)
      if (deleteError) throw deleteError
      toast.success("Item deleted")
      itemRouter.push("/home")
    } catch {
      toast.error("Failed to delete item")
      setIsDeleting(false)
    }
  }, [item, isDeleting, itemRouter])

  const fetchContentData = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true)

    // PERF: FIX-219 — select explicit columns to avoid pulling in unexpected future columns
    const contentColumns = "id, title, url, type, thumbnail_url, date_added, user_id, author, channel_id, description, duration, full_text, is_bookmarked, like_count, raw_youtube_metadata, transcript_languages, upload_date, view_count, tags, share_token, podcast_transcript_id, detected_tone, regeneration_count, analysis_language"
    const summaryColumns = "id, content_id, user_id, model_name, created_at, updated_at, brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, topic_segments, processing_status, language"
    const [contentResult, summaryResult] = await Promise.all([
      supabase.from("content").select(contentColumns).eq("id", contentId).single(),
      supabase.from("summaries").select(summaryColumns).eq("content_id", contentId).eq("language", analysisLanguage).order("created_at", { ascending: false }).limit(1).maybeSingle()
    ])

    if (contentResult.error) {
      setError(contentResult.error.message)
      setLoading(false)
      return null
    }

    const contentData = contentResult.data
    const summaryData = summaryResult.data

    const combinedItem: ContentWithSummary = {
      ...contentData,
      summary: summaryData || null,
    }

    setItem(combinedItem)
    setIsPdf(contentData.url?.endsWith(".pdf") || false)

    if (contentData.full_text?.startsWith("PROCESSING_FAILED::")) {
      setProcessingError(parseProcessingError(contentData.full_text, contentData.type))
    }

    if (showLoadingState) setLoading(false)
    return combinedItem
  }, [contentId, analysisLanguage])

  const pollContentAndUpdate = useCallback(async (): Promise<boolean> => {
    // PERF: FIX-219 — select explicit columns for polling too
    const contentColumns = "id, title, url, type, thumbnail_url, date_added, user_id, author, channel_id, description, duration, full_text, is_bookmarked, like_count, raw_youtube_metadata, transcript_languages, upload_date, view_count, tags, share_token, podcast_transcript_id, detected_tone, regeneration_count, analysis_language"
    const summaryColumns = "id, content_id, user_id, model_name, created_at, updated_at, brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, topic_segments, processing_status, language"
    const [contentResult, summaryResult] = await Promise.all([
      supabase.from("content").select(contentColumns).eq("id", contentId).single(),
      supabase.from("summaries").select(summaryColumns).eq("content_id", contentId).eq("language", analysisLanguage).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ])

    if (!contentResult.data) return true

    const combinedItem: ContentWithSummary = {
      ...contentResult.data,
      summary: summaryResult.data || null,
    }
    setItem(combinedItem)

    const hasPlaceholderTitle = contentResult.data.title?.startsWith("Analyzing:")
    const noFullText = !contentResult.data.full_text || contentResult.data.full_text.startsWith("PROCESSING_FAILED::")
    const summaryNotComplete = !summaryResult.data?.processing_status || summaryResult.data.processing_status !== "complete"

    return hasPlaceholderTitle || noFullText || summaryNotComplete
  }, [contentId, analysisLanguage])

  useEffect(() => {
    const initFetch = async () => {
      const contentPromise = fetchContentData(true)
      const ratingPromise = session?.user?.id
        ? supabase
            .from("content_ratings")
            .select("signal_score")
            .eq("content_id", contentId)
            .eq("user_id", session.user.id)
            .maybeSingle()
        : Promise.resolve({ data: null })
      const [contentData, ratingResult] = await Promise.all([contentPromise, ratingPromise])

      if (ratingResult.data) {
        setCurrentUserContentRating({ signal_score: ratingResult.data.signal_score })
      }

      if (isContentProcessing(contentData)) {
        setIsPolling(true)
        // Ensure global tracking is active for this content
        if (contentData) {
          startAnalysisTracking(contentId, contentData.title || "Processing...", contentData.type)
        }
      } else if (contentData) {
        // Content is already complete — mark it as complete in the global tracker
        markAnalysisComplete(contentId, contentData.title || undefined)
      }
    }

    initFetch()

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [contentId, session?.user?.id, fetchContentData, isContentProcessing, startAnalysisTracking, markAnalysisComplete])

  // Pause global analysis polling while on this page (page has its own polling)
  useEffect(() => {
    pausePolling()
    return () => {
      resumePolling()
    }
  }, [pausePolling, resumePolling])

  useEffect(() => {
    if (!isPolling) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      return
    }

    let pollAttempt = 0
    const pollWithBackoff = async () => {
      const stillProcessing = await pollContentAndUpdate()
      if (!stillProcessing) {
        setIsPolling(false)
        markAnalysisComplete(contentId, item?.title || undefined)
        toast.success("Analysis complete!")
        return
      }
      // Exponential backoff: 1s → 2s → 4s → 8s (cap)
      const delay = Math.min(1000 * Math.pow(2, pollAttempt++), 8000)
      pollingIntervalRef.current = setTimeout(pollWithBackoff, delay) as unknown as NodeJS.Timeout
    }
    pollingIntervalRef.current = setTimeout(pollWithBackoff, 1000) as unknown as NodeJS.Timeout

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && isPolling) {
        const stillProcessing = await pollContentAndUpdate()
        if (!stillProcessing) {
          setIsPolling(false)
          markAnalysisComplete(contentId, item?.title || undefined)
          toast.success("Analysis complete!")
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Podcasts need longer timeout (transcription + analysis can take 5+ min)
    const isPodcast = item?.type === "podcast"
    const isTranscribing = item?.summary?.processing_status === "transcribing"
    const maxTimeout = (isPodcast || isTranscribing) ? 600000 : 180000 // 10 min for podcasts, 3 min for others

    const maxPollingTimeout = setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
        setIsPolling(false)
        // Show a user-facing message instead of silently stopping
        if (isPodcast || isTranscribing) {
          toast.info("Transcription is still processing. Refresh the page later or click Retry.", { duration: 8000 })
        } else {
          toast.info("Analysis is taking longer than expected. Refresh the page to check progress.", { duration: 6000 })
        }
      }
    }, maxTimeout)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      clearTimeout(maxPollingTimeout)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [isPolling, pollContentAndUpdate, item?.type, item?.title, item?.summary?.processing_status, contentId, markAnalysisComplete])

  useEffect(() => {
    const fetchDomainStats = async () => {
      if (!item?.url) return
      const domain = getDomainFromUrl(item.url)
      if (!domain) return

      const { data } = await supabase
        .from("domains")
        .select("total_analyses, avg_quality_score, accurate_count, mostly_accurate_count, mixed_count, questionable_count, unreliable_count")
        .eq("domain", domain)
        .maybeSingle()

      if (data) setDomainStats(data)
    }
    fetchDomainStats()
  }, [item?.url])

  useEffect(() => {
    if (item) {
      setIsBookmarked(item.is_bookmarked ?? false)
    }
  }, [item])

  useEffect(() => {
    if (item?.tags) {
      setTags(item.tags as string[] || [])
    }
  }, [item?.tags])

  useEffect(() => {
    const fetchAllTags = async () => {
      try {
        const response = await fetch("/api/tags")
        const data = await response.json()
        if (data.success) setAllTags(data.tags)
      } catch {}
    }
    fetchAllTags()
  }, [])

  // Fetch cross-references when truth_check is available
  const hasTruthCheck = Boolean(item?.summary?.truth_check)
  useEffect(() => {
    if (!hasTruthCheck || !item?.id) return
    const fetchCrossRefs = async () => {
      try {
        const response = await fetch(`/api/content/${item.id}/cross-references`)
        const data = await response.json()
        if (data.success && data.crossReferences) {
          setCrossReferences(data.crossReferences)
        }
      } catch {
        // Non-fatal — cross-references are supplementary
      }
    }
    fetchCrossRefs()
  }, [item?.id, hasTruthCheck])

  // Fetch user's section feedback for this content
  useEffect(() => {
    if (!session?.user?.id || !contentId) return
    let cancelled = false
    fetch(`/api/feedback?content_id=${contentId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data?.feedback) return
        const feedbackMap: FeedbackMap = {}
        const flags: ClaimFlagEntry[] = []
        for (const fb of data.feedback) {
          if (fb.claim_index !== null && fb.claim_index >= 0) {
            flags.push({ claim_index: fb.claim_index, flag_reason: fb.flag_reason })
          } else {
            feedbackMap[fb.section_type] = fb.is_helpful
          }
        }
        setSectionFeedback(feedbackMap)
        setClaimFlags(flags)
      })
      .catch(() => { /* non-fatal */ })
    return () => { cancelled = true }
  }, [contentId, session?.user?.id])

  // Handle flagging a truth check claim as inaccurate
  const handleFlagClaim = useCallback(async (claimIndex: number) => {
    if (!contentId) return
    const alreadyFlagged = claimFlags.some(f => f.claim_index === claimIndex)
    // Optimistic toggle
    if (alreadyFlagged) {
      setClaimFlags(prev => prev.filter(f => f.claim_index !== claimIndex))
    } else {
      setClaimFlags(prev => [...prev, { claim_index: claimIndex, flag_reason: null }])
    }
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_id: contentId,
          section_type: "accuracy",
          is_helpful: alreadyFlagged ? null : false,
          claim_index: claimIndex,
        }),
      })
      if (!res.ok) {
        // Revert
        if (alreadyFlagged) {
          setClaimFlags(prev => [...prev, { claim_index: claimIndex, flag_reason: null }])
        } else {
          setClaimFlags(prev => prev.filter(f => f.claim_index !== claimIndex))
        }
        toast.error("Failed to save flag")
        return
      }
      toast.success(alreadyFlagged ? "Flag removed" : "Flagged as inaccurate", { duration: 2000 })
    } catch {
      toast.error("Failed to save flag")
    }
  }, [contentId, claimFlags])

  // PERF: tier fetching moved to useUserTier hook (shared SWR cache)

  // Handle language change — fetch existing translation or trigger new one
  const handleLanguageChange = useCallback(async (newLang: AnalysisLanguage) => {
    if (newLang === analysisLanguage || !item) return

    prevLanguageRef.current = analysisLanguage
    setAnalysisLanguage(newLang)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang)

    // Check if a completed summary already exists for the target language
    const { data: existingSummary } = await supabase
      .from("summaries")
      .select("id, content_id, user_id, model_name, created_at, updated_at, brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, topic_segments, processing_status, language")
      .eq("content_id", item.id)
      .eq("language", newLang)
      .maybeSingle()

    if (existingSummary?.processing_status === "complete") {
      setItem(prev => prev ? { ...prev, summary: existingSummary } : null)
      return
    }

    // No summary in target language — call the translate API
    setIsTranslating(true)
    try {
      const res = await fetch(`/api/content/${item.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.upgrade_required) {
          toast.error("Multi-language requires Starter plan or higher")
        } else {
          toast.error(data.error || "Translation failed")
        }
        // Revert language
        setAnalysisLanguage(prevLanguageRef.current)
        localStorage.setItem(LANGUAGE_STORAGE_KEY, prevLanguageRef.current)
        return
      }

      const translated = await res.json()
      setItem(prev => prev ? { ...prev, summary: translated } : null)
      const langName = getLanguageConfig(newLang).name
      toast.success(`Translated to ${langName}`)
    } catch {
      toast.error("Translation failed. Please try again.")
      setAnalysisLanguage(prevLanguageRef.current)
      localStorage.setItem(LANGUAGE_STORAGE_KEY, prevLanguageRef.current)
    } finally {
      setIsTranslating(false)
    }
  }, [item, analysisLanguage])

  const handleAddTag = async (tagToAdd: string) => {
    if (!item || !tagToAdd.trim()) return
    const sanitizedTag = tagToAdd.trim().toLowerCase()
    if (tags.includes(sanitizedTag)) {
      setNewTagInput("")
      setShowTagInput(false)
      return
    }
    setIsAddingTag(true)
    try {
      const response = await fetch(`/api/content/${item.id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", tag: sanitizedTag }),
      })
      const data = await response.json()
      if (data.success) {
        setTags(data.data.tags)
        setNewTagInput("")
        setShowTagInput(false)
        toast.success(`Tag "${sanitizedTag}" added`)
      } else {
        toast.error(data.error || "Failed to add tag")
      }
    } catch {
      toast.error("Failed to add tag")
    } finally {
      setIsAddingTag(false)
    }
  }

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!item) return
    try {
      const response = await fetch(`/api/content/${item.id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", tag: tagToRemove }),
      })
      const data = await response.json()
      if (data.success) {
        setTags(data.data.tags)
        toast.success(`Tag "${tagToRemove}" removed`)
      } else {
        toast.error(data.error || "Failed to remove tag")
      }
    } catch {
      toast.error("Failed to remove tag")
    }
  }

  const tagSuggestions = allTags
    .filter(({ tag }) => !tags.includes(tag) && tag.includes(newTagInput.toLowerCase()))
    .slice(0, 5)

  if (loading) {
    return (
      <div role="status" className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
        <p className="ml-2 text-white/60 text-sm">Loading...</p>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-lg font-medium text-white mb-4">{error || "Item not found"}</h2>
          <Link href="/home" className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white transition-all mx-auto">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  const displayDomain = getDomainFromUrl(item.url)
  const displaySavedAt = item.date_added
    ? formatDistanceToNow(new Date(item.date_added), { addSuffix: true })
    : "unknown"
  const displayDuration = item.type === "youtube" ? formatDuration(item.duration) : null
  const videoId = item.type === "youtube" ? getYouTubeVideoId(item.url) : null
  const summary = item.summary

  // Extract content category from triage data
  const triageData = summary?.triage as unknown as TriageData | null
  const contentCategory = triageData?.content_category as ContentCategory | undefined

  // Paywall detection — warn if content appears truncated
  const paywallWarning = item.full_text && !item.full_text.startsWith("PROCESSING_FAILED::")
    ? detectPaywallTruncation(item.url, item.full_text, item.type || "article")
    : null

  // Analysis staleness warning — old analyses may be outdated
  const analysisAgeDays = summary?.created_at
    ? Math.floor((Date.now() - new Date(summary.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isAnalysisStale = analysisAgeDays !== null && analysisAgeDays > 7
  const isAnalysisVeryStale = analysisAgeDays !== null && analysisAgeDays > 30

  // Analysis cards content (shared between desktop right panel and mobile analysis tab)
  const analysisContent = (
    <ItemAnalysis
      summary={summary ?? null}
      contentId={contentId}
      contentType={item?.type ?? null}
      dir={langConfig.dir}
      isPolling={isPolling}
      isRegenerating={isRegenerating}
      isTranslating={isTranslating}
      isDetailedExpanded={isDetailedExpanded}
      loading={loading}
      analysisLanguageName={getLanguageConfig(analysisLanguage).name}
      paywallWarning={paywallWarning}
      processingError={processingError}
      isAnalysisStale={isAnalysisStale}
      isAnalysisVeryStale={isAnalysisVeryStale}
      analysisAgeDays={analysisAgeDays}
      sectionFeedback={sectionFeedback}
      crossReferences={crossReferences}
      claimFlags={claimFlags}
      highlightedIssueIndex={highlightedIssueIndex}
      youtubePlayerRef={youtubePlayerRef}
      hasFullText={Boolean(item?.full_text)}
      fullTextFailed={Boolean(item?.full_text?.startsWith("PROCESSING_FAILED::"))}
      contentDateAdded={item?.date_added ?? null}
      onRegenerate={handleRegenerate}
      onToggleDetailedExpanded={() => setIsDetailedExpanded(!isDetailedExpanded)}
      onFlagClaim={handleFlagClaim}
    />
  )

  // Full text tab content
  const fullTextContent = (
    <FullTextContent
      loading={loading}
      fullText={item.full_text}
      isPolling={isPolling}
      summary={summary ?? null}
      type={item.type}
      videoId={videoId}
      youtubePlayerRef={youtubePlayerRef}
      onTimestampClick={handleTimestampClick}
    />
  )

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Secondary nav bar */}
      <div className="bg-black/90 backdrop-blur-xl border-b border-white/[0.08] fixed sm:sticky top-0 sm:top-16 left-0 right-0 sm:left-auto sm:right-auto z-20">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-1 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Left side: Back button + Tab switcher (desktop: Summary/Full Text, mobile: Analysis/Chat) */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => itemRouter.back()}
                      className="h-10 w-10 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white border border-white/[0.08] inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-brand/50 active:scale-95 transition-all"
                      aria-label="Go back"
                    >
                      <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Go back</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Desktop: Summary/Full Text tabs + Regenerate */}
              {isDesktop && (
                <>
                  <div className="flex items-center gap-0.5 sm:gap-1 bg-white/[0.06] backdrop-blur-xl p-0.5 sm:p-1 rounded-full border border-white/[0.08]">
                    <button
                      onClick={() => handleTabChange("summary")}
                      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                      className={`px-3 sm:px-5 py-1 sm:py-2 text-[0.625rem] sm:text-sm font-medium rounded-full cursor-pointer transition-all duration-200 ${
                        activeMainTab === "summary"
                          ? "bg-brand text-white shadow-md shadow-blue-500/25"
                          : "text-gray-400 hover:text-white hover:bg-white/[0.04] active:bg-white/[0.08]"
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => handleTabChange("fulltext")}
                      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                      className={`px-3 sm:px-5 py-1 sm:py-2 text-[0.625rem] sm:text-sm font-medium rounded-full cursor-pointer transition-all duration-200 whitespace-nowrap ${
                        activeMainTab === "fulltext"
                          ? "bg-brand text-white shadow-md shadow-blue-500/25"
                          : "text-gray-400 hover:text-white hover:bg-white/[0.04] active:bg-white/[0.08]"
                      }`}
                    >
                      Full Text
                    </button>
                  </div>

                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleRegenerate()}
                          disabled={isRegenerating || regenerationCount >= maxRegenerations}
                          className={`h-9 px-3 flex items-center gap-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-50 ${
                            regenerationCount >= maxRegenerations
                              ? "bg-white/[0.04] text-white/50 border border-white/[0.06] cursor-not-allowed"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 hover:text-blue-200"
                          }`}
                        >
                          {isRegenerating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          <span>Regenerate</span>
                          <span className="text-[0.625rem] opacity-60">{regenerationCount}/{maxRegenerations}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {regenerationCount >= maxRegenerations
                          ? `Regeneration limit reached (${maxRegenerations}/${maxRegenerations})`
                          : `${maxRegenerations - regenerationCount} regeneration${maxRegenerations - regenerationCount === 1 ? "" : "s"} remaining`}
                      </TooltipContent>
                    </Tooltip>

                  </TooltipProvider>

                  <div className="relative">
                    <LanguageSelector
                      value={analysisLanguage}
                      onValueChange={handleLanguageChange}
                      multiLanguageEnabled={multiLanguageEnabled}
                      disabled={isTranslating || isPolling || isRegenerating}
                      dropdownDirection="down"
                    />
                    {isTranslating && (
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 whitespace-nowrap">
                        <Loader2 className="w-3 h-3 text-brand animate-spin" />
                        <span className="text-[0.625rem] text-white/50">Translating...</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Mobile: Analysis/Chat tab switcher */}
              {!isDesktop && !isPdf && (
                <div role="tablist" aria-label="Content view" className="flex items-center gap-0.5 bg-white/[0.06] backdrop-blur-xl p-0.5 rounded-full border border-white/[0.08] md:max-w-xs md:mx-auto">
                  <button
                    role="tab"
                    aria-selected={mobileTab === "analysis"}
                    onClick={() => handleMobileTabChange("analysis")}
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                    className={`px-3 py-1 text-[0.625rem] font-medium rounded-full cursor-pointer transition-all duration-200 ${
                      mobileTab === "analysis"
                        ? "bg-brand text-white shadow-md shadow-blue-500/25"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04] active:bg-white/[0.08]"
                    }`}
                  >
                    Analysis
                  </button>
                  <button
                    role="tab"
                    aria-selected={mobileTab === "chat"}
                    onClick={() => handleMobileTabChange("chat")}
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                    className={`px-3 py-1 text-[0.625rem] font-medium rounded-full cursor-pointer transition-all duration-200 flex items-center gap-1 ${
                      mobileTab === "chat"
                        ? "bg-brand text-white shadow-md shadow-blue-500/25"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04] active:bg-white/[0.08]"
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    Chat
                  </button>
                </div>
              )}
            </div>

            {/* Right side: action buttons (mobile only) */}
            <div className="flex sm:hidden items-center gap-1">
              <button
                onClick={handleToggleBookmark}
                disabled={isTogglingBookmark}
                className={`h-9 w-9 flex items-center justify-center rounded-lg transition-all disabled:opacity-50 active:scale-95 ${
                  isBookmarked
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-white/[0.06] text-white/50 border border-white/[0.1]"
                }`}
                aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
              >
                {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>

              <LanguageSelector
                value={analysisLanguage}
                onValueChange={handleLanguageChange}
                multiLanguageEnabled={multiLanguageEnabled}
                disabled={isTranslating || isPolling || isRegenerating}
                compact
                dropdownDirection="down"
              />

              {/* Overflow menu — all secondary actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.06] text-white/50 border border-white/[0.1] active:bg-white/[0.12] active:scale-95 transition-all"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-52 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/50 rounded-xl p-1.5 shadow-2xl">
                  <DropdownMenuItem
                    onClick={() => setIsShareModalOpen(true)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <Mail className="h-4 w-4" />
                    <span>Share</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleExport("pdf")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-purple-300 hover:bg-purple-500/10"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleExport("markdown")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-purple-300 hover:bg-purple-500/10"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Export Markdown</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleRegenerate()}
                    disabled={isRegenerating || regenerationCount >= maxRegenerations}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-blue-300 hover:bg-blue-500/10 disabled:opacity-40"
                  >
                    {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span>Regenerate</span>
                    <span className="ml-auto text-[0.625rem] text-white/50">{regenerationCount}/{maxRegenerations}</span>
                  </DropdownMenuItem>
                  <div className="my-1 border-t border-white/[0.08]" />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-red-400 hover:bg-red-500/10"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for fixed nav bar on mobile */}
      <div className="h-[48px] sm:hidden" />

      <main id="main-content" className="max-w-7xl mx-auto lg:px-6 py-2 sm:py-6 lg:py-8 flex-1 pb-20 sm:pb-24">
        {/* PDF: Full-width layout */}
        {isPdf ? (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3 sm:mb-4">
              {item.title || "Processing Title..."}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-6">
              <span className="px-2 py-1 rounded-lg bg-white/[0.04]">{displayDomain}</span>
              <span className="px-2 py-1 rounded-lg bg-white/[0.04] flex items-center gap-1">
                <FileText className="w-3 h-3" />
                PDF
              </span>
              <span className="px-2 py-1 rounded-lg bg-white/[0.04]">Analyzed {displaySavedAt}</span>
            </div>
            {item.full_text && (
              <iframe
                src={item.url}
                title={item.title || "PDF Document"}
                className="w-full h-[70vh] border-none rounded-2xl bg-white"
              />
            )}
          </div>
        ) : (
          <>
          {/* MOBILE ONLY: Fixed video player below nav bar */}
          {!isDesktop && (
            <div className="fixed top-[48px] left-0 right-0 z-10 bg-black">
              <div className="bg-black w-full">
                {item.type === "youtube" && videoId ? (
                  <YouTubePlayer
                    ref={youtubePlayerRef}
                    videoId={videoId}
                  />
                ) : item.thumbnail_url ? (
                  <Image
                    src={item.thumbnail_url}
                    alt={item.title || "Content image"}
                    width={420}
                    height={236}
                    sizes="100vw"
                    priority
                    className="w-full h-auto aspect-video object-cover"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                ) : (
                  <div className="aspect-video w-full bg-white/[0.03] flex items-center justify-center">
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-white/50 mx-auto mb-2" />
                      <p className="text-white/50 text-sm">{displayDomain}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Spacer for fixed video on mobile */}
          {!isDesktop && <div className="w-full mt-2" style={{ paddingBottom: "56.25%" }} />}

          {/* MOBILE: Claim Timeline below player spacer */}
          {!isDesktop && (item.type === "youtube" || item.type === "podcast") && item.duration && summary?.truth_check && (summary.truth_check as unknown as TruthCheckData).issues?.length > 0 && (
            <div className="px-3 md:px-6 mb-2">
              <ClaimTimeline
                duration={item.duration}
                issues={(summary.truth_check as unknown as TruthCheckData).issues}
                onMarkerClick={handleTimelineMarkerClick}
                highlightedIndex={highlightedIssueIndex}
              />
            </div>
          )}

          {/* MOBILE: Tab content (Analysis or Chat) */}
          {!isDesktop && (
            <div ref={mobileContentRef} className="px-3 md:px-6">
              {mobileTab === "analysis" ? (
                <>
                  {/* Mobile content info */}
                  <ContentInfoCard
                    title={item.title}
                    displayDomain={displayDomain}
                    author={item.author}
                    type={item.type}
                    displayDuration={displayDuration}
                    displaySavedAt={displaySavedAt}
                    analysisMode={analysisMode}
                    className="md:p-4 mb-4 md:max-w-2xl md:mx-auto"
                  />

                  {/* Subscribe to channel/podcast prompt */}
                  {(item.type === "youtube" || item.type === "podcast") && session?.user?.id && (
                    <SubscribePrompt
                      contentType={item.type as "youtube" | "podcast"}
                      contentUrl={item.url}
                      channelId={item.channel_id}
                      authorName={item.author}
                      userId={session.user.id}
                      className="mb-4"
                    />
                  )}

                  {/* Summary/Full Text sub-tabs for mobile analysis */}
                  <div className="flex items-center gap-0.5 bg-white/[0.06] backdrop-blur-xl p-0.5 rounded-full border border-white/[0.08] mb-4 w-fit">
                    <button
                      onClick={() => handleTabChange("summary")}
                      className={`px-3 py-1 text-[0.625rem] font-medium rounded-full cursor-pointer transition-all duration-200 ${
                        activeMainTab === "summary"
                          ? "bg-white/[0.12] text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => handleTabChange("fulltext")}
                      className={`px-3 py-1 text-[0.625rem] font-medium rounded-full cursor-pointer transition-all duration-200 whitespace-nowrap ${
                        activeMainTab === "fulltext"
                          ? "bg-white/[0.12] text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Full Text
                    </button>
                  </div>

                  {activeMainTab === "summary" ? analysisContent : fullTextContent}
                </>
              ) : (
                /* Mobile Chat Tab */
                <div className="flex flex-col" style={{ minHeight: "calc(100vh - 56.25vw - 120px)" }}>
                  <InlineChat
                    contentId={item.id}
                    session={session}
                    contentType={item.type}
                    contentCategory={contentCategory}
                  />
                </div>
              )}
            </div>
          )}

          {/* DESKTOP: Split-screen layout */}
          {isDesktop && (
            <div className="lg:flex lg:gap-8 min-w-0 lg:h-[calc(100vh-100px)]">
              {/* LEFT PANEL */}
              <aside className="w-full lg:w-[480px] lg:flex-shrink-0 mb-4 lg:mb-0 min-w-0 lg:overflow-y-auto subtle-scrollbar">
                {/* Video or Thumbnail */}
                <div className="mb-3">
                  <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-black w-full">
                    {item.type === "youtube" && videoId ? (
                      <YouTubePlayer
                        ref={youtubePlayerRef}
                        videoId={videoId}
                      />
                    ) : item.thumbnail_url ? (
                      <Image
                        src={item.thumbnail_url}
                        alt={item.title || "Content image"}
                        width={420}
                        height={236}
                        sizes="480px"
                        priority
                        className="w-full h-auto aspect-video object-cover"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    ) : (
                      <div className="aspect-video w-full bg-white/[0.03] flex items-center justify-center">
                        <div className="text-center">
                          <FileText className="w-12 h-12 text-white/50 mx-auto mb-2" />
                          <p className="text-white/50 text-sm">{displayDomain}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Claim Timeline — shows accuracy issue markers along the content timeline */}
                  {(item.type === "youtube" || item.type === "podcast") && item.duration && summary?.truth_check && (summary.truth_check as unknown as TruthCheckData).issues?.length > 0 && (
                    <div className="mt-1 px-1">
                      <ClaimTimeline
                        duration={item.duration}
                        issues={(summary.truth_check as unknown as TruthCheckData).issues}
                        onMarkerClick={handleTimelineMarkerClick}
                        highlightedIndex={highlightedIssueIndex}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2 sm:space-y-4">
                  {/* Content info card */}
                  <ContentInfoCard
                    title={item.title}
                    displayDomain={displayDomain}
                    author={item.author}
                    type={item.type}
                    displayDuration={displayDuration}
                    displaySavedAt={displaySavedAt}
                    analysisMode={analysisMode}
                    className="mx-3 sm:mx-4 lg:mx-0"
                  />

                  {/* Subscribe to channel/podcast prompt */}
                  {(item.type === "youtube" || item.type === "podcast") && session?.user?.id && (
                    <SubscribePrompt
                      contentType={item.type as "youtube" | "podcast"}
                      contentUrl={item.url}
                      channelId={item.channel_id}
                      authorName={item.author}
                      userId={session.user.id}
                      className="mx-3 sm:mx-4 lg:mx-0"
                    />
                  )}

                  {/* Tags Management */}
                  <div className="hidden sm:block sm:mx-4 lg:mx-0">
                    <TagsManager
                      tags={tags}
                      showTagInput={showTagInput}
                      setShowTagInput={setShowTagInput}
                      newTagInput={newTagInput}
                      setNewTagInput={setNewTagInput}
                      handleAddTag={handleAddTag}
                      handleRemoveTag={handleRemoveTag}
                      isAddingTag={isAddingTag}
                      tagSuggestions={tagSuggestions}
                      variant="desktop"
                    />
                  </div>

                  {/* Source History */}
                  {domainStats && (
                    <div className="hidden sm:block">
                      <SourceHistoryCard domainStats={domainStats} displayDomain={displayDomain} />
                    </div>
                  )}

                  {/* Action buttons — pill-shaped with labels */}
                  <div className="hidden sm:flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleToggleBookmark}
                      disabled={isTogglingBookmark}
                      className={cn(
                        "h-8 px-3 flex items-center gap-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-50 active:scale-[0.97]",
                        isBookmarked
                          ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/25"
                          : "bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white border border-white/[0.08]"
                      )}
                    >
                      {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                      {isBookmarked ? "Saved" : "Save"}
                    </button>

                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      className="h-8 px-3 flex items-center gap-1.5 rounded-full text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white border border-white/[0.08] active:scale-[0.97] transition-all"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Share
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 px-3 flex items-center gap-1.5 rounded-full text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white border border-white/[0.08] active:scale-[0.97] transition-all">
                          <Download className="w-3.5 h-3.5" />
                          Export
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="bg-[#1a1a1a] border-white/10">
                        <DropdownMenuItem
                          onClick={() => handleExport("pdf")}
                          className="cursor-pointer hover:bg-white/10 text-white/80"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          PDF Report
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleExport("markdown")}
                          className="cursor-pointer hover:bg-white/10 text-white/80"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Markdown
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="h-8 px-3 flex items-center gap-1.5 rounded-full text-xs font-medium bg-white/[0.04] hover:bg-red-500/15 text-white/50 hover:text-red-400 border border-white/[0.08] hover:border-red-500/25 active:scale-[0.97] transition-all disabled:opacity-50"
                    >
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete
                    </button>
                  </div>

                  {/* INLINE CHAT - Desktop left panel */}
                  <div className="lg:mx-0">
                    <InlineChat
                      contentId={item.id}
                      session={session}
                      contentType={item.type}
                      contentCategory={contentCategory}
                    />
                  </div>
                </div>
              </aside>

              {/* RIGHT PANEL */}
              <div className="flex-1 min-w-0 lg:overflow-y-auto lg:pr-2 px-3 sm:px-4 lg:px-0 subtle-scrollbar">
                {activeMainTab === "summary" ? analysisContent : fullTextContent}
              </div>
            </div>
          )}
          </>
        )}

        {/* Mobile-only: Tags and Source History at bottom of analysis tab */}
        {!isPdf && !isDesktop && mobileTab === "analysis" && (
          <div className="px-3 space-y-4 mt-6">
            <TagsManager
              tags={tags}
              showTagInput={showTagInput}
              setShowTagInput={setShowTagInput}
              newTagInput={newTagInput}
              setNewTagInput={setNewTagInput}
              handleAddTag={handleAddTag}
              handleRemoveTag={handleRemoveTag}
              isAddingTag={isAddingTag}
              tagSuggestions={tagSuggestions}
              variant="mobile"
            />

            {domainStats && (
              <SourceHistoryCard domainStats={domainStats} displayDomain={displayDomain} />
            )}
          </div>
        )}
      </main>

      <EditAIPromptsModal isOpen={isEditPromptModalOpen} onOpenChange={setIsEditPromptModalOpen} />
      <ShareModal
        isOpen={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        contentTitle={item.title || "Content Analysis"}
        contentUrl={item.url}
        briefOverview={summary?.brief_overview || undefined}
        contentId={item.id}
      />
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={upgradeModal.close}
        feature={upgradeModal.feature}
        currentTier={upgradeModal.currentTier}
        requiredTier={upgradeModal.requiredTier}
        currentCount={upgradeModal.currentCount}
        limit={upgradeModal.limit}
      />

    </div>
  )
}

export default function ItemPage({ params }: PageProps) {
  const { id: contentId } = use(params)
  const cached = getCachedSession()
  const [session, setSession] = useState<Session | null>(cached.session)
  const [loading, setLoading] = useState(!cached.initialized)
  const router = useRouter()

  useEffect(() => {
    // If cache is already initialized, trust it — no remote fetch needed
    if (cached.initialized) {
      setSession(cached.session)
      setLoading(false)
    }

    // Listen for auth state changes (handles sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    // Only fetch remotely if cache wasn't initialized
    if (!cached.initialized) {
      const timeoutId = setTimeout(() => {
        setSession(null)
        setLoading(false)
      }, 5000)

      supabase.auth.getSession().then(({ data: { session } }) => {
        clearTimeout(timeoutId)
        setSession(session)
        setLoading(false)
      }).catch(() => {
        clearTimeout(timeoutId)
        setSession(null)
        setLoading(false)
      })
    }

    return () => {
      subscription.unsubscribe()
    }
  }, [cached.initialized, cached.session])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    )
  }

  if (!session) {
    router.push("/login")
    return null
  }

  return <ItemDetailPageContent contentId={contentId} session={session} />
}

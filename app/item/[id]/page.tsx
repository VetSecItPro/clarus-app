"use client"
import Link from "next/link"
import Image from "next/image"
import dynamic from "next/dynamic"
import { ArrowLeft, Play, Loader2, FileText, Sparkles, ChevronDown, Eye, Shield, Lightbulb, BookOpen, Target, Mail, RefreshCw, Tag, Plus, X, Download, MessageSquare, Bookmark, BookmarkCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useCallback, useRef, use } from "react"
import { supabase } from "@/lib/supabase"
import type { Tables, TriageData, TruthCheckData, ActionItemsData, ContentCategory } from "@/types/database.types"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import { getCachedSession } from "@/components/with-auth"
import { formatDuration, getYouTubeVideoId, getDomainFromUrl } from "@/lib/utils"
import { detectPaywallTruncation } from "@/lib/paywall-detection"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/ui/youtube-player"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { SectionCard, SectionSkeleton } from "@/components/ui/section-card"
import { TriageCard } from "@/components/ui/triage-card"
import { TruthCheckCard, type CrossReference } from "@/components/ui/truth-check-card"
import { ActionItemsCard } from "@/components/ui/action-items-card"
import { AnalysisProgress } from "@/components/ui/analysis-progress"
import SiteHeader from "@/components/site-header"
import MobileBottomNav from "@/components/mobile-bottom-nav"
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
import { normalizeTier, TIER_FEATURES } from "@/lib/tier-limits"
import { useActiveAnalysis } from "@/lib/contexts/active-analysis-context"

// Dynamic imports for below-fold and conditional components (reduces initial bundle)
const InlineChat = dynamic(() => import("@/components/inline-chat").then(m => ({ default: m.InlineChat })), { ssr: false })
const ShareModal = dynamic(() => import("@/components/share-modal").then(m => ({ default: m.ShareModal })), { ssr: false })
const UpgradeModal = dynamic(() => import("@/components/upgrade-modal").then(m => ({ default: m.UpgradeModal })), { ssr: false })
const EditAIPromptsModal = dynamic(() => import("@/components/edit-ai-prompts-modal").then(m => ({ default: m.EditAIPromptsModal })), { ssr: false })
const TranscriptViewer = dynamic(() => import("@/components/ui/transcript-viewer").then(m => ({ default: m.TranscriptViewer })), { ssr: false })
const HighlightedTranscript = dynamic(() => import("@/components/ui/highlighted-transcript").then(m => ({ default: m.HighlightedTranscript })), { ssr: false })

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
  const [item, setItem] = useState<ContentWithSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  const [multiLanguageEnabled, setMultiLanguageEnabled] = useState(false)
  // Track the language before a translation attempt so we can revert on failure
  const prevLanguageRef = useRef<AnalysisLanguage>(analysisLanguage)

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

  const regenerationCount = item?.regeneration_count ?? 0
  const maxRegenerations = 3

  const handleRegenerate = useCallback(async () => {
    if (!item) return
    if (regenerationCount >= maxRegenerations) {
      toast.error(`Regeneration limit reached (${maxRegenerations}/${maxRegenerations})`)
      return
    }
    setIsRegenerating(true)
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
      .then(response => {
        if (!response.ok) throw new Error("Failed to regenerate")
        markAnalysisComplete(item.id, item.title || undefined)
        toast.success("Analysis complete!")
      })
      .catch(() => {
        toast.error("Failed to regenerate content")
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

  const fetchContentData = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true)

    // PERF: FIX-219 — select explicit columns to avoid pulling in unexpected future columns
    const contentColumns = "id, title, url, type, thumbnail_url, date_added, user_id, author, channel_id, description, duration, full_text, is_bookmarked, like_count, raw_youtube_metadata, transcript_languages, upload_date, view_count, tags, share_token, podcast_transcript_id, detected_tone, regeneration_count, analysis_language"
    const summaryColumns = "id, content_id, user_id, model_name, created_at, updated_at, brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, processing_status, language"
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
    const summaryColumns = "id, content_id, user_id, model_name, created_at, updated_at, brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, processing_status, language"
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

  // Fetch user tier on mount to determine multi-language access
  useEffect(() => {
    if (!session?.user?.id) return
    const fetchTier = async () => {
      const { data } = await supabase
        .from("users")
        .select("tier, day_pass_expires_at")
        .eq("id", session.user.id)
        .single()
      if (data) {
        const tier = normalizeTier(data.tier, data.day_pass_expires_at)
        setMultiLanguageEnabled(TIER_FEATURES[tier].multiLanguageAnalysis)
      }
    }
    fetchTier()
  }, [session?.user?.id])

  // Handle language change — fetch existing translation or trigger new one
  const handleLanguageChange = useCallback(async (newLang: AnalysisLanguage) => {
    if (newLang === analysisLanguage || !item) return

    prevLanguageRef.current = analysisLanguage
    setAnalysisLanguage(newLang)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang)

    // Check if a completed summary already exists for the target language
    const { data: existingSummary } = await supabase
      .from("summaries")
      .select("id, content_id, user_id, model_name, created_at, updated_at, brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, processing_status, language")
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
        <p className="ml-2 text-white/60 text-sm">Loading...</p>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-lg font-medium text-white mb-4">{error || "Item not found"}</h2>
          <Link href="/" className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white transition-all mx-auto">
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

  // Analysis cards content (shared between desktop right panel and mobile analysis tab)
  const analysisContent = (
    <div className="space-y-6 sm:space-y-8" dir={langConfig.dir}>
      {isTranslating && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1d9bf0]/10 border border-[#1d9bf0]/20"
        >
          <Loader2 className="w-4 h-4 text-[#1d9bf0] animate-spin shrink-0" />
          <p className="text-sm text-[#1d9bf0]/80">
            Translating to {getLanguageConfig(analysisLanguage).name}...
          </p>
        </motion.div>
      )}
      <AnalysisProgress
        processingStatus={summary?.processing_status ?? null}
        briefOverview={summary?.brief_overview ?? null}
        triage={summary?.triage ?? null}
        midLengthSummary={summary?.mid_length_summary ?? null}
        truthCheck={summary?.truth_check ?? null}
        actionItems={summary?.action_items ?? null}
        detailedSummary={summary?.detailed_summary ?? null}
        contentType={item?.type ?? null}
        isPolling={isPolling}
      />
      {paywallWarning && !processingError && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start">
          <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-300/80 leading-relaxed">{paywallWarning}</p>
        </div>
      )}
      {processingError ? (
        <div className="p-4 text-center rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
          <h3 className="text-base font-medium text-yellow-300 mb-2">Processing Failed</h3>
          <p className="text-sm text-yellow-300/70 mb-3">We couldn&apos;t retrieve the content from the source.</p>
          <p className="text-xs text-yellow-300/50 mb-4">{processingError}</p>
          <button
            onClick={() => handleRegenerate()}
            disabled={isRegenerating}
            className="px-4 py-2 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 transition-all disabled:opacity-50 text-sm"
          >
            {isRegenerating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Regenerating...
              </span>
            ) : (
              "Try Regenerating"
            )}
          </button>
        </div>
      ) : (
        <>
          {/* 1. OVERVIEW — always visible while polling */}
          <AnimatePresence mode="wait">
            {(summary?.brief_overview || isPolling) && (
              <SectionCard
                title="Overview"
                isLoading={isPolling && !summary?.brief_overview}
                delay={0}
                icon={<Eye className="w-4 h-4" />}
                headerColor="blue"
                minContentHeight="150px"
              >
                {summary?.brief_overview ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-white/90 text-base leading-relaxed"
                  >
                    {summary.brief_overview}
                  </motion.p>
                ) : (
                  <SectionSkeleton lines={6} minHeight="150px" />
                )}
              </SectionCard>
            )}
          </AnimatePresence>

          {/* 2. QUICK ASSESSMENT */}
          <AnimatePresence mode="wait">
            {(summary?.triage || isPolling) && (
              <SectionCard
                title="Quick Assessment"
                isLoading={isPolling && !summary?.triage}
                delay={0.1}
                icon={<Sparkles className="w-4 h-4" />}
                headerColor="amber"
                minContentHeight="350px"
              >
                {summary?.triage ? (
                  <TriageCard triage={summary.triage as unknown as TriageData} />
                ) : (
                  <div className="space-y-4" style={{ minHeight: "350px" }}>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="h-4 w-24 bg-white/[0.08] rounded mb-2 animate-pulse" />
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-16 bg-white/[0.08] rounded-lg animate-pulse" />
                        <div className="flex-1 h-3 bg-white/[0.06] rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="h-4 w-32 bg-white/[0.08] rounded mb-2 animate-pulse" />
                      <div className="h-12 bg-white/[0.06] rounded-lg animate-pulse" />
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="h-4 w-28 bg-white/[0.08] rounded mb-3 animate-pulse" />
                      <div className="flex flex-wrap gap-2">
                        <div className="h-7 w-32 bg-white/[0.06] rounded-full animate-pulse" />
                        <div className="h-7 w-28 bg-white/[0.06] rounded-full animate-pulse" />
                        <div className="h-7 w-36 bg-white/[0.06] rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="h-4 w-32 bg-white/[0.08] rounded mb-2 animate-pulse" />
                      <div className="h-10 bg-white/[0.06] rounded-lg animate-pulse" />
                    </div>
                  </div>
                )}
              </SectionCard>
            )}
          </AnimatePresence>

          {/* 3. KEY TAKEAWAYS */}
          <AnimatePresence mode="wait">
            {(summary?.mid_length_summary || isPolling) && (
              <SectionCard
                title="Key Takeaways"
                isLoading={isPolling && !summary?.mid_length_summary}
                delay={0.15}
                icon={<Lightbulb className="w-4 h-4" />}
                headerColor="cyan"
                minContentHeight="500px"
              >
                {summary?.mid_length_summary ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="prose prose-sm prose-invert max-w-none"
                  >
                    <MarkdownRenderer
                      onTimestampClick={(seconds) => {
                        youtubePlayerRef.current?.seekTo(seconds)
                      }}
                    >{summary.mid_length_summary}</MarkdownRenderer>
                  </motion.div>
                ) : (
                  <SectionSkeleton lines={20} minHeight="500px" />
                )}
              </SectionCard>
            )}
          </AnimatePresence>

          {/* 4. ACCURACY ANALYSIS */}
          <AnimatePresence mode="wait">
            {(summary?.truth_check || isPolling) && (
              <SectionCard
                title="Accuracy Analysis"
                isLoading={isPolling && !summary?.truth_check}
                delay={0.2}
                icon={<Shield className="w-4 h-4" />}
                headerColor="emerald"
                minContentHeight="650px"
              >
                {summary?.truth_check ? (
                  <TruthCheckCard truthCheck={summary.truth_check as unknown as TruthCheckData} crossReferences={crossReferences} />
                ) : (
                  <div className="space-y-4" style={{ minHeight: "650px" }}>
                    <div>
                      <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse mb-2" />
                      <div className="h-6 w-20 bg-white/[0.08] rounded animate-pulse" />
                    </div>
                    <div>
                      <div className="h-3 w-28 bg-white/[0.06] rounded animate-pulse mb-3" />
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="h-5 w-5 bg-white/[0.06] rounded animate-pulse flex-shrink-0" />
                          <div className="flex-1">
                            <div className="h-4 w-full bg-white/[0.06] rounded animate-pulse mb-2" />
                            <div className="h-3 w-4/5 bg-white/[0.04] rounded animate-pulse mb-1" />
                            <div className="h-3 w-32 bg-white/[0.04] rounded animate-pulse" />
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-5 w-5 bg-white/[0.06] rounded animate-pulse flex-shrink-0" />
                          <div className="flex-1">
                            <div className="h-4 w-11/12 bg-white/[0.06] rounded animate-pulse mb-2" />
                            <div className="h-3 w-3/4 bg-white/[0.04] rounded animate-pulse mb-1" />
                            <div className="h-3 w-28 bg-white/[0.04] rounded animate-pulse" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse mb-2" />
                      <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="h-4 w-4 bg-white/[0.04] rounded animate-pulse flex-shrink-0" />
                            <div className={`h-4 bg-white/[0.06] rounded animate-pulse`} style={{ width: `${85 - i * 5}%` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="h-3 w-28 bg-white/[0.06] rounded animate-pulse mb-2" />
                      <div className="h-4 w-full bg-white/[0.06] rounded animate-pulse mb-1" />
                      <div className="h-4 w-4/5 bg-white/[0.06] rounded animate-pulse" />
                    </div>
                  </div>
                )}
              </SectionCard>
            )}
          </AnimatePresence>

          {/* 5. ACTION ITEMS */}
          <AnimatePresence mode="wait">
            {(summary?.action_items || isPolling) && (
              <SectionCard
                title="Action Items"
                isLoading={isPolling && !summary?.action_items}
                delay={0.3}
                icon={<Target className="w-4 h-4" />}
                headerColor="orange"
                minContentHeight="350px"
              >
                {summary?.action_items ? (
                  <ActionItemsCard actionItems={summary.action_items as unknown as ActionItemsData} />
                ) : (
                  <div className="space-y-3" style={{ minHeight: "350px" }}>
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-[80px] bg-white/[0.04] rounded-xl animate-pulse" />
                    ))}
                  </div>
                )}
              </SectionCard>
            )}
          </AnimatePresence>

          {/* No summary prompt — only show when processing is truly complete with no results */}
          {!summary?.brief_overview && !summary?.mid_length_summary && !isPolling && !isRegenerating && !loading && item?.full_text && !item.full_text.startsWith("PROCESSING_FAILED::") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06]"
            >
              <p className="text-white/40 text-sm mb-4">No summary generated yet.</p>
              <button
                onClick={() => handleRegenerate()}
                disabled={isRegenerating}
                className="px-4 py-2 rounded-full bg-[#1d9bf0] text-white text-sm hover:bg-[#1a8cd8] transition-all disabled:opacity-50"
              >
                Generate Summary
              </button>
            </motion.div>
          )}

          {/* 6. DETAILED ANALYSIS */}
          <AnimatePresence mode="wait">
            {(summary?.detailed_summary || isPolling) && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden"
              >
                <div
                  onClick={() => setIsDetailedExpanded(!isDetailedExpanded)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setIsDetailedExpanded(!isDetailedExpanded)}
                  className="w-full px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between text-left hover:bg-violet-500/20 transition-colors bg-violet-500/15 border-b border-violet-500/20 cursor-pointer"
                >
                  <h3 className="text-sm font-semibold text-violet-300 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Detailed Analysis
                    {isPolling && !summary?.detailed_summary && (
                      <Loader2 className="w-4 h-4 text-[#1d9bf0] animate-spin" />
                    )}
                  </h3>
                  {summary?.detailed_summary && (
                    <motion.div
                      animate={{ rotate: isDetailedExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-5 h-5 text-white/50" />
                    </motion.div>
                  )}
                </div>

                <AnimatePresence>
                  {summary?.detailed_summary && isDetailedExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 sm:px-5 py-4 sm:py-5 border-t border-white/[0.06] prose prose-sm prose-invert max-w-none">
                        <MarkdownRenderer
                          onTimestampClick={(seconds) => {
                            youtubePlayerRef.current?.seekTo(seconds)
                          }}
                        >{summary.detailed_summary}</MarkdownRenderer>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!summary?.detailed_summary && isPolling && (
                  <div className="px-4 sm:px-5 py-4 sm:py-5 border-t border-white/[0.06]" style={{ minHeight: "280px" }}>
                    <SectionSkeleton lines={8} minHeight="220px" />
                    <p className="text-white/40 text-xs mt-4 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating detailed analysis...
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )

  // Full text tab content
  const fullTextContent = (
    <div>
      {loading && (
        <div className="flex items-center text-white/40 text-sm">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading full text...
        </div>
      )}
      {!loading && !item.full_text && (
        <div className="space-y-4">
          {isPolling ? (
            <div className="space-y-3 animate-pulse p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="h-4 bg-white/[0.08] rounded-lg w-full" />
              <div className="h-4 bg-white/[0.08] rounded-lg w-11/12" />
              <div className="h-4 bg-white/[0.08] rounded-lg w-full" />
              <div className="h-4 bg-white/[0.08] rounded-lg w-4/5" />
              <div className="h-4 bg-white/[0.08] rounded-lg w-full" />
              <div className="h-4 bg-white/[0.08] rounded-lg w-3/4" />
              <p className="text-white/40 text-xs mt-4 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Fetching content...
              </p>
            </div>
          ) : (
            <div className="flex items-center text-white/40 text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Full text still processing...
            </div>
          )}
        </div>
      )}
      {!loading && item.full_text && (
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          {(() => {
            const truthCheck = summary?.truth_check as TruthCheckData | null
            const claims = truthCheck?.claims || []

            if (claims.length > 0) {
              return (
                <HighlightedTranscript
                  transcript={item.full_text}
                  claims={claims}
                  videoId={videoId || undefined}
                  onTimestampClick={handleTimestampClick}
                />
              )
            }

            if (item.type === "youtube" && videoId) {
              return (
                <TranscriptViewer
                  transcript={item.full_text}
                  videoId={videoId}
                  onTimestampClick={handleTimestampClick}
                />
              )
            }

            if (item.type === "podcast") {
              return (
                <TranscriptViewer
                  transcript={item.full_text}
                />
              )
            }

            return (
              <div className="prose prose-sm prose-invert max-w-none text-white/70 leading-relaxed">
                <MarkdownRenderer
                  onTimestampClick={(seconds) => {
                    youtubePlayerRef.current?.seekTo(seconds)
                  }}
                >{item.full_text}</MarkdownRenderer>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <SiteHeader />

      {/* Secondary nav bar */}
      <div className="bg-black/90 backdrop-blur-xl border-b border-white/[0.08] fixed sm:sticky top-0 sm:top-16 left-0 right-0 sm:left-auto sm:right-auto z-20">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-1 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Left side: Back button + Tab switcher (desktop: Summary/Full Text, mobile: Analysis/Chat) */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.08]"
                        aria-label="Back to home"
                      >
                        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Back to Library</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Desktop: Summary/Full Text tabs + Regenerate + Publish */}
              {isDesktop && (
                <>
                  <div className="flex items-center gap-0.5 sm:gap-1 bg-white/[0.06] backdrop-blur-xl p-0.5 sm:p-1 rounded-full border border-white/[0.08]">
                    <button
                      onClick={() => handleTabChange("summary")}
                      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                      className={`px-3 sm:px-5 py-1 sm:py-2 text-[10px] sm:text-sm font-medium rounded-full cursor-pointer transition-all duration-200 ${
                        activeMainTab === "summary"
                          ? "bg-[#1d9bf0] text-white shadow-md shadow-blue-500/25"
                          : "text-gray-400 hover:text-white hover:bg-white/[0.04] active:bg-white/[0.08]"
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => handleTabChange("fulltext")}
                      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                      className={`px-3 sm:px-5 py-1 sm:py-2 text-[10px] sm:text-sm font-medium rounded-full cursor-pointer transition-all duration-200 whitespace-nowrap ${
                        activeMainTab === "fulltext"
                          ? "bg-[#1d9bf0] text-white shadow-md shadow-blue-500/25"
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
                              ? "bg-white/[0.04] text-white/30 border border-white/[0.06] cursor-not-allowed"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 hover:text-blue-200"
                          }`}
                        >
                          {isRegenerating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          <span>{regenerationCount >= maxRegenerations ? `${maxRegenerations}/${maxRegenerations}` : `Regenerate`}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {regenerationCount >= maxRegenerations
                          ? `Regeneration limit reached (${maxRegenerations}/${maxRegenerations})`
                          : `Re-analyze this content (${regenerationCount}/${maxRegenerations} used)`}
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
                        <Loader2 className="w-3 h-3 text-[#1d9bf0] animate-spin" />
                        <span className="text-[10px] text-white/50">Translating...</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Mobile: Analysis/Chat tab switcher */}
              {!isDesktop && !isPdf && (
                <div className="flex items-center gap-0.5 bg-white/[0.06] backdrop-blur-xl p-0.5 rounded-full border border-white/[0.08]">
                  <button
                    onClick={() => handleMobileTabChange("analysis")}
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                    className={`px-3 py-1 text-[10px] font-medium rounded-full cursor-pointer transition-all duration-200 ${
                      mobileTab === "analysis"
                        ? "bg-[#1d9bf0] text-white shadow-md shadow-blue-500/25"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04] active:bg-white/[0.08]"
                    }`}
                  >
                    Analysis
                  </button>
                  <button
                    onClick={() => handleMobileTabChange("chat")}
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                    className={`px-3 py-1 text-[10px] font-medium rounded-full cursor-pointer transition-all duration-200 flex items-center gap-1 ${
                      mobileTab === "chat"
                        ? "bg-[#1d9bf0] text-white shadow-md shadow-blue-500/25"
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
            <div className="flex sm:hidden items-center gap-1.5">
              <button
                onClick={handleToggleBookmark}
                disabled={isTogglingBookmark}
                className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-50 ${
                  isBookmarked
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-white/[0.06] text-white/50 border border-white/[0.1]"
                }`}
                aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
              >
                {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsShareModalOpen(true)}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 active:bg-emerald-500/30 transition-all"
                aria-label="Share"
              >
                <Mail className="w-4 h-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 active:bg-purple-500/30 transition-all"
                    aria-label="Export"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10">
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

              <LanguageSelector
                value={analysisLanguage}
                onValueChange={handleLanguageChange}
                multiLanguageEnabled={multiLanguageEnabled}
                disabled={isTranslating || isPolling || isRegenerating}
                compact
                dropdownDirection="down"
              />

              <button
                onClick={() => handleRegenerate()}
                disabled={isRegenerating || regenerationCount >= maxRegenerations}
                className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-50 ${
                  regenerationCount >= maxRegenerations
                    ? "bg-white/[0.04] text-white/30 border border-white/[0.06] cursor-not-allowed"
                    : "bg-blue-500/20 text-blue-300 border border-blue-500/30 active:bg-blue-500/30"
                }`}
                aria-label={regenerationCount >= maxRegenerations ? `Regeneration limit reached` : "Regenerate"}
              >
                {isRegenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>

            </div>
          </div>
        </div>
      </div>

      {/* Spacer for fixed nav bar on mobile */}
      <div className="h-[48px] sm:hidden" />

      <main className="max-w-7xl mx-auto lg:px-6 py-2 sm:py-6 lg:py-8 flex-1 pb-20 sm:pb-24">
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
                      <FileText className="w-12 h-12 text-white/20 mx-auto mb-2" />
                      <p className="text-white/30 text-sm">{displayDomain}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Spacer for fixed video on mobile */}
          {!isDesktop && <div className="w-full mt-2" style={{ paddingBottom: "56.25%" }} />}

          {/* MOBILE: Tab content (Analysis or Chat) */}
          {!isDesktop && (
            <div ref={mobileContentRef} className="px-3">
              {mobileTab === "analysis" ? (
                <>
                  {/* Mobile content info */}
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden mb-4">
                    <h1 className="text-base font-semibold text-white leading-tight mb-2 break-words">
                      {item.title || "Processing Title..."}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 overflow-hidden">
                      <span className="px-2 py-1 rounded-lg bg-white/[0.06]">{displayDomain}</span>
                      {item.author && <span className="px-2 py-1 rounded-lg bg-white/[0.06]">{item.author}</span>}
                      <span className="px-2 py-1 rounded-lg bg-white/[0.06] flex items-center gap-1">
                        {item.type === "youtube" ? (
                          <>
                            <Play className="w-3 h-3" />
                            {displayDuration}
                          </>
                        ) : (
                          <>
                            <FileText className="w-3 h-3" />
                            Article
                          </>
                        )}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white/[0.06]">Analyzed {displaySavedAt}</span>
                    </div>
                  </div>

                  {/* Summary/Full Text sub-tabs for mobile analysis */}
                  <div className="flex items-center gap-0.5 bg-white/[0.06] backdrop-blur-xl p-0.5 rounded-full border border-white/[0.08] mb-4 w-fit">
                    <button
                      onClick={() => handleTabChange("summary")}
                      className={`px-3 py-1 text-[10px] font-medium rounded-full cursor-pointer transition-all duration-200 ${
                        activeMainTab === "summary"
                          ? "bg-white/[0.12] text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => handleTabChange("fulltext")}
                      className={`px-3 py-1 text-[10px] font-medium rounded-full cursor-pointer transition-all duration-200 whitespace-nowrap ${
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
                        className="w-full h-auto aspect-video object-cover"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    ) : (
                      <div className="aspect-video w-full bg-white/[0.03] flex items-center justify-center">
                        <div className="text-center">
                          <FileText className="w-12 h-12 text-white/20 mx-auto mb-2" />
                          <p className="text-white/30 text-sm">{displayDomain}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-4">
                  {/* Content info card */}
                  <div className="mx-3 sm:mx-4 lg:mx-0 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                    <h1 className="text-base font-semibold text-white leading-tight mb-2 break-words">
                      {item.title || "Processing Title..."}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 overflow-hidden">
                      <span className="px-2 py-1 rounded-lg bg-white/[0.06]">{displayDomain}</span>
                      {item.author && <span className="px-2 py-1 rounded-lg bg-white/[0.06]">{item.author}</span>}
                      <span className="px-2 py-1 rounded-lg bg-white/[0.06] flex items-center gap-1">
                        {item.type === "youtube" ? (
                          <>
                            <Play className="w-3 h-3" />
                            {displayDuration}
                          </>
                        ) : (
                          <>
                            <FileText className="w-3 h-3" />
                            Article
                          </>
                        )}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white/[0.06]">Analyzed {displaySavedAt}</span>
                    </div>
                  </div>

                  {/* Tags Management */}
                  <div className="hidden sm:block sm:mx-4 lg:mx-0 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Tag className="w-4 h-4 text-purple-400 shrink-0" />
                        <h3 className="text-sm font-semibold text-white truncate">Tags</h3>
                      </div>
                      {!showTagInput && (
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setShowTagInput(true)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-all"
                              >
                                <Plus className="w-3 h-3" />
                                Add
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Add a tag to organize this content</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    {showTagInput && (
                      <div className="relative mb-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newTagInput.trim()) handleAddTag(newTagInput)
                              else if (e.key === "Escape") { setShowTagInput(false); setNewTagInput("") }
                            }}
                            placeholder="Type a tag..."
                            className="flex-1 px-3 py-2 bg-white/[0.06] border border-white/[0.12] rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAddTag(newTagInput)}
                            disabled={!newTagInput.trim() || isAddingTag}
                            className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm transition-all disabled:opacity-50"
                          >
                            {isAddingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                          </button>
                          <button
                            onClick={() => { setShowTagInput(false); setNewTagInput("") }}
                            className="p-2 text-white/40 hover:text-white/60 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {newTagInput && tagSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-12 mt-1 bg-black/95 border border-white/[0.1] rounded-lg shadow-xl z-10 overflow-hidden">
                            {tagSuggestions.map(({ tag, count }) => (
                              <button
                                key={tag}
                                onClick={() => handleAddTag(tag)}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white/[0.06] transition-colors"
                              >
                                <span className="text-white/80 capitalize">{tag}</span>
                                <span className="text-xs text-white/40">{count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        <TooltipProvider delayDuration={300}>
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="group flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300"
                            >
                              <span className="capitalize">{tag}</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleRemoveTag(tag)}
                                    className="opacity-50 hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Remove tag</TooltipContent>
                              </Tooltip>
                            </span>
                          ))}
                        </TooltipProvider>
                      </div>
                    ) : (
                      <p className="text-xs text-white/40">No tags yet. Add tags to organize your content.</p>
                    )}
                  </div>

                  {/* Source History */}
                  {domainStats && domainStats.total_analyses > 0 && (
                    <div className="hidden sm:block p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                        <h3 className="text-sm font-semibold text-white">Source History</h3>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400">
                          <span className="text-white font-medium">{displayDomain}</span> has been analyzed{" "}
                          <span className="text-white font-medium">{domainStats.total_analyses}</span> time{domainStats.total_analyses !== 1 ? "s" : ""}
                        </p>
                        {domainStats.avg_quality_score !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 shrink-0">Avg Quality:</span>
                            <div className="flex-1 min-w-0 h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                                style={{ width: `${(domainStats.avg_quality_score / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-white shrink-0">{domainStats.avg_quality_score.toFixed(1)}/10</span>
                          </div>
                        )}
                        {(domainStats.accurate_count + domainStats.mostly_accurate_count + domainStats.mixed_count + domainStats.questionable_count + domainStats.unreliable_count) > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {domainStats.accurate_count > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                {domainStats.accurate_count} Accurate
                              </span>
                            )}
                            {domainStats.mostly_accurate_count > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                {domainStats.mostly_accurate_count} Mostly Accurate
                              </span>
                            )}
                            {domainStats.mixed_count > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                {domainStats.mixed_count} Mixed
                              </span>
                            )}
                            {domainStats.questionable_count > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                {domainStats.questionable_count} Questionable
                              </span>
                            )}
                            {domainStats.unreliable_count > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                                {domainStats.unreliable_count} Unreliable
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <TooltipProvider delayDuration={300}>
                    <div className="hidden sm:grid grid-cols-3 gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleToggleBookmark}
                            disabled={isTogglingBookmark}
                            size="sm"
                            className={`w-full transition-all ${
                              isBookmarked
                                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/50"
                                : "bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white border border-white/[0.08] hover:border-white/[0.15]"
                            }`}
                          >
                            {isBookmarked ? (
                              <BookmarkCheck className="mr-2 h-4 w-4 shrink-0" />
                            ) : (
                              <Bookmark className="mr-2 h-4 w-4 shrink-0" />
                            )}
                            <span className="truncate">{isBookmarked ? "Saved" : "Save"}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isBookmarked ? "Remove from Reading List" : "Add to Reading List"}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => setIsShareModalOpen(true)}
                            size="sm"
                            className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 hover:border-emerald-500/50 transition-all"
                          >
                            <Mail className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">Share</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Share analysis via email or link</TooltipContent>
                      </Tooltip>

                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-purple-200 border border-purple-500/30 hover:border-purple-500/50 transition-all"
                              >
                                <Download className="mr-2 h-4 w-4 shrink-0" />
                                <span className="truncate">Export</span>
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Export as PDF or Markdown</TooltipContent>
                        </Tooltip>
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
                    </div>
                  </TooltipProvider>

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
            {/* Tags Management - Mobile */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Tag className="w-4 h-4 text-purple-400 shrink-0" />
                  <h3 className="text-sm font-semibold text-white truncate">Tags</h3>
                </div>
                {!showTagInput && (
                  <button
                    onClick={() => setShowTagInput(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                )}
              </div>

              {showTagInput && (
                <div className="relative mb-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newTagInput.trim()) handleAddTag(newTagInput)
                        else if (e.key === "Escape") { setShowTagInput(false); setNewTagInput("") }
                      }}
                      placeholder="Type a tag..."
                      className="flex-1 px-3 py-2 bg-white/[0.06] border border-white/[0.12] rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
                    />
                    <button
                      onClick={() => handleAddTag(newTagInput)}
                      disabled={!newTagInput.trim() || isAddingTag}
                      className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm transition-all disabled:opacity-50"
                    >
                      {isAddingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                    </button>
                    <button
                      onClick={() => { setShowTagInput(false); setNewTagInput("") }}
                      className="p-2 text-white/40 hover:text-white/60 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {newTagInput && tagSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-12 mt-1 bg-black/95 border border-white/[0.1] rounded-lg shadow-xl z-10 overflow-hidden">
                      {tagSuggestions.map(({ tag, count }) => (
                        <button
                          key={tag}
                          onClick={() => handleAddTag(tag)}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white/[0.06] transition-colors"
                        >
                          <span className="text-white/80 capitalize">{tag}</span>
                          <span className="text-xs text-white/40">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="group flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300"
                    >
                      <span className="capitalize">{tag}</span>
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="opacity-50 hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/40">No tags yet. Add tags to organize your content.</p>
              )}
            </div>

            {/* Source History - Mobile */}
            {domainStats && domainStats.total_analyses > 0 && (
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                  <h3 className="text-sm font-semibold text-white">Source History</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">
                    <span className="text-white font-medium">{displayDomain}</span> has been analyzed{" "}
                    <span className="text-white font-medium">{domainStats.total_analyses}</span> time{domainStats.total_analyses !== 1 ? "s" : ""}
                  </p>
                  {domainStats.avg_quality_score !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 shrink-0">Avg Quality:</span>
                      <div className="flex-1 min-w-0 h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                          style={{ width: `${(domainStats.avg_quality_score / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-white shrink-0">{domainStats.avg_quality_score.toFixed(1)}/10</span>
                    </div>
                  )}
                  {(domainStats.accurate_count + domainStats.mostly_accurate_count + domainStats.mixed_count + domainStats.questionable_count + domainStats.unreliable_count) > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {domainStats.accurate_count > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                          {domainStats.accurate_count} Accurate
                        </span>
                      )}
                      {domainStats.mostly_accurate_count > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {domainStats.mostly_accurate_count} Mostly Accurate
                        </span>
                      )}
                      {domainStats.mixed_count > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          {domainStats.mixed_count} Mixed
                        </span>
                      )}
                      {domainStats.questionable_count > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          {domainStats.questionable_count} Questionable
                        </span>
                      )}
                      {domainStats.unreliable_count > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                          {domainStats.unreliable_count} Unreliable
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
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

      <MobileBottomNav />
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
        <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
      </div>
    )
  }

  if (!session) {
    router.push("/login")
    return null
  }

  return <ItemDetailPageContent contentId={contentId} session={session} />
}

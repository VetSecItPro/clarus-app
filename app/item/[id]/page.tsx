"use client"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Play, Loader2, FileText, Sparkles, ChevronDown, Eye, Shield, Lightbulb, BookOpen, Target, Mail, RefreshCw, Tag, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useCallback, useRef, use } from "react"
import { supabase } from "@/lib/supabase"
import type { Tables, TriageData, TruthCheckData, ActionItemsData } from "@/types/database.types"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import withAuth from "@/components/with-auth"
import { formatDuration, getYouTubeVideoId, getDomainFromUrl } from "@/lib/utils"
import type { Session } from "@supabase/supabase-js"
import { EditAIPromptsModal } from "@/components/edit-ai-prompts-modal"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { TranscriptViewer } from "@/components/ui/transcript-viewer"
import { YouTubePlayer, YouTubePlayerRef } from "@/components/ui/youtube-player"
import { ChatPanel } from "@/components/chat-panel"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { SectionCard, SectionSkeleton } from "@/components/ui/section-card"
import { TriageCard } from "@/components/ui/triage-card"
import { TruthCheckCard } from "@/components/ui/truth-check-card"
import { ActionItemsCard } from "@/components/ui/action-items-card"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { ShareModal } from "@/components/share-modal"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useIsDesktop } from "@/lib/hooks/use-media-query"

// Props injected by withAuth HOC
interface WithAuthInjectedProps {
  session: Session | null
}

// Next.js page props
interface PageParams {
  params: Promise<{ id: string }>
}

type ItemDetailPageProps = PageParams & WithAuthInjectedProps

type ContentItem = Tables<"content">
type SummaryItem = Tables<"summaries">

interface ContentWithSummary extends ContentItem {
  summary?: SummaryItem | null
}

function ItemDetailPageContent({ params: paramsPromise, session }: ItemDetailPageProps) {
  const params = use(paramsPromise)
  const [item, setItem] = useState<ContentWithSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMainTab, setActiveMainTab] = useState(() => {
    // Read from localStorage on initial load
    if (typeof window !== "undefined") {
      return localStorage.getItem("vajra-last-tab") || "summary"
    }
    return "summary"
  })

  // Save tab selection to localStorage
  const handleTabChange = (tab: string) => {
    setActiveMainTab(tab)
    if (typeof window !== "undefined") {
      localStorage.setItem("vajra-last-tab", tab)
    }
  }
  const [isEditPromptModalOpen, setIsEditPromptModalOpen] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isPdf, setIsPdf] = useState(false)
  const [currentUserContentRating, setCurrentUserContentRating] = useState<{ signal_score: number } | null>(null)
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

  const router = useRouter()
  const isDesktop = useIsDesktop()

  // Helper to check if content is still being processed
  const isContentProcessing = useCallback((content: ContentWithSummary | null): boolean => {
    if (!content) return true
    // Content is processing if ANY of these are true:
    // 1. Title is a placeholder
    const hasPlaceholderTitle = content.title?.startsWith("Analyzing:")
    // 2. No full text yet or it failed
    const noFullText = !content.full_text || content.full_text.startsWith("PROCESSING_FAILED::")
    // 3. Summary processing not complete (must have status = "complete")
    const summaryNotComplete = !content.summary?.processing_status || content.summary.processing_status !== "complete"

    return hasPlaceholderTitle || noFullText || summaryNotComplete
  }, [])

  const handleSignalNoiseVote = useCallback(
    async (score: number) => {
      if (!session?.user?.id || !item) return

      try {
        const { error } = await supabase.from("content_ratings").upsert(
          {
            content_id: item.id,
            user_id: session.user.id,
            signal_score: score,
          },
          { onConflict: "content_id,user_id" },
        )

        if (error) throw error

        setCurrentUserContentRating({ signal_score: score })
        toast.success("Rating saved!")
      } catch (err: any) {
        toast.error("Failed to save rating")
      }
    },
    [session, item],
  )

  const handleDelete = useCallback(async () => {
    if (!item) return

    if (!confirm("Are you sure you want to delete this item?")) return

    try {
      const { error } = await supabase.from("content").delete().eq("id", item.id)
      if (error) throw error

      toast.success("Item deleted")
      router.push("/")
    } catch (err) {
      toast.error("Failed to delete item")
    }
  }, [item, router])

  // Handler for timestamp clicks in transcript
  const handleTimestampClick = useCallback((seconds: number) => {
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(seconds)
    }
  }, [])

  const handleRegenerate = useCallback(async () => {
    if (!item) return

    setIsRegenerating(true)

    // Clear existing summary to show skeletons
    setItem(prev => prev ? { ...prev, summary: null } : null)

    // Fire API in background (don't await) and start polling
    fetch("/api/process-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_id: item.id, force_regenerate: true }),
    })
      .then(response => {
        if (!response.ok) throw new Error("Failed to regenerate")
        toast.success("Analysis complete!")
      })
      .catch(err => {
        console.error("Regenerate error:", err)
        toast.error("Failed to regenerate content")
      })
      .finally(() => {
        setIsRegenerating(false)
      })

    // Start polling immediately to pick up progressive updates
    setIsPolling(true)
  }, [item])

  // Fetch content and summary data
  const fetchContentData = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true)

    const { data: contentData, error: contentError } = await supabase
      .from("content")
      .select("*")
      .eq("id", params.id)
      .single()

    if (contentError) {
      setError(contentError.message)
      setLoading(false)
      return null
    }

    const { data: summaryData } = await supabase
      .from("summaries")
      .select("*")
      .eq("content_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const combinedItem: ContentWithSummary = {
      ...contentData,
      summary: summaryData || null,
    }

    setItem(combinedItem)
    setIsPdf(contentData.url?.endsWith(".pdf") || false)

    // Check for processing failure
    if (contentData.full_text?.startsWith("PROCESSING_FAILED::")) {
      setProcessingError(contentData.full_text)
    }

    if (showLoadingState) setLoading(false)
    return combinedItem
  }, [params.id])

  useEffect(() => {
    // Fetch user's rating for this content
    const fetchRating = async () => {
      if (!session?.user?.id) return

      const { data } = await supabase
        .from("content_ratings")
        .select("signal_score")
        .eq("content_id", params.id)
        .eq("user_id", session.user.id)
        .maybeSingle()

      if (data) {
        setCurrentUserContentRating({ signal_score: data.signal_score })
      }
    }

    // Initial fetch
    const initFetch = async () => {
      const data = await fetchContentData(true)

      // If content is still processing, start polling
      if (isContentProcessing(data)) {
        setIsPolling(true)
      }
    }

    initFetch()
    fetchRating()

    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [params.id, session, fetchContentData, isContentProcessing])

  // Polling effect - runs when isPolling changes
  useEffect(() => {
    if (!isPolling) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      return
    }

    // Poll every 2 seconds for updates
    pollingIntervalRef.current = setInterval(async () => {
      const data = await fetchContentData(false)

      // Stop polling when content is ready
      if (!isContentProcessing(data)) {
        setIsPolling(false)
        toast.success("Content ready!")
      }
    }, 2000)

    // Stop polling after 2 minutes (safety timeout)
    const maxPollingTimeout = setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
        setIsPolling(false)
      }
    }, 120000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      clearTimeout(maxPollingTimeout)
    }
  }, [isPolling, fetchContentData, isContentProcessing])

  // Fetch domain credibility stats
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

      if (data) {
        setDomainStats(data)
      }
    }

    fetchDomainStats()
  }, [item?.url])

  // Fetch tags when item loads
  useEffect(() => {
    if (item?.tags) {
      setTags(item.tags as string[] || [])
    }
  }, [item?.tags])

  // Fetch all available tags for autocomplete
  useEffect(() => {
    const fetchAllTags = async () => {
      try {
        const response = await fetch("/api/tags")
        const data = await response.json()
        if (data.success) {
          setAllTags(data.tags)
        }
      } catch (error) {
        console.error("Error fetching tags:", error)
      }
    }
    fetchAllTags()
  }, [])

  // Handle adding a tag
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

  // Handle removing a tag
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

  // Filter suggestions for autocomplete
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
          <Link href="/">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white transition-all mx-auto">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </button>
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

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <SiteHeader />

      {/* Secondary nav bar with back button and tabs - fixed at top on mobile, sticky below header on desktop */}
      <div className="bg-black/90 backdrop-blur-xl border-b border-white/[0.08] fixed sm:sticky top-0 sm:top-16 left-0 right-0 sm:left-auto sm:right-auto z-20">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-1 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Left side: Back button + Tab switcher */}
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

              {/* Tab switcher - simplified for better iOS Safari support */}
                <div className="flex items-center gap-1 bg-white/[0.04] backdrop-blur-xl p-1 rounded-xl border border-white/[0.08]">
                  <button
                    onClick={() => handleTabChange("summary")}
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                    className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg cursor-pointer transition-colors duration-150 ${
                      activeMainTab === "summary"
                        ? "bg-[#1d9bf0] text-white shadow-lg shadow-blue-500/20"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04] active:bg-white/[0.08]"
                    }`}
                  >
                    Summary
                  </button>
                  <button
                    onClick={() => handleTabChange("fulltext")}
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                    className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg cursor-pointer transition-colors duration-150 ${
                      activeMainTab === "fulltext"
                        ? "bg-[#1d9bf0] text-white shadow-lg shadow-blue-500/20"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04] active:bg-white/[0.08]"
                    }`}
                  >
                    Full Text
                  </button>
                </div>
            </div>

            {/* Right side: Share + Regenerate buttons (mobile only) */}
            <div className="flex sm:hidden items-center gap-1.5">
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 active:bg-emerald-500/30 transition-all"
                aria-label="Share"
              >
                <Mail className="w-4 h-4" />
              </button>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 active:bg-blue-500/30 transition-all disabled:opacity-50"
                aria-label="Regenerate"
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
        {/* PDF: Full-width layout (no split) */}
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
          {/* MOBILE ONLY: Fixed video player below nav bar (~44px nav height + safe area) */}
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
          {/* Spacer for fixed video on mobile - accounts for video height + small gap */}
          {!isDesktop && <div className="w-full mt-2" style={{ paddingBottom: "56.25%" }} />}

          {/* Split-screen layout for YouTube and Articles */}
          <div className="lg:flex lg:gap-8 min-w-0">
            {/* LEFT PANEL: Sticky media + metadata */}
            <aside className="w-full lg:w-[480px] lg:flex-shrink-0 mb-4 lg:mb-0 min-w-0">
              <div className="lg:sticky lg:top-28 space-y-2 sm:space-y-4">
                {/* Video or Thumbnail - DESKTOP ONLY */}
                {isDesktop && (
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
                )}

                {/* Content info card - scrolls on mobile */}
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
                    {/* Worth Watching rating */}
                    {(() => {
                      const triage = summary?.triage as unknown as TriageData | null
                      const score = triage?.signal_noise_score
                      if (score === undefined || score === null) return null
                      return (
                        <span className="px-2 py-1 rounded-lg bg-[#1d9bf0]/15 text-[#1d9bf0] flex items-center gap-1">
                          <span>Worth Watching</span>
                          <span className="font-medium">{score + 1}/4</span>
                        </span>
                      )
                    })()}
                  </div>
                </div>

                {/* Tags Management - hidden on mobile, shown at bottom */}
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

                  {/* Tag input with autocomplete */}
                  {showTagInput && (
                    <div className="relative mb-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTagInput.trim()) {
                              handleAddTag(newTagInput)
                            } else if (e.key === "Escape") {
                              setShowTagInput(false)
                              setNewTagInput("")
                            }
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
                          onClick={() => {
                            setShowTagInput(false)
                            setNewTagInput("")
                          }}
                          className="p-2 text-white/40 hover:text-white/60 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Autocomplete suggestions */}
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

                  {/* Current tags */}
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

                {/* Domain Credibility - hidden on mobile, shown at bottom */}
                {domainStats && domainStats.total_analyses > 0 && (
                  <div className="hidden sm:block p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                      <h3 className="text-sm font-semibold text-white">Source Credibility</h3>
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
                      {/* Accuracy breakdown */}
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

                {/* Action buttons - hidden on mobile (in header) */}
                <TooltipProvider delayDuration={300}>
                  <div className="hidden sm:grid grid-cols-2 gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setIsShareModalOpen(true)}
                          size="sm"
                          className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl transition-all"
                        >
                          <Mail className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">Share</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Share analysis via email</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleRegenerate}
                          disabled={isRegenerating}
                          size="sm"
                          className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 hover:text-blue-200 border border-blue-500/30 hover:border-blue-500/50 rounded-xl transition-all disabled:opacity-50"
                        >
                          {isRegenerating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                              <span className="truncate">Regenerating</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">Regenerate</span>
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Re-analyze this content</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>
            </aside>

            {/* RIGHT PANEL: Scrollable content */}
            <div className="flex-1 min-w-0 overflow-hidden px-3 sm:px-4 lg:px-0">
              {activeMainTab === "summary" ? (
                <div className="space-y-6 sm:space-y-8">
                  {processingError ? (
                    <div className="p-4 text-center rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                      <h3 className="text-base font-medium text-yellow-300 mb-2">Processing Failed</h3>
                      <p className="text-sm text-yellow-300/70 mb-3">We couldn't retrieve the content from the source.</p>
                      <p className="text-xs text-yellow-300/50 mb-4">{processingError}</p>
                      <button
                        onClick={handleRegenerate}
                        disabled={isRegenerating}
                        className="px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 transition-all disabled:opacity-50 text-sm"
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
                      {/* 1. OVERVIEW */}
                  <AnimatePresence mode="wait">
                    {(summary?.brief_overview || isPolling) && (
                      <SectionCard
                        title="Overview"
                        isLoading={isPolling && !summary?.brief_overview}
                        delay={0}
                        icon={<Eye className="w-4 h-4" />}
                        headerColor="blue"
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
                          <SectionSkeleton lines={5} minHeight="180px" />
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
                      >
                        {summary?.triage ? (
                          <TriageCard triage={summary.triage as unknown as TriageData} />
                        ) : (
                          <div className="space-y-4" style={{ minHeight: "420px" }}>
                            {/* Quality Score skeleton */}
                            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                              <div className="h-4 w-24 bg-white/[0.08] rounded mb-2 animate-pulse" />
                              <div className="flex items-center gap-4">
                                <div className="h-10 w-16 bg-white/[0.08] rounded-lg animate-pulse" />
                                <div className="flex-1 h-3 bg-white/[0.06] rounded-full animate-pulse" />
                              </div>
                            </div>
                            {/* Worth Your Time skeleton */}
                            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                              <div className="h-4 w-32 bg-white/[0.08] rounded mb-2 animate-pulse" />
                              <div className="h-12 bg-white/[0.06] rounded-lg animate-pulse" />
                            </div>
                            {/* Target Audience skeleton */}
                            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                              <div className="h-4 w-28 bg-white/[0.08] rounded mb-3 animate-pulse" />
                              <div className="flex flex-wrap gap-2">
                                <div className="h-7 w-32 bg-white/[0.06] rounded-full animate-pulse" />
                                <div className="h-7 w-28 bg-white/[0.06] rounded-full animate-pulse" />
                                <div className="h-7 w-36 bg-white/[0.06] rounded-full animate-pulse" />
                              </div>
                            </div>
                            {/* Content Density skeleton */}
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
                          <SectionSkeleton lines={10} minHeight="320px" />
                        )}
                      </SectionCard>
                    )}
                  </AnimatePresence>

                  {/* 4. TRUTH CHECK */}
                  <AnimatePresence mode="wait">
                    {(summary?.truth_check || isPolling) && (
                      <SectionCard
                        title="Truth Check"
                        isLoading={isPolling && !summary?.truth_check}
                        delay={0.2}
                        icon={<Shield className="w-4 h-4" />}
                        headerColor="emerald"
                      >
                        {summary?.truth_check ? (
                          <TruthCheckCard truthCheck={summary.truth_check as unknown as TruthCheckData} />
                        ) : (
                          <div className="space-y-4" style={{ minHeight: "280px" }}>
                            {/* Rating badge skeleton */}
                            <div className="h-10 w-32 bg-white/[0.08] rounded-full animate-pulse" />
                            {/* Issues list skeleton */}
                            <div className="space-y-3">
                              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                <div className="h-4 w-full bg-white/[0.06] rounded animate-pulse mb-2" />
                                <div className="h-4 w-3/4 bg-white/[0.06] rounded animate-pulse" />
                              </div>
                              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                <div className="h-4 w-full bg-white/[0.06] rounded animate-pulse mb-2" />
                                <div className="h-4 w-2/3 bg-white/[0.06] rounded animate-pulse" />
                              </div>
                              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                <div className="h-4 w-full bg-white/[0.06] rounded animate-pulse mb-2" />
                                <div className="h-4 w-4/5 bg-white/[0.06] rounded animate-pulse" />
                              </div>
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
                      >
                        {summary?.action_items ? (
                          <ActionItemsCard actionItems={summary.action_items as unknown as ActionItemsData} />
                        ) : (
                          <div className="space-y-3" style={{ minHeight: "220px" }}>
                            <div className="h-[68px] bg-white/[0.04] rounded-xl animate-pulse" />
                            <div className="h-[68px] bg-white/[0.04] rounded-xl animate-pulse" />
                            <div className="h-[68px] bg-white/[0.04] rounded-xl animate-pulse" />
                          </div>
                        )}
                      </SectionCard>
                    )}
                  </AnimatePresence>

                  {/* No summary prompt - only show when not polling AND not regenerating */}
                  {!summary?.mid_length_summary && !isPolling && !isRegenerating && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="py-8 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06]"
                    >
                      <p className="text-white/40 text-sm mb-4">No summary generated yet.</p>
                      <button
                        onClick={handleRegenerate}
                        disabled={isRegenerating}
                        className="px-4 py-2 rounded-xl bg-[#1d9bf0] text-white text-sm hover:bg-[#1a8cd8] transition-all disabled:opacity-50"
                      >
                        Generate Summary
                      </button>
                    </motion.div>
                  )}

                  {/* 6. DETAILED ANALYSIS (Collapsible, expanded by default) */}
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
              ) : (
                /* FULL TEXT TAB */
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
                      {item.type === "youtube" && videoId ? (
                        <TranscriptViewer
                          transcript={item.full_text}
                          videoId={videoId}
                          onTimestampClick={handleTimestampClick}
                        />
                      ) : (
                        <div className="prose prose-sm prose-invert max-w-none text-white/70 leading-relaxed">
                          <MarkdownRenderer
                            onTimestampClick={(seconds) => {
                              youtubePlayerRef.current?.seekTo(seconds)
                            }}
                          >{item.full_text}</MarkdownRenderer>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </>
        )}

        {/* Mobile-only: Tags and Source Credibility at bottom */}
        {!isPdf && (
          <div className="sm:hidden space-y-4 mt-6">
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

              {/* Tag input with autocomplete */}
              {showTagInput && (
                <div className="relative mb-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newTagInput.trim()) {
                          handleAddTag(newTagInput)
                        } else if (e.key === "Escape") {
                          setShowTagInput(false)
                          setNewTagInput("")
                        }
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
                      onClick={() => {
                        setShowTagInput(false)
                        setNewTagInput("")
                      }}
                      className="p-2 text-white/40 hover:text-white/60 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Autocomplete suggestions */}
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

              {/* Current tags */}
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

            {/* Domain Credibility - Mobile */}
            {domainStats && domainStats.total_analyses > 0 && (
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                  <h3 className="text-sm font-semibold text-white">Source Credibility</h3>
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
                  {/* Accuracy breakdown */}
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

      {session && item && <ChatPanel contentId={item.id} session={session} />}
      <EditAIPromptsModal isOpen={isEditPromptModalOpen} onOpenChange={setIsEditPromptModalOpen} />
      <ShareModal
        isOpen={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        contentTitle={item.title || "Content Analysis"}
        contentUrl={item.url}
        briefOverview={summary?.brief_overview || undefined}
      />

      <SiteFooter />
      <MobileBottomNav />
    </div>
  )
}

export default withAuth(ItemDetailPageContent)

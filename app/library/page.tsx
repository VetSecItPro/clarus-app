"use client"

import { supabase } from "@/lib/supabase"
import withAuth from "@/components/with-auth"
import { useEffect, useState, useCallback } from "react"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { Search, SlidersHorizontal, Loader2, FileText, Play, Trash2, LayoutGrid, LayoutList, Zap, Clock, Twitter, Sparkles, ChevronDown, ChevronUp, ArrowRight, Star, TrendingUp, Bookmark, Tag, X } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useLibrary, type LibraryItem } from "@/lib/hooks/use-library"
import { ContentListSkeleton } from "@/components/ui/content-skeleton"

type SummaryData = {
  brief_overview: string | null
  mid_length_summary: string | null
  triage: {
    quality_score?: number
    signal_noise_score?: number
    worth_your_time?: string
    one_liner?: string
  } | null
}

type HistoryItem = LibraryItem

interface LibraryPageProps {
  session: Session | null
}

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest" },
  { value: "date_asc", label: "Oldest" },
  { value: "rating_desc", label: "Highest Rated" },
  { value: "rating_asc", label: "Lowest Rated" },
]

const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "article", label: "Articles" },
  { value: "youtube", label: "YouTube" },
  { value: "x_post", label: "X Posts" },
]

// Group items by date
function groupByDate(items: HistoryItem[]): { label: string; items: HistoryItem[] }[] {
  const groups: { [key: string]: HistoryItem[] } = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }

  items.forEach((item) => {
    if (!item.date_added) {
      groups.earlier.push(item)
      return
    }
    const date = new Date(item.date_added)
    if (isToday(date)) {
      groups.today.push(item)
    } else if (isYesterday(date)) {
      groups.yesterday.push(item)
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(item)
    } else {
      groups.earlier.push(item)
    }
  })

  const result: { label: string; items: HistoryItem[] }[] = []
  if (groups.today.length > 0) result.push({ label: "Today", items: groups.today })
  if (groups.yesterday.length > 0) result.push({ label: "Yesterday", items: groups.yesterday })
  if (groups.thisWeek.length > 0) result.push({ label: "This Week", items: groups.thisWeek })
  if (groups.earlier.length > 0) result.push({ label: "Earlier", items: groups.earlier })

  return result
}

function HistoryPageContent({ session }: LibraryPageProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortBy, setSortBy] = useState("date_desc")
  const [filterType, setFilterType] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bookmarkOnly, setBookmarkOnly] = useState(false)
  const [togglingBookmark, setTogglingBookmark] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<{ tag: string; count: number }[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [localItems, setLocalItems] = useState<HistoryItem[]>([])

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Use SWR for cached data fetching
  const { items: swrItems, isLoading, refresh } = useLibrary({
    userId: session?.user?.id,
    searchQuery: debouncedSearch,
    filterType,
    sortBy,
    bookmarkOnly,
    selectedTags,
  })

  // Sync SWR data to local state for optimistic updates
  useEffect(() => {
    setLocalItems(swrItems)
  }, [swrItems])

  const items = localItems

  // Fetch all tags
  const fetchAllTags = useCallback(async () => {
    try {
      const response = await fetch("/api/tags")
      const data = await response.json()
      if (data.success) {
        setAllTags(data.tags)
      }
    } catch (error) {
      console.error("Error fetching tags:", error)
    }
  }, [])

  useEffect(() => {
    fetchAllTags()
  }, [fetchAllTags])

  // Refresh on content changes
  useEffect(() => {
    const handleChange = () => refresh()
    window.addEventListener("contentAdded", handleChange)
    window.addEventListener("contentRated", handleChange)
    return () => {
      window.removeEventListener("contentAdded", handleChange)
      window.removeEventListener("contentRated", handleChange)
    }
  }, [refresh])

  const handleDelete = async (e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!window.confirm("Delete this item? This cannot be undone.")) return

    // Optimistic update - remove immediately
    setLocalItems((prev) => prev.filter((item) => item.id !== itemId))
    setDeletingId(itemId)

    try {
      const { error } = await supabase.from("content").delete().eq("id", itemId)
      if (error) throw error
      toast.success("Item deleted")
      refresh() // Refresh cache
    } catch (error) {
      console.error("Error deleting:", error)
      toast.error("Failed to delete item")
      refresh() // Revert by refreshing
    } finally {
      setDeletingId(null)
    }
  }

  const toggleExpand = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedId(expandedId === itemId ? null : itemId)
  }

  const handleToggleBookmark = async (e: React.MouseEvent, item: HistoryItem) => {
    e.preventDefault()
    e.stopPropagation()

    const newValue = !item.is_bookmarked

    // Optimistic update - toggle immediately
    setLocalItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_bookmarked: newValue } : i))
    )
    setTogglingBookmark(item.id)

    try {
      const response = await fetch(`/api/content/${item.id}/bookmark`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_bookmarked: newValue }),
      })

      if (!response.ok) throw new Error("Failed to update bookmark")
      toast.success(newValue ? "Added to bookmarks" : "Removed from bookmarks")
    } catch (error) {
      console.error("Error toggling bookmark:", error)
      toast.error("Failed to update bookmark")
      // Revert on error
      setLocalItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_bookmarked: !newValue } : i))
      )
    } finally {
      setTogglingBookmark(null)
    }
  }

  const getSummaryData = (item: HistoryItem): SummaryData | null => {
    const summaries = item.summaries
    if (Array.isArray(summaries)) {
      return summaries[0] ?? null
    }
    return summaries as SummaryData | null
  }

  const getSignalRating = (item: HistoryItem) => {
    const ratings = item.content_ratings
    if (Array.isArray(ratings)) {
      return ratings[0]?.signal_score ?? null
    }
    return (ratings as unknown as { signal_score: number | null })?.signal_score ?? null
  }

  const getSummaryPreview = (item: HistoryItem) => {
    const summary = getSummaryData(item)
    const overview = summary?.brief_overview
    if (!overview) return null
    return overview.length > 80 ? overview.slice(0, 80) + "..." : overview
  }

  const getDomain = (url: string | null) => {
    if (!url) return ""
    try {
      return new URL(url).hostname.replace("www.", "")
    } catch {
      return ""
    }
  }

  const getTypeBadge = (type: string | null) => {
    switch (type) {
      case "youtube":
        return { icon: Play, label: "YouTube", color: "bg-red-500/20 text-red-400 border-red-500/30" }
      case "x_post":
        return { icon: Twitter, label: "X Post", color: "bg-white/10 text-white/80 border-white/20" }
      case "article":
      default:
        return { icon: FileText, label: "Article", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" }
    }
  }

  const groupedItems = groupByDate(items)

  const renderItem = (item: HistoryItem) => {
    const typeBadge = getTypeBadge(item.type)
    const TypeIcon = typeBadge.icon
    const signalScore = getSignalRating(item)
    const summaryPreview = getSummaryPreview(item)
    const summaryData = getSummaryData(item)
    const isExpanded = expandedId === item.id
    const triage = summaryData?.triage

    if (viewMode === "grid") {
      return (
        <div key={item.id} className="group relative bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200">
          <Link href={`/item/${item.id}`}>
            {/* Thumbnail */}
            <div className="relative aspect-video bg-white/[0.06]">
              {item.thumbnail_url ? (
                <Image
                  src={item.thumbnail_url}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <TypeIcon className="w-8 h-8 text-white/20" />
                </div>
              )}
              {/* Duration badge for videos */}
              {item.type === "youtube" && item.duration && (
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] text-white font-medium">
                  {formatDuration(item.duration)}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-3">
              {/* Type badge & Signal */}
              <div className="flex items-center justify-between mb-2">
                <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium", typeBadge.color)}>
                  <TypeIcon className="w-2.5 h-2.5" />
                  {typeBadge.label}
                </div>
                {signalScore && (
                  <div className="flex items-center gap-1 text-amber-400 text-xs">
                    <Zap className="w-3 h-3 fill-current" />
                    <span>{signalScore}</span>
                  </div>
                )}
              </div>

              <h3 className="text-white font-medium text-sm line-clamp-2 mb-1">
                {item.title || "Processing..."}
              </h3>
              <p className="text-white/40 text-xs mb-1.5">{getDomain(item.url)}</p>
              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-[9px] text-purple-400 capitalize"
                    >
                      {tag}
                    </span>
                  ))}
                  {item.tags.length > 2 && (
                    <span className="text-[9px] text-white/40">+{item.tags.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          </Link>

          {/* Action buttons */}
          <TooltipProvider delayDuration={300}>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handleToggleBookmark(e, item)}
                    disabled={togglingBookmark === item.id}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      item.is_bookmarked
                        ? "bg-amber-500/80 text-white"
                        : "bg-black/60 hover:bg-amber-500/80"
                    )}
                  >
                    {togglingBookmark === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    ) : (
                      <Bookmark className={cn("w-3.5 h-3.5 text-white", item.is_bookmarked && "fill-current")} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{item.is_bookmarked ? "Remove bookmark" : "Add bookmark"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    disabled={deletingId === item.id}
                    className="p-1.5 bg-black/60 rounded-lg hover:bg-red-500/80 transition-all"
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          {/* Bookmark indicator when bookmarked */}
          {item.is_bookmarked && (
            <div className="absolute top-2 left-2 p-1 bg-amber-500/80 rounded-md z-10">
              <Bookmark className="w-3 h-3 text-white fill-current" />
            </div>
          )}
        </div>
      )
    }

    // List view with expandable cards
    return (
      <div key={item.id} className={cn(
        "group relative bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-200",
        isExpanded ? "bg-white/[0.06] border-white/[0.15]" : "hover:bg-white/[0.06] hover:border-white/[0.12]"
      )}>
        {/* Main card content */}
        <div
          className="p-4 cursor-pointer"
          onClick={(e) => toggleExpand(e, item.id)}
        >
          <div className="flex gap-4">
            {/* Thumbnail */}
            <div className="relative w-28 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.06]">
              {item.thumbnail_url ? (
                <Image
                  src={item.thumbnail_url}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <TypeIcon className="w-6 h-6 text-white/20" />
                </div>
              )}
              {/* Duration badge for videos */}
              {item.type === "youtube" && item.duration && (
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-[10px] text-white font-medium">
                  {formatDuration(item.duration)}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Type badge & Signal */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium", typeBadge.color)}>
                  <TypeIcon className="w-2.5 h-2.5" />
                  {typeBadge.label}
                </div>
                {signalScore && (
                  <div className="flex items-center gap-1 text-amber-400 text-xs">
                    <Zap className="w-3 h-3 fill-current" />
                    <span>{signalScore}</span>
                  </div>
                )}
                {triage?.quality_score && (
                  <div className="flex items-center gap-1 text-emerald-400 text-xs">
                    <Star className="w-3 h-3" />
                    <span>{triage.quality_score}/10</span>
                  </div>
                )}
              </div>

              <h3 className="text-white font-medium text-sm line-clamp-2 mb-1">
                {item.title || "Processing..."}
              </h3>

              {/* Summary preview - only when collapsed */}
              {!isExpanded && summaryPreview && (
                <p className="text-white/50 text-xs line-clamp-1 mb-1">{summaryPreview}</p>
              )}

              <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
                <span>{getDomain(item.url)}</span>
                {item.date_added && (
                  <>
                    <span>•</span>
                    <span>Analyzed {formatDistanceToNow(new Date(item.date_added), { addSuffix: true })}</span>
                  </>
                )}
              </div>
              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-[10px] text-purple-400 capitalize"
                    >
                      {tag}
                    </span>
                  ))}
                  {item.tags.length > 3 && (
                    <span className="text-[10px] text-white/40">+{item.tags.length - 3}</span>
                  )}
                </div>
              )}
            </div>

            {/* Expand/collapse button */}
            <div className="flex items-center">
              <div className={cn(
                "p-1.5 rounded-lg transition-all",
                isExpanded ? "bg-white/[0.1]" : "opacity-50 group-hover:opacity-100"
              )}>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-white/60" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/60" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-white/[0.08] pt-4 space-y-4">
            {/* Triage info */}
            {triage && (
              <div className="flex flex-wrap gap-3">
                {triage.quality_score && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <Star className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-emerald-400">Quality: {triage.quality_score}/10</span>
                  </div>
                )}
                {triage.signal_noise_score !== undefined && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-amber-400">
                      Signal: {["Noise", "Noteworthy", "Insightful", "Mind-blowing"][triage.signal_noise_score] || triage.signal_noise_score}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* One-liner */}
            {triage?.one_liner && (
              <p className="text-white/70 text-sm italic">&ldquo;{triage.one_liner}&rdquo;</p>
            )}

            {/* Brief overview */}
            {summaryData?.brief_overview && (
              <div>
                <h4 className="text-white/50 text-xs uppercase tracking-wide mb-2">Overview</h4>
                <p className="text-white/80 text-sm leading-relaxed line-clamp-4">{summaryData.brief_overview}</p>
              </div>
            )}

            {/* Key takeaways */}
            {summaryData?.mid_length_summary && (
              <div>
                <h4 className="text-white/50 text-xs uppercase tracking-wide mb-2">Key Takeaways</h4>
                <p className="text-white/70 text-sm leading-relaxed line-clamp-4">{summaryData.mid_length_summary}</p>
              </div>
            )}

            {/* Worth reading */}
            {triage?.worth_your_time && (
              <div className="p-3 bg-white/[0.04] rounded-xl">
                <h4 className="text-white/50 text-xs uppercase tracking-wide mb-1">Worth Your Time?</h4>
                <p className="text-white/80 text-sm">{triage.worth_your_time}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Link
                href={`/item/${item.id}`}
                onClick={(e) => e.stopPropagation()}
                prefetch={true}
                className="group/btn flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1d9bf0] to-[#0d8bdf] hover:from-[#1a8cd8] hover:to-[#0a7bc8] text-white rounded-xl transition-all text-sm font-semibold shadow-lg shadow-[#1d9bf0]/25 hover:shadow-[#1d9bf0]/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                View Full Analysis
                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" />
              </Link>
              <button
                onClick={(e) => handleToggleBookmark(e, item)}
                disabled={togglingBookmark === item.id}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm",
                  item.is_bookmarked
                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    : "bg-white/[0.06] text-white/60 hover:bg-amber-500/20 hover:text-amber-400"
                )}
              >
                {togglingBookmark === item.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Bookmark className={cn("w-3.5 h-3.5", item.is_bookmarked && "fill-current")} />
                )}
                {item.is_bookmarked ? "Bookmarked" : "Bookmark"}
              </button>
              <button
                onClick={(e) => handleDelete(e, item.id)}
                disabled={deletingId === item.id}
                className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-red-500/20 text-white/60 hover:text-red-400 rounded-xl transition-all text-sm"
              >
                {deletingId === item.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Action buttons - only show when collapsed */}
        {!isExpanded && (
          <TooltipProvider delayDuration={300}>
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handleToggleBookmark(e, item)}
                    disabled={togglingBookmark === item.id}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      item.is_bookmarked
                        ? "bg-amber-500/20 text-amber-400"
                        : "hover:bg-amber-500/20 text-white/40 hover:text-amber-400"
                    )}
                  >
                    {togglingBookmark === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Bookmark className={cn("w-4 h-4", item.is_bookmarked && "fill-current")} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{item.is_bookmarked ? "Remove bookmark" : "Add bookmark"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    disabled={deletingId === item.id}
                    className="p-2 rounded-lg hover:bg-red-500/20 transition-all"
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )}
        {/* Bookmark indicator - always visible when bookmarked */}
        {item.is_bookmarked && !isExpanded && (
          <div className="absolute top-3 left-3">
            <Bookmark className="w-4 h-4 text-amber-400 fill-current" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-16 sm:pb-8 w-full">
        {/* Header with view toggle */}
        <div className="flex items-center justify-between mb-3 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Library</h1>
            <p className="text-white/50 text-xs sm:text-sm hidden sm:block">Your analyzed content</p>
          </div>
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-1 p-1 bg-white/[0.06] rounded-lg">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-2 rounded-md transition-all",
                      viewMode === "list" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>List view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-2 rounded-md transition-all",
                      viewMode === "grid" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Grid view</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-3 sm:mb-6 space-y-2 sm:space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white/[0.06] border border-white/[0.08] rounded-xl sm:rounded-2xl text-sm sm:text-base text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* Filter Toggle & Bookmark Filter & Tags */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white/[0.06] border border-white/[0.08] rounded-lg sm:rounded-xl text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-xs sm:text-sm"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            <button
              onClick={() => setBookmarkOnly(!bookmarkOnly)}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm transition-all",
                bookmarkOnly
                  ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                  : "bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
              )}
            >
              <Bookmark className={cn("w-4 h-4", bookmarkOnly && "fill-current")} />
              Bookmarked
            </button>

            {/* Tags dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all",
                  selectedTags.length > 0
                    ? "bg-purple-500/20 border border-purple-500/30 text-purple-400"
                    : "bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
                )}
              >
                <Tag className="w-4 h-4" />
                Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
                <ChevronDown className={cn("w-3 h-3 transition-transform", showTagDropdown && "rotate-180")} />
              </button>

              {showTagDropdown && (
                <div className="absolute top-full left-0 mt-2 w-56 max-h-64 overflow-y-auto bg-black/95 border border-white/[0.1] rounded-xl shadow-xl z-50">
                  {allTags.length === 0 ? (
                    <div className="p-3 text-white/50 text-sm text-center">
                      No tags yet
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {allTags.map(({ tag, count }) => (
                        <button
                          key={tag}
                          onClick={() => {
                            if (selectedTags.includes(tag)) {
                              setSelectedTags(selectedTags.filter((t) => t !== tag))
                            } else {
                              setSelectedTags([...selectedTags, tag])
                            }
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                            selectedTags.includes(tag)
                              ? "bg-purple-500/20 text-purple-400"
                              : "hover:bg-white/[0.06] text-white/60"
                          )}
                        >
                          <span className="capitalize">{tag}</span>
                          <span className="text-xs text-white/40">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedTags.length > 0 && (
                    <div className="border-t border-white/[0.08] p-2">
                      <button
                        onClick={() => setSelectedTags([])}
                        className="w-full text-center py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected tags display */}
            {selectedTags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-400"
                  >
                    <span className="capitalize">{tag}</span>
                    <button
                      onClick={() => setSelectedTags(selectedTags.filter((t) => t !== tag))}
                      className="hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-2xl space-y-4">
              {/* Sort */}
              <div>
                <p className="text-white/50 text-xs mb-2 uppercase tracking-wide">Sort by</p>
                <div className="flex flex-wrap gap-2">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSortBy(opt.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm transition-all",
                        sortBy === opt.value
                          ? "bg-[#1d9bf0] text-white"
                          : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type */}
              <div>
                <p className="text-white/50 text-xs mb-2 uppercase tracking-wide">Type</p>
                <div className="flex flex-wrap gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterType(opt.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm transition-all",
                        filterType === opt.value
                          ? "bg-[#1d9bf0] text-white"
                          : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading && items.length === 0 ? (
          <div className="space-y-8">
            <div>
              <div className="h-4 w-20 bg-white/[0.08] rounded mb-3 animate-pulse" />
              <ContentListSkeleton count={4} viewMode={viewMode} />
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-[#1d9bf0]/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-[#1d9bf0]" />
            </div>
            <h3 className="text-white text-lg font-medium mb-2">No content yet</h3>
            <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto">
              Start by pasting a URL on the home page to analyze your first piece of content.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-xl transition-colors text-sm font-medium"
            >
              <Clock className="w-4 h-4" />
              Analyze something
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedItems.map((group) => (
              <div key={group.label}>
                <h2 className="text-white/50 text-xs font-medium uppercase tracking-wider mb-3 px-1">
                  {group.label}
                </h2>
                <div className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-2 lg:grid-cols-3 gap-4"
                    : "space-y-3"
                )}>
                  {group.items.map(renderItem)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
      <MobileBottomNav />
    </div>
  )
}

export default withAuth(HistoryPageContent)

"use client"

import withAuth from "@/components/with-auth"
import { useEffect, useState, useCallback, memo } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { formatDistanceToNow } from "date-fns"
import { Search, User, Play, FileText, Users, SlidersHorizontal, LayoutGrid, LayoutList, Zap, ChevronDown, ChevronUp, ArrowRight, Star, Twitter, Sparkles, Bookmark, EyeOff, Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/utils"
import { useCommunityFeed, type FeedItem } from "@/lib/hooks/use-community-feed"
import { FeedListSkeleton } from "@/components/ui/content-skeleton"

type SummaryData = {
  brief_overview: string | null
  triage: {
    quality_score?: number
    signal_noise_score?: number
    one_liner?: string
  } | null
}

type DisplayItem = FeedItem & {
  domain: string
  savedAt: string
  displayDuration: string
  raterUsername: string
  ratingGivenAt: string | null
}

const SORT_OPTIONS = [
  { value: "date_added_desc", label: "Newest" },
  { value: "date_added_asc", label: "Oldest" },
  { value: "rating_desc", label: "Highest Rated" },
  { value: "rating_asc", label: "Lowest Rated" },
]

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "article", label: "Articles" },
  { value: "youtube", label: "YouTube" },
  { value: "x_post", label: "X Posts" },
]

function CommunityPageContent({ session }: { session: Session | null }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeType, setActiveType] = useState("all")
  const [activeSort, setActiveSort] = useState("date_added_desc")
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [togglingBookmark, setTogglingBookmark] = useState<string | null>(null)
  const [hidingId, setHidingId] = useState<string | null>(null)
  const [localBookmarks, setLocalBookmarks] = useState<Record<string, boolean>>({})

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Use SWR for cached data fetching
  const { items: rawItems, isLoading, error, refresh } = useCommunityFeed({
    userId: session?.user?.id,
    searchQuery: debouncedSearch,
    filterType: activeType,
    sortBy: activeSort,
  })

  const getDomain = (url: string | null): string => {
    if (!url) return "unknown"
    try {
      return new URL(url).hostname.replace("www.", "")
    } catch {
      return "unknown"
    }
  }

  // Transform items for display
  const items: DisplayItem[] = rawItems.map((item) => {
    const rater = item.users
    const raterUsername = rater?.name || rater?.email?.split("@")[0] || "Anonymous"
    const userRating = item.content_ratings?.find((r) => r.user_id === item.user_id)
    const ratingGivenAt = userRating?.created_at
      ? formatDistanceToNow(new Date(userRating.created_at), { addSuffix: true })
      : null

    return {
      ...item,
      domain: getDomain(item.url),
      savedAt: item.date_added ? formatDistanceToNow(new Date(item.date_added), { addSuffix: true }) : "unknown",
      displayDuration: formatDuration(item.duration),
      raterUsername,
      ratingGivenAt,
    }
  })

  const toggleExpand = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedId(expandedId === itemId ? null : itemId)
  }

  const getSummaryData = (item: DisplayItem): SummaryData | null => {
    const summaries = item.summaries
    if (Array.isArray(summaries)) {
      return summaries[0] ?? null
    }
    return summaries as SummaryData | null
  }

  const getSummaryPreview = (item: DisplayItem) => {
    const summary = getSummaryData(item)
    const overview = summary?.brief_overview
    if (!overview) return null
    return overview.length > 80 ? overview.slice(0, 80) + "..." : overview
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

  const isBookmarked = (itemId: string) => {
    return localBookmarks[itemId] ?? false
  }

  const handleToggleBookmark = async (e: React.MouseEvent, item: DisplayItem) => {
    e.preventDefault()
    e.stopPropagation()

    const newValue = !isBookmarked(item.id)
    setLocalBookmarks((prev) => ({ ...prev, [item.id]: newValue }))
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
      setLocalBookmarks((prev) => ({ ...prev, [item.id]: !newValue }))
    } finally {
      setTogglingBookmark(null)
    }
  }

  const handleHide = async (e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!session?.user?.id) return

    setHidingId(itemId)

    try {
      const { error } = await supabase.from("hidden_content").insert({
        user_id: session.user.id,
        content_id: itemId,
      })
      if (error) throw error
      toast.success("Hidden from your feed")
      refresh()
    } catch (error) {
      console.error("Error hiding:", error)
      toast.error("Failed to hide item")
    } finally {
      setHidingId(null)
    }
  }

  const renderItem = (item: DisplayItem) => {
    const typeBadge = getTypeBadge(item.type)
    const TypeIcon = typeBadge.icon
    const summaryPreview = getSummaryPreview(item)
    const summaryData = getSummaryData(item)
    const isExpanded = expandedId === item.id
    const triage = summaryData?.triage

    if (viewMode === "grid") {
      return (
        <Link key={item.id} href={`/item/${item.id}`}>
          <div className="group relative bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden hover:bg-white/[0.08] hover:border-white/[0.15] hover:scale-[1.02] transition-all duration-200">
            {/* Analyzer bar */}
            <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
              <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-white/70 text-xs font-medium truncate">{item.raterUsername}</span>
              <div className={cn(
                "flex items-center gap-1 ml-auto text-[10px] px-1.5 py-0.5 rounded-full",
                item.ratingSource === "ai"
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-amber-500/20 text-amber-400"
              )}>
                {item.ratingSource === "ai" ? <Sparkles className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
                <span>{item.ratingScore}/4</span>
              </div>
            </div>

            {/* Thumbnail */}
            <div className="relative aspect-video bg-white/[0.06]">
              {item.thumbnail_url ? (
                <Image
                  src={item.thumbnail_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <TypeIcon className="w-8 h-8 text-white/20" />
                </div>
              )}
              {item.type === "youtube" && item.duration && (
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] text-white font-medium">
                  {item.displayDuration}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-3">
              <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium w-fit mb-2", typeBadge.color)}>
                <TypeIcon className="w-2.5 h-2.5" />
                {typeBadge.label}
              </div>
              <h3 className="text-white font-medium text-sm line-clamp-2 mb-1">
                {item.title || "Untitled"}
              </h3>
              <p className="text-white/40 text-xs">{item.domain}</p>
            </div>
          </div>
        </Link>
      )
    }

    // List view with expandable cards
    return (
      <div key={item.id} className={cn(
        "group relative bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-200 feed-item",
        isExpanded ? "bg-white/[0.06] border-white/[0.15]" : "hover:bg-white/[0.06] hover:border-white/[0.12]"
      )}>
        {/* Analyzer info bar */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2 flex-wrap">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <User className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white/50 text-sm">Shared by</span>
          <span className="text-white/80 text-sm font-medium">{item.raterUsername}</span>
          <span className="text-white/30 mx-1">•</span>
          <div className={cn(
            "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
            item.ratingSource === "ai"
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
          )}>
            {item.ratingSource === "ai" ? <Sparkles className="w-3 h-3" /> : <Zap className="w-3 h-3 fill-current" />}
            <span className="font-medium">{item.ratingScore}/4</span>
            <span className="text-[10px] opacity-70">{item.ratingSource === "ai" ? "AI" : "User"}</span>
          </div>
          {item.ratingGivenAt && item.ratingSource === "user" && (
            <>
              <span className="text-white/20 mx-1">·</span>
              <span className="text-white/30 text-xs">{item.ratingGivenAt}</span>
            </>
          )}
        </div>

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
                  sizes="112px"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <TypeIcon className="w-6 h-6 text-white/20" />
                </div>
              )}
              {item.type === "youtube" && item.duration && (
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-[10px] text-white font-medium">
                  {item.displayDuration}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Type badge & Quality score */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium", typeBadge.color)}>
                  <TypeIcon className="w-2.5 h-2.5" />
                  {typeBadge.label}
                </div>
                {triage?.quality_score && (
                  <div className="flex items-center gap-1 text-emerald-400 text-xs">
                    <Star className="w-3 h-3" />
                    <span>{triage.quality_score}/10</span>
                  </div>
                )}
              </div>

              <h3 className="text-white font-medium text-sm line-clamp-2 mb-1">
                {item.title || "Untitled"}
              </h3>

              {/* Summary preview - only when collapsed */}
              {!isExpanded && summaryPreview && (
                <p className="text-white/50 text-xs line-clamp-1 mb-1">{summaryPreview}</p>
              )}

              <div className="flex items-center gap-2 text-xs text-white/40">
                <span>{item.domain}</span>
                <span>•</span>
                <span>Shared {item.savedAt}</span>
              </div>
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

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-3">
              <Link
                href={`/item/${item.id}`}
                onClick={(e) => e.stopPropagation()}
                prefetch={true}
                className="group/btn inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1d9bf0] to-[#0d8bdf] hover:from-[#1a8cd8] hover:to-[#0a7bc8] text-white rounded-full transition-all text-sm font-semibold shadow-lg shadow-[#1d9bf0]/25 hover:shadow-[#1d9bf0]/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                View Full Analysis
                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" />
              </Link>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleToggleBookmark(e, item)}
                  disabled={togglingBookmark === item.id}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full transition-all border",
                    isBookmarked(item.id)
                      ? "bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30"
                      : "bg-white/[0.06] border-white/[0.08] text-white/50 hover:bg-amber-500/20 hover:border-amber-500/30 hover:text-amber-400"
                  )}
                  title={isBookmarked(item.id) ? "Remove bookmark" : "Add bookmark"}
                >
                  {togglingBookmark === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bookmark className={cn("w-4 h-4", isBookmarked(item.id) && "fill-current")} />
                  )}
                </button>
                <button
                  onClick={(e) => handleHide(e, item.id)}
                  disabled={hidingId === item.id}
                  className="w-10 h-10 flex items-center justify-center bg-white/[0.06] border border-white/[0.08] hover:bg-purple-500/20 hover:border-purple-500/30 text-white/50 hover:text-purple-400 rounded-full transition-all"
                  title="Hide from my feed"
                >
                  {hidingId === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
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
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Community</h1>
            <p className="text-white/50 text-xs sm:text-sm">Discover what others are finding valuable</p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-white/[0.06] rounded-lg">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-md transition-all",
                viewMode === "list" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"
              )}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-md transition-all",
                viewMode === "grid" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-3 sm:mb-6 space-y-2 sm:space-y-3">
          {/* Search + Filter on same line */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white/[0.06] border border-white/[0.08] rounded-xl sm:rounded-2xl text-sm sm:text-base text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center justify-center h-[42px] sm:h-[46px] w-[42px] sm:w-[46px] bg-white/[0.06] border border-white/[0.08] rounded-full text-white/60 hover:text-white hover:bg-white/[0.08] transition-all",
                showFilters && "bg-white/[0.1] border-white/[0.15] text-white"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Options - CSS transition for CLS prevention */}
          <div className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            showFilters ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
          )}>
            <div className="p-3 sm:p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl sm:rounded-2xl space-y-3 sm:space-y-4">
              {/* Sort */}
              <div>
                <p className="text-white/50 text-[10px] sm:text-xs mb-1.5 sm:mb-2 uppercase tracking-wide">Sort by</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setActiveSort(opt.value)}
                      className={cn(
                        "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-all",
                        activeSort === opt.value
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
                <p className="text-white/50 text-[10px] sm:text-xs mb-1.5 sm:mb-2 uppercase tracking-wide">Type</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {TYPE_FILTERS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setActiveType(opt.value)}
                      className={cn(
                        "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-all",
                        activeType === opt.value
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
          </div>
        </div>

        {/* Content */}
        {isLoading && items.length === 0 ? (
          <FeedListSkeleton count={5} viewMode={viewMode} />
        ) : error ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-red-400 text-sm mb-4">{error instanceof Error ? error.message : "Failed to load"}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-violet-400" />
            </div>
            <h3 className="text-white text-lg font-medium mb-2">No community content yet</h3>
            <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto">
              When other users rate content, it will appear here for you to discover.
            </p>
          </div>
        ) : (
          <div className={cn(
            viewMode === "grid"
              ? "grid grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-4"
          )}>
            {items.map(renderItem)}
          </div>
        )}
      </main>

      <SiteFooter />
      <MobileBottomNav />
    </div>
  )
}

export default withAuth(CommunityPageContent)

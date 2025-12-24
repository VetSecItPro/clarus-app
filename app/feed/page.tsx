"use client"

import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import withAuth from "@/components/with-auth"
import { useEffect, useState, useCallback } from "react"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { formatDistanceToNow } from "date-fns"
import { Search, Loader2, User, Play, FileText, Users, SlidersHorizontal, LayoutGrid, LayoutList, Zap, ChevronDown, ChevronUp, ExternalLink, Star, Twitter, Sparkles } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/utils"

type SummaryData = {
  brief_overview: string | null
  triage: {
    quality_score?: number
    signal_noise_score?: number
    one_liner?: string
  } | null
}

type FeedItemFromDb = Database["public"]["Tables"]["content"]["Row"] & {
  users: { name: string | null; email: string | null } | null
  content_ratings: { signal_score: number | null; user_id: string; created_at: string }[]
  summaries: SummaryData | SummaryData[]
}

type DisplayItem = FeedItemFromDb & {
  domain: string
  savedAt: string
  displayDuration: string
  raterUsername: string
  ratingScore: number
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
  const [items, setItems] = useState<DisplayItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeType, setActiveType] = useState("all")
  const [activeSort, setActiveSort] = useState("date_added_desc")
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const getDomain = (url: string | null): string => {
    if (!url) return "unknown"
    try {
      return new URL(url).hostname.replace("www.", "")
    } catch {
      return "unknown"
    }
  }

  const fetchContent = useCallback(async () => {
    if (!session?.user) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)

    try {
      let query = supabase
        .from("content")
        .select(
          `*, users:user_id(name, email), content_ratings(signal_score, user_id, created_at), summaries(brief_overview, triage)`,
        )
        .not("user_id", "eq", session.user.id)
        .not("content_ratings", "is", "null")

      if (debouncedSearch) {
        query = query.ilike("title", `%${debouncedSearch}%`)
      }

      if (activeType !== "all") {
        query = query.eq("type", activeType)
      }

      // Handle sorting - for rating sorts, we'll do client-side
      if (activeSort === "date_added_desc") {
        query = query.order("date_added", { ascending: false })
      } else if (activeSort === "date_added_asc") {
        query = query.order("date_added", { ascending: true })
      } else {
        query = query.order("date_added", { ascending: false })
      }

      const { data, error: fetchError } = await query.returns<FeedItemFromDb[]>()

      if (fetchError) throw fetchError

      let processed = (data || [])
        .map((item) => {
          const rater = item.users
          const raterUsername = rater?.name || rater?.email?.split("@")[0] || "Anonymous"
          const rating = item.content_ratings?.find((r) => r.user_id === item.user_id)
          const ratingScore = rating?.signal_score ?? null
          const ratingGivenAt = rating?.created_at
            ? formatDistanceToNow(new Date(rating.created_at), { addSuffix: true })
            : null

          return {
            ...item,
            domain: getDomain(item.url),
            savedAt: item.date_added ? formatDistanceToNow(new Date(item.date_added), { addSuffix: true }) : "unknown",
            displayDuration: formatDuration(item.duration),
            raterUsername,
            ratingScore: ratingScore!,
            ratingGivenAt,
          }
        })
        .filter((item): item is DisplayItem => item.ratingScore !== null && item.ratingScore !== 0)

      // Client-side sort for ratings
      if (activeSort === "rating_desc") {
        processed = processed.sort((a, b) => b.ratingScore - a.ratingScore)
      } else if (activeSort === "rating_asc") {
        processed = processed.sort((a, b) => a.ratingScore - b.ratingScore)
      }

      setItems(processed)
    } catch (err: unknown) {
      console.error("Error fetching community content:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
      toast.error("Failed to load community content")
    } finally {
      setIsLoading(false)
    }
  }, [session, debouncedSearch, activeType, activeSort])

  useEffect(() => {
    if (session?.user) fetchContent()
  }, [session, fetchContent])

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
              <span className="text-white/50 text-[10px]">by</span>
              <span className="text-white/70 text-xs font-medium truncate">{item.raterUsername}</span>
              <div className="flex items-center gap-1 ml-auto text-amber-400 text-xs">
                <span>Signal</span>
                <span>{"⚡".repeat(item.ratingScore)}</span>
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
                  unoptimized
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
        "group relative bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-200",
        isExpanded ? "bg-white/[0.06] border-white/[0.15]" : "hover:bg-white/[0.06] hover:border-white/[0.12]"
      )}>
        {/* Analyzer info bar */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <User className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white/50 text-sm">Analyzed by</span>
          <span className="text-white/80 text-sm font-medium">{item.raterUsername}</span>
          <span className="text-white/30 mx-1">•</span>
          <span className="text-white/40 text-xs">Signal</span>
          <div className="flex items-center gap-1 text-amber-400">
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span className="font-semibold">{item.ratingScore}/5</span>
          </div>
          {item.ratingGivenAt && (
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
                  unoptimized
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

            {/* Action button */}
            <div className="pt-2">
              <Link
                href={`/item/${item.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-xl transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Full Analysis
              </Link>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-2xl mx-auto px-4 pt-4 pb-8 w-full">
        {/* Header with view toggle */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1">Community</h1>
            <p className="text-white/50 text-sm">Discover what others are finding valuable</p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-white/[0.06] rounded-lg">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 rounded-md transition-all",
                viewMode === "list" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"
              )}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 rounded-md transition-all",
                viewMode === "grid" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-6 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search community content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/[0.06] border border-white/[0.08] rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-sm"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>

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
                      onClick={() => setActiveSort(opt.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm transition-all",
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
                <p className="text-white/50 text-xs mb-2 uppercase tracking-wide">Type</p>
                <div className="flex flex-wrap gap-2">
                  {TYPE_FILTERS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setActiveType(opt.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm transition-all",
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
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin mb-4" />
            <p className="text-white/40 text-sm">Loading community content...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button
              onClick={fetchContent}
              className="px-4 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-xl transition-colors text-sm font-medium"
            >
              Try again
            </button>
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
              ? "grid grid-cols-2 gap-3"
              : "space-y-4"
          )}>
            {items.map(renderItem)}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

export default withAuth(CommunityPageContent)

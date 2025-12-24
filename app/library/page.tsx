"use client"

import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import withAuth from "@/components/with-auth"
import { useEffect, useState, useCallback } from "react"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { Search, SlidersHorizontal, Loader2, FileText, Play, Trash2, LayoutGrid, LayoutList, Zap, Clock, Twitter, Sparkles, ChevronDown, ChevronUp, ExternalLink, Star, TrendingUp } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/utils"

type ContentItem = Database["public"]["Tables"]["content"]["Row"]

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

type HistoryItem = ContentItem & {
  content_ratings: { signal_score: number | null }[]
  summaries: SummaryData | SummaryData[]
}

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
  const [items, setItems] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortBy, setSortBy] = useState("date_desc")
  const [filterType, setFilterType] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const fetchContent = useCallback(async () => {
    if (!session?.user) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)

    try {
      let query = supabase
        .from("content")
        .select(`*, content_ratings(signal_score), summaries(brief_overview, mid_length_summary, triage)`)
        .eq("user_id", session.user.id)

      if (debouncedSearch) {
        query = query.ilike("title", `%${debouncedSearch}%`)
      }

      if (filterType !== "all") {
        query = query.eq("type", filterType)
      }

      // Handle sorting
      if (sortBy === "date_desc") {
        query = query.order("date_added", { ascending: false })
      } else if (sortBy === "date_asc") {
        query = query.order("date_added", { ascending: true })
      } else if (sortBy === "rating_desc" || sortBy === "rating_asc") {
        query = query.order("date_added", { ascending: false })
      }

      const { data, error } = await query

      if (error) throw error

      let sortedData = data as HistoryItem[]

      // Client-side sort for ratings
      if (sortBy === "rating_desc") {
        sortedData = sortedData.sort((a, b) => {
          const ratingA = a.content_ratings?.[0]?.signal_score ?? -1
          const ratingB = b.content_ratings?.[0]?.signal_score ?? -1
          return ratingB - ratingA
        })
      } else if (sortBy === "rating_asc") {
        sortedData = sortedData.sort((a, b) => {
          const ratingA = a.content_ratings?.[0]?.signal_score ?? 999
          const ratingB = b.content_ratings?.[0]?.signal_score ?? 999
          return ratingA - ratingB
        })
      }

      setItems(sortedData)
    } catch (error: unknown) {
      console.error("Error fetching content:", error)
      toast.error("Failed to load content")
    } finally {
      setIsLoading(false)
    }
  }, [session, debouncedSearch, filterType, sortBy])

  useEffect(() => {
    if (session?.user) fetchContent()
  }, [session, fetchContent])

  useEffect(() => {
    const handleChange = () => fetchContent()
    window.addEventListener("contentAdded", handleChange)
    window.addEventListener("contentRated", handleChange)
    return () => {
      window.removeEventListener("contentAdded", handleChange)
      window.removeEventListener("contentRated", handleChange)
    }
  }, [fetchContent])

  const handleDelete = async (e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!window.confirm("Delete this item? This cannot be undone.")) return

    setDeletingId(itemId)
    try {
      const { error } = await supabase.from("content").delete().eq("id", itemId)
      if (error) throw error
      setItems((prev) => prev.filter((item) => item.id !== itemId))
      toast.success("Item deleted")
    } catch (error) {
      console.error("Error deleting:", error)
      toast.error("Failed to delete item")
    } finally {
      setDeletingId(null)
    }
  }

  const toggleExpand = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedId(expandedId === itemId ? null : itemId)
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
              <p className="text-white/40 text-xs">{getDomain(item.url)}</p>
            </div>
          </Link>

          {/* Delete button */}
          <button
            onClick={(e) => handleDelete(e, item.id)}
            disabled={deletingId === item.id}
            className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all z-10"
          >
            {deletingId === item.id ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 text-white" />
            )}
          </button>
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

              <div className="flex items-center gap-2 text-xs text-white/40">
                <span>{getDomain(item.url)}</span>
                {item.date_added && (
                  <>
                    <span>•</span>
                    <span>Analyzed {formatDistanceToNow(new Date(item.date_added), { addSuffix: true })}</span>
                  </>
                )}
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
                className="flex items-center gap-2 px-4 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-xl transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Full Analysis
              </Link>
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

        {/* Delete button - only show when collapsed */}
        {!isExpanded && (
          <button
            onClick={(e) => handleDelete(e, item.id)}
            disabled={deletingId === item.id}
            className="absolute top-3 right-3 p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
          >
            {deletingId === item.id ? (
              <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400" />
            )}
          </button>
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
          <h1 className="text-2xl font-semibold text-white">History</h1>
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
              placeholder="Search your history..."
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
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin mb-4" />
            <p className="text-white/40 text-sm">Loading your history...</p>
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
                    ? "grid grid-cols-2 gap-3"
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
    </div>
  )
}

export default withAuth(HistoryPageContent)

"use client"

import { supabase } from "@/lib/supabase"
import withAuth, { type WithAuthInjectedProps } from "@/components/with-auth"
import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import {
  Search,
  SlidersHorizontal,
  Loader2,
  Clock,
  Sparkles,
  ChevronDown,
  Bookmark,
  Tag,
  X,
} from "lucide-react"
import Link from "next/link"
import {
  isToday,
  isYesterday,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
} from "date-fns"
import { cn } from "@/lib/utils"
import { useLibrary, type LibraryItem } from "@/lib/hooks/use-library"
import { ChatThreadCard } from "@/components/chat"
import type { TriageData } from "@/types/database.types"

type HistoryItem = LibraryItem
type LibraryPageProps = WithAuthInjectedProps

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
function groupByDate(
  items: HistoryItem[]
): { label: string; items: HistoryItem[] }[] {
  const groups: { [key: string]: HistoryItem[] } = {}
  const now = new Date()

  items.forEach((item) => {
    if (!item.date_added) {
      if (!groups["older"]) groups["older"] = []
      groups["older"].push(item)
      return
    }

    const date = new Date(item.date_added)
    const daysAgo = differenceInDays(now, date)
    const weeksAgo = differenceInWeeks(now, date)
    const monthsAgo = differenceInMonths(now, date)

    let key: string

    if (isToday(date)) {
      key = "today"
    } else if (isYesterday(date)) {
      key = "yesterday"
    } else if (daysAgo >= 2 && daysAgo <= 6) {
      key = "this_week"
    } else if (weeksAgo === 1) {
      key = "last_week"
    } else if (monthsAgo === 1) {
      key = "last_month"
    } else {
      key = "older"
    }

    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  })

  const groupOrder: { key: string; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "this_week", label: "This Week" },
    { key: "last_week", label: "Last Week" },
    { key: "last_month", label: "Last Month" },
    { key: "older", label: "Older" },
  ]

  const result: { label: string; items: HistoryItem[] }[] = []

  for (const { key, label } of groupOrder) {
    if (groups[key] && groups[key].length > 0) {
      result.push({ label, items: groups[key] })
    }
  }

  return result
}

function LibraryPageContent({ session }: LibraryPageProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortBy, setSortBy] = useState("date_desc")
  const [filterType, setFilterType] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bookmarkOnly, setBookmarkOnly] = useState(
    () => searchParams.get("bookmarks") === "true"
  )
  const [togglingBookmark, setTogglingBookmark] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<{ tag: string; count: number }[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [localItems, setLocalItems] = useState<HistoryItem[]>([])

  // Sync bookmarkOnly with URL params
  useEffect(() => {
    const bookmarksParam = searchParams.get("bookmarks")
    if (bookmarksParam === "true") {
      setBookmarkOnly(true)
    }
  }, [searchParams])

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Use SWR for cached data fetching
  const {
    items: swrItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
  } = useLibrary({
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

  const handleDelete = async (itemId: string) => {
    if (!window.confirm("Delete this item? This cannot be undone.")) return

    setLocalItems((prev) => prev.filter((item) => item.id !== itemId))
    setDeletingId(itemId)

    try {
      const { error } = await supabase.from("content").delete().eq("id", itemId)
      if (error) throw error
      toast.success("Item deleted")
      refresh()
    } catch {
      toast.error("Failed to delete item")
      refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleBookmark = async (item: HistoryItem) => {
    const newValue = !item.is_bookmarked

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
    } catch {
      toast.error("Failed to update bookmark")
      setLocalItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_bookmarked: !newValue } : i
        )
      )
    } finally {
      setTogglingBookmark(null)
    }
  }

  const handleItemClick = (itemId: string) => {
    router.push(`/chat/${itemId}`)
  }

  const groupedItems = groupByDate(items)

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-16 sm:pb-8 w-full">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-white">
            Library
          </h1>
          <p className="text-white/50 text-xs sm:text-sm">
            Your analyzed content
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-4 sm:mb-6 space-y-2 sm:space-y-3">
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center justify-center gap-2 h-10 px-4 bg-white/[0.06] border border-white/[0.08] rounded-full text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-sm",
                showFilters && "bg-white/[0.1] border-white/[0.15] text-white"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={() => setBookmarkOnly(!bookmarkOnly)}
              className={cn(
                "flex items-center gap-2 h-10 px-5 rounded-full text-sm transition-all",
                bookmarkOnly
                  ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                  : "bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
              )}
            >
              <Bookmark
                className={cn("w-4 h-4", bookmarkOnly && "fill-current")}
              />
              Bookmarked
            </button>

            {/* Tags dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                className={cn(
                  "flex items-center gap-2 h-10 px-5 rounded-full text-sm transition-all",
                  selectedTags.length > 0
                    ? "bg-purple-500/20 border border-purple-500/30 text-purple-400"
                    : "bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
                )}
              >
                <Tag className="w-4 h-4" />
                Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform",
                    showTagDropdown && "rotate-180"
                  )}
                />
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
                              setSelectedTags(
                                selectedTags.filter((t) => t !== tag)
                              )
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
                      onClick={() =>
                        setSelectedTags(selectedTags.filter((t) => t !== tag))
                      }
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
                <p className="text-white/50 text-xs mb-2 uppercase tracking-wide">
                  Sort by
                </p>
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
                <p className="text-white/50 text-xs mb-2 uppercase tracking-wide">
                  Type
                </p>
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
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-20 bg-white/[0.04] rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-[#1d9bf0]/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-[#1d9bf0]" />
            </div>
            <h3 className="text-white text-lg font-medium mb-2">
              No content yet
            </h3>
            <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto">
              Start by pasting a URL on the home page to analyze your first
              piece of content.
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
          <div className="space-y-6">
            {groupedItems.map((group) => (
              <div key={group.label}>
                <h2 className="text-white/50 text-xs font-medium uppercase tracking-wider mb-3 px-1">
                  {group.label}
                </h2>
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const summary = Array.isArray(item.summaries) ? item.summaries[0] : item.summaries
                    return (
                      <ChatThreadCard
                        key={item.id}
                        id={item.id}
                        title={item.title || "Untitled"}
                        url={item.url}
                        type={(item.type as "youtube" | "article" | "x_post") || "article"}
                        thumbnail_url={item.thumbnail_url}
                        brief_overview={summary?.brief_overview}
                        triage={summary?.triage as TriageData | null | undefined}
                        date_added={item.date_added || new Date().toISOString()}
                        is_bookmarked={item.is_bookmarked}
                        onClick={() => handleItemClick(item.id)}
                        onBookmark={() => handleToggleBookmark(item)}
                        onDelete={() => handleDelete(item.id)}
                      />
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-4 pb-8">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-full text-white/70 hover:text-white hover:bg-white/[0.1] transition-all text-sm font-medium disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
      <MobileBottomNav />
    </div>
  )
}

export default withAuth(LibraryPageContent)

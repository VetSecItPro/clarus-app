"use client"

import { supabase } from "@/lib/supabase"
import withAuth, { type WithAuthInjectedProps } from "@/components/with-auth"
import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
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
  Star,
  GitCompareArrows,
  PanelLeftOpen,
  PanelLeftClose,
  FolderOpen,
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
import dynamic from "next/dynamic"
// PERF: Direct import instead of barrel to avoid pulling in all chat components
import { ChatThreadCard } from "@/components/chat/chat-thread-card"
import { useCollections, useCollectionItems } from "@/lib/hooks/use-collections"

// PERF: FIX-PERF-002 — Dynamic import collection components to reduce library page bundle
const CollectionSidebar = dynamic(
  () => import("@/components/collections/collection-sidebar").then(mod => mod.CollectionSidebar),
  { ssr: false }
)
const AddToCollectionButton = dynamic(
  () => import("@/components/collections/add-to-collection-button").then(mod => mod.AddToCollectionButton),
  { ssr: false }
)
import type { TriageData } from "@/types/database.types"
import { TIER_FEATURES } from "@/lib/tier-limits"
// PERF: use shared SWR hook instead of independent Supabase query for tier data
import { useUserTier } from "@/lib/hooks/use-user-tier"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { useActiveAnalysis } from "@/lib/contexts/active-analysis-context"

type HistoryItem = LibraryItem
type LibraryPageProps = WithAuthInjectedProps

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest" },
  { value: "date_asc", label: "Oldest" },
  { value: "score_desc", label: "Best Quality" },
  { value: "rating_desc", label: "Highest Rated" },
  { value: "rating_asc", label: "Lowest Rated" },
]

const SCORE_FILTER_OPTIONS = [
  { value: "all", label: "All Scores", min: 0, max: 10 },
  { value: "high", label: "8+", min: 8, max: 10 },
  { value: "good", label: "6-7", min: 6, max: 7 },
  { value: "low", label: "Below 6", min: 0, max: 5 },
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
      key = `${daysAgo}_days`
    } else if (weeksAgo === 1) {
      key = "last_week"
    } else if (weeksAgo === 2) {
      key = "2_weeks"
    } else if (weeksAgo === 3) {
      key = "3_weeks"
    } else if (monthsAgo >= 1) {
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
    { key: "2_days", label: "Two days ago" },
    { key: "3_days", label: "Three days ago" },
    { key: "4_days", label: "Four days ago" },
    { key: "5_days", label: "Five days ago" },
    { key: "6_days", label: "Six days ago" },
    { key: "last_week", label: "Last week" },
    { key: "2_weeks", label: "Two weeks ago" },
    { key: "3_weeks", label: "Three weeks ago" },
    { key: "last_month", label: "Last month" },
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
  const [bookmarkOnly, setBookmarkOnly] = useState(
    () => searchParams.get("bookmarks") === "true"
  )
  const [allTags, setAllTags] = useState<{ tag: string; count: number }[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [localItems, setLocalItems] = useState<HistoryItem[]>([])
  const [scoreFilter, setScoreFilter] = useState("all")
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [showCollectionsSidebar, setShowCollectionsSidebar] = useState(false)
  const { collections } = useCollections()
  // PERF: shared SWR hook eliminates duplicate tier query (was independent useEffect+fetch)
  const { tier: userTier } = useUserTier(session?.user?.id ?? null)
  const { isComplete: analysisJustCompleted } = useActiveAnalysis()

  const canCompare = TIER_FEATURES[userTier].comparativeAnalysis

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
    scoreFilter: scoreFilter !== "all"
      ? SCORE_FILTER_OPTIONS.find((opt) => opt.value === scoreFilter) ?? null
      : null,
  })

  // Auto-refresh library when a background analysis completes
  useEffect(() => {
    if (analysisJustCompleted) refresh()
  }, [analysisJustCompleted, refresh])

  // Fetch collection item content IDs for filtering
  const { contentIds: collectionContentIds } = useCollectionItems(selectedCollectionId)

  // Sync SWR data to local state for optimistic updates
  useEffect(() => {
    setLocalItems(swrItems)
  }, [swrItems])

  // Filter by collection if one is selected, otherwise show all items
  const items = selectedCollectionId
    ? localItems.filter((item) => collectionContentIds.includes(item.id))
    : localItems

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

  const [deleteDialog, confirmDelete] = useConfirmDialog<{ id: string; title: string }>({
    title: "Delete item",
    description: (item) => `Delete "${item.title}"? This cannot be undone.`,
    confirmLabel: "Delete",
    variant: "danger",
    onConfirm: async (item) => {
      setLocalItems((prev) => prev.filter((i) => i.id !== item.id))
      try {
        const { error } = await supabase.from("content").delete().eq("id", item.id)
        if (error) throw error
        toast.success("Item deleted")
        refresh()
      } catch {
        toast.error("Failed to delete item")
        refresh()
      }
    },
  })

  const handleToggleBookmark = useCallback(async (item: HistoryItem) => {
    const newValue = !item.is_bookmarked

    setLocalItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_bookmarked: newValue } : i))
    )

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
    }
  }, [])

  const handleItemClick = useCallback((itemId: string) => {
    router.push(`/item/${itemId}`)
  }, [router])

  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev)
  }, [])

  const toggleBookmarkOnly = useCallback(() => {
    setBookmarkOnly(prev => !prev)
  }, [])

  const toggleTagDropdown = useCallback(() => {
    setShowTagDropdown(prev => !prev)
  }, [])

  const toggleCollectionsSidebar = useCallback(() => {
    setShowCollectionsSidebar(prev => !prev)
  }, [])

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }, [])

  const handleTagsClear = useCallback(() => {
    setSelectedTags([])
  }, [])

  const handleTagRemove = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const groupedItems = groupByDate(items)

  const selectedCollection = selectedCollectionId
    ? collections.find((c) => c.id === selectedCollectionId) ?? null
    : null

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex max-w-6xl mx-auto w-full">
        {/* Collections Sidebar (desktop) */}
        {showCollectionsSidebar && (
          <aside className="hidden md:block w-64 shrink-0 px-4 pt-3 sm:pt-4 pb-8 border-r border-white/[0.06]">
            <CollectionSidebar
              selectedCollectionId={selectedCollectionId}
              onSelectCollection={setSelectedCollectionId}
            />
          </aside>
        )}

        <main id="main-content" className="flex-1 min-w-0 max-w-4xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-16 sm:pb-8 w-full">
          {/* Header */}
          <div className="mb-4 sm:mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white">
                {selectedCollection ? selectedCollection.name : "Library"}
              </h1>
              <p className="text-white/50 text-xs sm:text-sm">
                {selectedCollection
                  ? selectedCollection.description || `${selectedCollection.item_count} items`
                  : "Your analyzed content"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canCompare && (
                <Link
                  href="/compare"
                  className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-white/[0.08] rounded-full text-sm text-white/70 hover:text-white hover:bg-white/[0.1] transition-all"
                >
                  <GitCompareArrows className="w-4 h-4" />
                  <span className="hidden sm:inline">Compare</span>
                </Link>
              )}
              <button
                onClick={toggleCollectionsSidebar}
                aria-label={showCollectionsSidebar ? "Hide collections sidebar" : "Show collections sidebar"}
                className="hidden md:flex items-center gap-2 h-9 px-3 bg-white/[0.06] border border-white/[0.08] rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-xs"
              >
                {showCollectionsSidebar ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <PanelLeftOpen className="w-4 h-4" />
                )}
                Collections
              </button>
            </div>
          </div>

          {/* Mobile collections bar */}
          <div className="lg:hidden mb-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedCollectionId(null)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs transition-all border",
                  selectedCollectionId === null
                    ? "bg-brand border-brand text-white"
                    : "bg-white/[0.06] border-white/[0.08] text-white/60"
                )}
              >
                All
              </button>
              {collections.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCollectionId(c.id)}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all border",
                    selectedCollectionId === c.id
                      ? "bg-white/[0.1] border-white/[0.15] text-white"
                      : "bg-white/[0.06] border-white/[0.08] text-white/60"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color || "var(--brand)" }}
                  />
                  {c.name}
                  <span className="text-white/50">{c.item_count}</span>
                </button>
              ))}
            </div>
          </div>

        {/* Search & Filter Bar */}
        <div className="mb-4 sm:mb-6 space-y-2 sm:space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search library"
              className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white/[0.06] border border-white/[0.08] rounded-xl sm:rounded-2xl text-sm sm:text-base text-white placeholder-white/40 focus-visible:outline-none focus:border-white/20 focus-visible:ring-1 focus-visible:ring-brand/50 transition-colors"
            />
          </div>

          {/* Filter Toggle & Bookmark Filter & Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleFilters}
              aria-label="Toggle filters"
              aria-expanded={showFilters}
              className={cn(
                "flex items-center justify-center gap-2 h-10 px-4 bg-white/[0.06] border border-white/[0.08] rounded-full text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-sm",
                showFilters && "bg-white/[0.1] border-white/[0.15] text-white"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={toggleBookmarkOnly}
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
                onClick={toggleTagDropdown}
                aria-expanded={showTagDropdown}
                aria-haspopup="listbox"
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
                          onClick={() => handleTagToggle(tag)}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                            selectedTags.includes(tag)
                              ? "bg-purple-500/20 text-purple-400"
                              : "hover:bg-white/[0.06] text-white/60"
                          )}
                        >
                          <span className="capitalize">{tag}</span>
                          <span className="text-xs text-white/50">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedTags.length > 0 && (
                    <div className="border-t border-white/[0.08] p-2">
                      <button
                        onClick={handleTagsClear}
                        className="w-full text-center py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quality Score filter */}
            <div className="flex items-center gap-1">
              {SCORE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScoreFilter(opt.value)}
                  className={cn(
                    "flex items-center gap-1.5 h-10 px-3 rounded-full text-sm transition-all",
                    scoreFilter === opt.value
                      ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                      : "bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
                  )}
                >
                  {opt.value === "high" && <Star className="w-3 h-3 fill-current" />}
                  {opt.label}
                </button>
              ))}
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
                      onClick={() => handleTagRemove(tag)}
                      aria-label={`Remove ${tag} filter`}
                      className="p-1 -m-0.5 rounded hover:text-white hover:bg-white/10 transition-colors"
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
                          ? "bg-brand text-white"
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
                          ? "bg-brand text-white"
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
            {selectedCollection ? (
              <>
                <div className="w-20 h-20 bg-white/[0.04] rounded-full flex items-center justify-center mx-auto mb-6">
                  <FolderOpen className="w-10 h-10 text-white/30" />
                </div>
                <h3 className="text-white text-lg font-medium mb-2">
                  &ldquo;{selectedCollection.name}&rdquo; is empty
                </h3>
                <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto">
                  Add items to this collection from any analysis page using the collection button.
                </p>
                <button
                  onClick={() => setSelectedCollectionId(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white rounded-full transition-colors text-sm font-medium"
                >
                  View all items
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-brand/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-brand" />
                </div>
                <h3 className="text-white text-lg font-medium mb-2">
                  No content yet
                </h3>
                <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto">
                  Start by pasting a URL on the home page to analyze your first
                  piece of content.
                </p>
                <Link
                  href="/home"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-full transition-colors text-sm font-medium"
                >
                  <Clock className="w-4 h-4" />
                  Analyze something
                </Link>
              </>
            )}
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
                      <div key={item.id}>
                        <ChatThreadCard
                          id={item.id}
                          title={item.title || "Untitled"}
                          url={item.url}
                          type={(item.type as "youtube" | "article" | "x_post" | "podcast") || "article"}
                          thumbnail_url={item.thumbnail_url}
                          brief_overview={summary?.brief_overview}
                          triage={summary?.triage as TriageData | null | undefined}
                          processingStatus={summary?.processing_status ?? null}
                          contentFailed={Boolean(item.full_text?.startsWith("PROCESSING_FAILED::"))}
                          date_added={item.date_added || new Date().toISOString()}
                          is_bookmarked={item.is_bookmarked}
                          onClick={() => handleItemClick(item.id)}
                          onBookmark={() => handleToggleBookmark(item)}
                          onDelete={() => confirmDelete({ id: item.id, title: item.title || "Untitled" })}
                          extraActions={
                            <AddToCollectionButton
                              contentId={item.id}
                              compact
                              className="w-9 h-9"
                            />
                          }
                        />
                      </div>
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
      </div>

      {deleteDialog}
    </div>
  )
}

export default withAuth(LibraryPageContent)

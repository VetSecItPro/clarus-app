"use client"

import withAuth, { type WithAuthInjectedProps } from "@/components/with-auth"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import SiteHeader from "@/components/site-header"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { Search, Users, SlidersHorizontal, Sparkles, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCommunityFeed, type FeedItem } from "@/lib/hooks/use-community-feed"
import { ChatThreadCard } from "@/components/chat"
import type { TriageData } from "@/types/database.types"

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

function CommunityPageContent({ session }: WithAuthInjectedProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeType, setActiveType] = useState("all")
  const [activeSort, setActiveSort] = useState("date_added_desc")
  const [showFilters, setShowFilters] = useState(false)
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

  const isBookmarked = (itemId: string) => {
    return localBookmarks[itemId] ?? false
  }

  const handleToggleBookmark = async (item: FeedItem) => {
    const newValue = !isBookmarked(item.id)
    setLocalBookmarks((prev) => ({ ...prev, [item.id]: newValue }))

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
      setLocalBookmarks((prev) => ({ ...prev, [item.id]: !newValue }))
    }
  }

  const handleHide = async (itemId: string) => {
    if (!session?.user?.id) return

    if (!window.confirm("Hide this item from your feed?")) return

    try {
      const { error } = await supabase.from("hidden_content").insert({
        user_id: session.user.id,
        content_id: itemId,
      })
      if (error) throw error
      toast.success("Hidden from your feed")
      refresh()
    } catch {
      toast.error("Failed to hide item")
    }
  }

  const getSummaryData = (item: FeedItem) => {
    const summaries = item.summaries
    if (Array.isArray(summaries)) {
      return summaries[0] ?? null
    }
    return summaries as { brief_overview: string | null; triage: { quality_score?: number; signal_noise_score?: number } | null } | null
  }

  const getAnalyzerInfo = (item: FeedItem) => {
    const rater = item.users
    const name = rater?.name || rater?.email?.split("@")[0] || "Anonymous"
    return {
      name,
      avatar_url: undefined, // Could add avatar support later
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-20 sm:pb-8 w-full">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-white">Community</h1>
          <p className="text-white/50 text-xs sm:text-sm">Discover what others are finding valuable</p>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-4 sm:mb-6 space-y-2 sm:space-y-3">
          {/* Search + Filter on same line */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search community..."
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

          {/* Filter Options */}
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
        {isLoading && rawItems.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-red-400 text-sm mb-4">{error instanceof Error ? error.message : "Failed to load"}</p>
          </div>
        ) : rawItems.length === 0 ? (
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
          <div className="space-y-3">
            {rawItems.map((item) => {
              const summaryData = getSummaryData(item)
              const analyzer = getAnalyzerInfo(item)

              return (
                <ChatThreadCard
                  key={item.id}
                  id={item.id}
                  title={item.title || "Untitled"}
                  url={item.url || ""}
                  type={(item.type as "youtube" | "article" | "x_post") || "article"}
                  thumbnail_url={item.thumbnail_url}
                  brief_overview={summaryData?.brief_overview}
                  triage={summaryData?.triage as TriageData | null | undefined}
                  date_added={item.date_added || new Date().toISOString()}
                  is_bookmarked={isBookmarked(item.id)}
                  analyzer={analyzer}
                  onClick={() => router.push(`/chat/${item.id}`)}
                  onBookmark={() => handleToggleBookmark(item)}
                  onDelete={() => handleHide(item.id)}
                />
              )
            })}
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  )
}

export default withAuth(CommunityPageContent)

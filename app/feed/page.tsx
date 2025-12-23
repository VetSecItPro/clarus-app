"use client"

import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import withAuth from "@/components/with-auth"
import { useEffect, useState, useCallback } from "react"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import BottomNavigation from "@/components/bottom-navigation"
import GlasmorphicSettingsButton from "@/components/glassmorphic-settings-button"
import { formatDistanceToNow } from "date-fns"
import { Search, Loader2, User, Play, FileText, ChevronDown, Users } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/utils"

type FeedItemFromDb = Database["public"]["Tables"]["content"]["Row"] & {
  users: { name: string | null; email: string | null } | null
  content_ratings: { signal_score: number | null; user_id: string; created_at: string }[]
  summaries: { id: string; mid_length_summary: string | null }[]
}
type FeedItem = Database["public"]["Tables"]["content"]["Row"]

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
]

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "article", label: "Articles" },
  { value: "youtube", label: "YouTube" },
  { value: "x_post", label: "X Posts" },
]

const getRatingDisplay = (score: number): string => {
  const lightning = "⚡"
  return lightning.repeat(score)
}

function CommunityPageContent({ session }: { session: Session | null }) {
  const [items, setItems] = useState<DisplayItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeType, setActiveType] = useState("all")
  const [activeSort, setActiveSort] = useState("date_added_desc")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 500)
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
          `*, users:user_id(name, email), content_ratings(signal_score, user_id, created_at), summaries(id, mid_length_summary)`,
        )
        .not("user_id", "eq", session.user.id)
        .not("content_ratings", "is", "null")

      if (debouncedSearch) {
        query = query.ilike("title", `%${debouncedSearch}%`)
      }

      if (activeType !== "all") {
        query = query.eq("type", activeType)
      }

      const lastUnderscoreIndex = activeSort.lastIndexOf("_")
      const sortColumn = activeSort.substring(0, lastUnderscoreIndex)
      const sortDirection = activeSort.substring(lastUnderscoreIndex + 1)
      query = query.order(sortColumn as keyof FeedItem, { ascending: sortDirection === "asc" })

      const { data, error: fetchError } = await query.returns<FeedItemFromDb[]>()

      if (fetchError) throw fetchError

      const processed = (data || [])
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

      setItems(processed)
    } catch (err: any) {
      console.error("Error fetching community content:", err)
      setError(err.message)
      toast.error("Failed to load community content")
    } finally {
      setIsLoading(false)
    }
  }, [session, debouncedSearch, activeType, activeSort])

  useEffect(() => {
    if (session?.user) fetchContent()
  }, [session, fetchContent])

  return (
    <div className="min-h-screen bg-black">
      {/* Settings */}
      <div className="fixed top-4 right-4 z-30">
        <GlasmorphicSettingsButton />
      </div>

      {/* Main content */}
      <div className="px-4 pt-16 pb-32 max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white mb-1">Community</h1>
          <p className="text-white/50 text-sm">See what others are rating</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search community..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-2xl py-3 pl-11 pr-4 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-white/50 text-sm mb-4 hover:text-white/70 transition-colors"
        >
          <span>Filters</span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", showFilters && "rotate-180")} />
        </button>

        {/* Collapsible filters */}
        {showFilters && (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-6 space-y-4">
            {/* Type filter */}
            <div>
              <label className="text-white/40 text-xs mb-2 block">Type</label>
              <div className="flex flex-wrap gap-2">
                {TYPE_FILTERS.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setActiveType(type.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      activeType === type.value
                        ? "bg-[#1d9bf0] text-white"
                        : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]",
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="text-white/40 text-xs mb-2 block">Sort</label>
              <div className="flex gap-2">
                {SORT_OPTIONS.map((sort) => (
                  <button
                    key={sort.value}
                    onClick={() => setActiveSort(sort.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      activeSort === sort.value
                        ? "bg-[#1d9bf0] text-white"
                        : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]",
                    )}
                  >
                    {sort.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button onClick={fetchContent} className="text-[#1d9bf0] text-sm hover:underline">
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-white/[0.06] rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-white/30" />
            </div>
            <p className="text-white/50 text-sm">No community content yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Link key={item.id} href={`/item/${item.id}`}>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden hover:bg-white/[0.06] transition-colors">
                  {/* Rater info bar */}
                  <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                    <div className="w-6 h-6 bg-white/[0.1] rounded-full flex items-center justify-center">
                      <User className="w-3 h-3 text-white/60" />
                    </div>
                    <span className="text-white/80 text-sm font-medium">{item.raterUsername}</span>
                    <span className="text-white/30 text-sm">rated</span>
                    <span className="text-[#1d9bf0] font-medium tracking-wide">
                      {getRatingDisplay(item.ratingScore)}
                    </span>
                    {item.ratingGivenAt && (
                      <>
                        <span className="text-white/20 mx-1">·</span>
                        <span className="text-white/30 text-xs">{item.ratingGivenAt}</span>
                      </>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex gap-4">
                    {/* Thumbnail */}
                    <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.06]">
                      <Image
                        src={
                          item.thumbnail_url ||
                          `/placeholder.svg?height=80&width=80&query=${encodeURIComponent(item.type || "content")}`
                        }
                        alt={item.title || "Content"}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      {item.type === "youtube" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium text-sm line-clamp-2 mb-2">{item.title || "Untitled"}</h3>
                      <div className="flex items-center gap-2 text-white/40 text-xs">
                        <Badge
                          variant="secondary"
                          className="bg-white/[0.08] text-white/60 border-0 text-[10px] px-2 py-0.5"
                        >
                          {item.type === "youtube" ? (
                            <>
                              <Play className="w-2.5 h-2.5 mr-1" />
                              {item.displayDuration}
                            </>
                          ) : item.type === "x_post" ? (
                            "X Post"
                          ) : (
                            <>
                              <FileText className="w-2.5 h-2.5 mr-1" />
                              Article
                            </>
                          )}
                        </Badge>
                        <span>{item.domain}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  )
}

export default withAuth(CommunityPageContent)

"use client"

import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import withAuth from "@/components/with-auth"
import { useEffect, useState, useCallback } from "react"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import BottomNavigation from "@/components/bottom-navigation"
import GlasmorphicSettingsButton from "@/components/glassmorphic-settings-button"
import { Search, SlidersHorizontal, Loader2, FileText, Play } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"

type ContentItem = Database["public"]["Tables"]["content"]["Row"]

type HistoryItem = ContentItem & {
  content_ratings: { signal_score: number | null }[]
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

function HistoryPageContent({ session }: LibraryPageProps) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortBy, setSortBy] = useState("date_desc")
  const [filterType, setFilterType] = useState("all")
  const [showFilters, setShowFilters] = useState(false)

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
      let query = supabase.from("content").select(`*, content_ratings(signal_score)`).eq("user_id", session.user.id)

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
        // For rating sort, we'll sort client-side after fetch
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
    } catch (error: any) {
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

  const getRatingDisplay = (item: HistoryItem) => {
    const score = item.content_ratings?.[0]?.signal_score
    if (!score) return null
    return "⚡".repeat(score)
  }

  const getDomain = (url: string | null) => {
    if (!url) return ""
    try {
      return new URL(url).hostname.replace("www.", "")
    } catch {
      return ""
    }
  }

  return (
    <div className="min-h-screen bg-black pb-32">
      <div className="fixed top-4 right-4 z-10">
        <GlasmorphicSettingsButton />
      </div>

      <main className="max-w-lg mx-auto px-4 pt-16">
        {/* Header */}
        <h1 className="text-2xl font-semibold text-white mb-6">History</h1>

        {/* Search & Filter Bar */}
        <div className="mb-6 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search..."
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
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        sortBy === opt.value
                          ? "bg-[#1d9bf0] text-white"
                          : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                      }`}
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
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        filterType === opt.value
                          ? "bg-[#1d9bf0] text-white"
                          : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 bg-white/[0.06] rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-5 h-5 text-white/40" />
            </div>
            <p className="text-white/40">No content yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link key={item.id} href={`/item/${item.id}`}>
                <div className="group p-4 bg-white/[0.04] border border-white/[0.08] rounded-2xl hover:bg-white/[0.06] transition-all">
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.06]">
                      {item.thumbnail_url ? (
                        <Image
                          src={item.thumbnail_url || "/placeholder.svg"}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {item.type === "youtube" ? (
                            <Play className="w-6 h-6 text-white/20" />
                          ) : (
                            <FileText className="w-6 h-6 text-white/20" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium text-sm line-clamp-2 mb-1">
                        {item.title || "Processing..."}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <span>{getDomain(item.url)}</span>
                        {item.date_added && (
                          <>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(item.date_added), { addSuffix: true })}</span>
                          </>
                        )}
                      </div>
                      {getRatingDisplay(item) && <div className="mt-2 text-sm">{getRatingDisplay(item)}</div>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  )
}

export default withAuth(HistoryPageContent)

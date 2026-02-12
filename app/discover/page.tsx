"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { TrendingUp, Sparkles, Clock, ArrowUpDown, Play, FileText, Mic, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { DiscoverCard } from "@/components/discover/discover-card"
import SiteHeader from "@/components/site-header"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { supabase } from "@/lib/supabase"
import { getCachedSession } from "@/components/with-auth"
import { useRouter } from "next/navigation"
import type { DiscoverFeedItem } from "@/app/api/discover/route"

type SortOption = "trending" | "newest" | "top"
type TypeFilter = "all" | "youtube" | "article" | "podcast"

const SORT_OPTIONS: { value: SortOption; label: string; icon: typeof TrendingUp }[] = [
  { value: "trending", label: "Trending", icon: TrendingUp },
  { value: "newest", label: "Newest", icon: Clock },
  { value: "top", label: "Top Rated", icon: ArrowUpDown },
]

const TYPE_OPTIONS: { value: TypeFilter; label: string; icon?: typeof Play }[] = [
  { value: "all", label: "All" },
  { value: "youtube", label: "YouTube", icon: Play },
  { value: "article", label: "Articles", icon: FileText },
  { value: "podcast", label: "Podcasts", icon: Mic },
]

const PAGE_SIZE = 20

export default function DiscoverPage() {
  const router = useRouter()
  const [items, setItems] = useState<DiscoverFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortOption>("trending")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { session } = getCachedSession()
      if (session?.user) {
        setCurrentUserId(session.user.id)
        setAuthChecked(true)
        return
      }

      const { data: { session: freshSession } } = await supabase.auth.getSession()
      if (!freshSession) {
        router.push("/login")
        return
      }
      setCurrentUserId(freshSession.user.id)
      setAuthChecked(true)
    }
    checkAuth()
  }, [router])

  const fetchItems = useCallback(async (pageNum: number, resetItems: boolean) => {
    if (resetItems) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
        sort,
        type: typeFilter,
      })

      const response = await fetch(`/api/discover?${params}`)
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login")
          return
        }
        throw new Error("Failed to fetch")
      }

      const data = await response.json() as { items: DiscoverFeedItem[]; hasMore: boolean }

      if (resetItems) {
        setItems(data.items)
      } else {
        setItems(prev => [...prev, ...data.items])
      }
      setHasMore(data.hasMore)
    } catch (error) {
      console.error("Failed to fetch discover items:", error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sort, typeFilter, router])

  // Fetch on mount and when filters change
  useEffect(() => {
    if (!authChecked) return
    setPage(1)
    fetchItems(1, true)
  }, [sort, typeFilter, authChecked, fetchItems])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchItems(nextPage, false)
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, page, fetchItems])

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-3xl mx-auto px-4 lg:px-6 py-6 sm:py-10 w-full pb-24 sm:pb-10">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 mb-4">
            <TrendingUp className="w-3.5 h-3.5 text-brand" />
            <span className="text-xs font-medium text-brand">Community Feed</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1.5">Discover</h1>
          <p className="text-white/45 text-sm sm:text-base">See what others are analyzing</p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Sort buttons */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            {SORT_OPTIONS.map(option => {
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  onClick={() => setSort(option.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    sort === option.value
                      ? "bg-brand/15 text-brand border border-brand/20"
                      : "text-white/40 hover:text-white/60"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {option.label}
                </button>
              )
            })}
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            {TYPE_OPTIONS.map(option => {
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  onClick={() => setTypeFilter(option.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    typeFilter === option.value
                      ? "bg-white/[0.1] text-white border border-white/[0.12]"
                      : "text-white/40 hover:text-white/60"
                  )}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-7 space-y-2">
                    <div className="h-7 bg-white/[0.06] rounded" />
                    <div className="h-4 bg-white/[0.06] rounded mx-auto w-4" />
                    <div className="h-7 bg-white/[0.06] rounded" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between">
                      <div className="h-5 bg-white/[0.06] rounded w-20" />
                      <div className="h-5 bg-white/[0.06] rounded w-10" />
                    </div>
                    <div className="h-5 bg-white/[0.06] rounded w-3/4" />
                    <div className="h-4 bg-white/[0.06] rounded w-full" />
                    <div className="h-4 bg-white/[0.06] rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item, index) => (
              <DiscoverCard
                key={item.id}
                item={item}
                index={index}
                isOwnContent={item.authorName !== null && currentUserId === item.id}
              />
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-4" />

            {loadingMore && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-brand animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 sm:py-20">
            <div className="inline-flex p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-4">
              <Sparkles className="w-8 h-8 text-white/20" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Nothing here yet</h2>
            <p className="text-white/40 text-sm max-w-md mx-auto">
              Content appears here when users publish their analyses to the feed.
              Analyze something and use the &quot;Publish to Feed&quot; toggle to share with the community.
            </p>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  )
}

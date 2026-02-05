/**
 * @module use-library
 * @description Infinite-scroll library data hook with search, filters, and sorting.
 *
 * Powers the `/library` page with paginated content loading using SWR Infinite.
 * Supports two distinct data paths:
 *   - **Browse mode** -- queries Supabase directly with server-side filtering
 *   - **Search mode** -- delegates to the `/api/search` full-text search endpoint
 *
 * Client-side post-processing handles score sorting, tag filtering, and
 * quality score range filtering since these require cross-table data that
 * cannot be efficiently filtered server-side.
 *
 * @see {@link lib/prefetch.ts} prefetchLibrary for cache warming
 * @see {@link app/api/search/route.ts} for the full-text search endpoint
 */

"use client"

import { useMemo, useCallback } from "react"
import useSWRInfinite from "swr/infinite"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

type ContentItem = Database["clarus"]["Tables"]["content"]["Row"]

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

/** A content item enriched with ratings, summaries, and library metadata. */
export type LibraryItem = ContentItem & {
  content_ratings: { signal_score: number | null }[]
  summaries: SummaryData | SummaryData[]
  is_bookmarked?: boolean
  tags?: string[]
  relevance?: number
}

interface ScoreFilterConfig {
  min: number
  max: number
}

interface UseLibraryOptions {
  userId: string | undefined
  searchQuery?: string
  filterType?: string
  sortBy?: string
  bookmarkOnly?: boolean
  selectedTags?: string[]
  scoreFilter?: ScoreFilterConfig | null
  pageSize?: number
}

const PAGE_SIZE = 20

// Use search API when there's a search query for full-text search
const searchFetcher = async (
  options: UseLibraryOptions,
  page: number
): Promise<{ items: LibraryItem[]; hasMore: boolean }> => {
  if (!options.userId || !options.searchQuery) return { items: [], hasMore: false }

  const pageSize = options.pageSize || PAGE_SIZE
  const offset = page * pageSize

  const params = new URLSearchParams({
    q: options.searchQuery,
    user_id: options.userId,
    limit: String(pageSize + 1), // Fetch one extra to check for more
    offset: String(offset),
  })

  if (options.filterType && options.filterType !== "all") {
    params.set("type", options.filterType)
  }

  const response = await fetch(`/api/search?${params}`)
  if (!response.ok) throw new Error("Search request failed")

  const data = await response.json()
  if (!data.success) throw new Error(data.error || "Search failed")

  // Transform search results to LibraryItem format
  const items: LibraryItem[] = data.results.map((result: {
    id: string
    title: string
    url: string
    type: string
    thumbnail_url: string | null
    date_added: string
    is_bookmarked: boolean
    tags: string[] | null
    brief_overview: string | null
    triage: SummaryData["triage"]
    relevance: number
  }) => ({
    id: result.id,
    title: result.title,
    url: result.url,
    type: result.type,
    thumbnail_url: result.thumbnail_url,
    date_added: result.date_added,
    is_bookmarked: result.is_bookmarked,
    tags: result.tags,
    content_ratings: [],
    summaries: {
      brief_overview: result.brief_overview,
      mid_length_summary: null,
      triage: result.triage,
    },
    relevance: result.relevance,
  }))

  // Apply client-side bookmark filter
  let filteredItems = options.bookmarkOnly
    ? items.filter((item) => item.is_bookmarked)
    : items

  // Apply client-side tag filter
  if (options.selectedTags && options.selectedTags.length > 0) {
    filteredItems = filteredItems.filter((item) => {
      const itemTags = item.tags || []
      return options.selectedTags!.some((tag) => itemTags.includes(tag))
    })
  }

  const hasMoreItems = data.results.length > pageSize

  return {
    items: hasMoreItems ? filteredItems.slice(0, pageSize) : filteredItems,
    hasMore: hasMoreItems,
  }
}

// Helper to extract quality score from a library item
function getQualityScore(item: LibraryItem): number | null {
  const summary = Array.isArray(item.summaries) ? item.summaries[0] : item.summaries
  return summary?.triage?.quality_score ?? null
}

// Regular fetcher for browsing without search
const browseFetcher = async (
  options: UseLibraryOptions,
  page: number
): Promise<{ items: LibraryItem[]; hasMore: boolean }> => {
  if (!options.userId) return { items: [], hasMore: false }

  const pageSize = options.pageSize || PAGE_SIZE
  const hasScoreFilter = options.scoreFilter && (options.scoreFilter.min > 0 || options.scoreFilter.max < 10)
  // Over-fetch when score filter is active to ensure enough results after filtering
  const fetchSize = hasScoreFilter ? pageSize * 3 : pageSize
  const offset = page * (hasScoreFilter ? pageSize * 3 : pageSize)

  let query = supabase
    .from("content")
    .select(`*, content_ratings(signal_score), summaries(brief_overview, mid_length_summary, triage), tags`)
    .eq("user_id", options.userId)

  if (options.filterType && options.filterType !== "all") {
    query = query.eq("type", options.filterType)
  }

  if (options.bookmarkOnly) {
    query = query.eq("is_bookmarked", true)
  }

  // Handle sorting
  if (options.sortBy === "date_asc") {
    query = query.order("date_added", { ascending: true })
  } else if (options.sortBy === "score_desc") {
    query = query.order("date_added", { ascending: false })
  } else {
    query = query.order("date_added", { ascending: false })
  }

  // Apply pagination - fetch one extra to check if more exist
  query = query.range(offset, offset + fetchSize)

  const { data, error } = await query

  if (error) throw error
  if (!data) return { items: [], hasMore: false }

  let sortedData = data as LibraryItem[]

  // Client-side sort for ratings and quality score
  if (options.sortBy === "rating_desc") {
    sortedData = sortedData.sort((a, b) => {
      const ratingA = a.content_ratings?.[0]?.signal_score ?? -1
      const ratingB = b.content_ratings?.[0]?.signal_score ?? -1
      return ratingB - ratingA
    })
  } else if (options.sortBy === "rating_asc") {
    sortedData = sortedData.sort((a, b) => {
      const ratingA = a.content_ratings?.[0]?.signal_score ?? 999
      const ratingB = b.content_ratings?.[0]?.signal_score ?? 999
      return ratingA - ratingB
    })
  } else if (options.sortBy === "score_desc") {
    sortedData = sortedData.sort((a, b) => {
      return (getQualityScore(b) ?? -1) - (getQualityScore(a) ?? -1)
    })
  }

  // Apply score filter in the fetcher so pagination accounts for it
  if (hasScoreFilter && options.scoreFilter) {
    const { min, max } = options.scoreFilter
    sortedData = sortedData.filter((item) => {
      const score = getQualityScore(item)
      if (score === null) return false
      return score >= min && score <= max
    })
  }

  // Client-side filter for tags
  if (options.selectedTags && options.selectedTags.length > 0) {
    sortedData = sortedData.filter((item) => {
      const itemTags = item.tags || []
      return options.selectedTags!.some((tag) => itemTags.includes(tag))
    })
  }

  // Check if we got more items than requested (indicates more exist)
  const hasMoreItems = sortedData.length > pageSize

  // Return only pageSize items
  return {
    items: sortedData.slice(0, pageSize),
    hasMore: hasMoreItems,
  }
}

// Main fetcher that chooses between search and browse
const fetcher = async (
  options: UseLibraryOptions,
  page: number
): Promise<{ items: LibraryItem[]; hasMore: boolean }> => {
  // Use search fetcher when there's a search query
  if (options.searchQuery && options.searchQuery.trim().length > 0) {
    return searchFetcher(options, page)
  }
  // Otherwise use regular browse fetcher
  return browseFetcher(options, page)
}

/**
 * Provides paginated, filterable, sortable access to the user's content library.
 *
 * Internally uses SWR Infinite for cursor-based pagination with automatic
 * deduplication and background revalidation. Cache keys encode all filter
 * and sort parameters so changing filters triggers fresh data fetching.
 *
 * @param options - Filtering, sorting, and pagination configuration
 * @returns Library items, loading states, pagination controls, and a refresh function
 *
 * @example
 * ```tsx
 * const { items, isLoading, hasMore, loadMore } = useLibrary({
 *   userId: user.id,
 *   filterType: "article",
 *   sortBy: "date_desc",
 * })
 * ```
 */
export function useLibrary(options: UseLibraryOptions) {
  // Memoize key prefix to prevent SWR cache misses from recreated strings
  const keyPrefix = useMemo(() => [
    "library",
    options.userId,
    options.searchQuery || "",
    options.filterType || "all",
    options.sortBy || "date_desc",
    options.bookmarkOnly ? "bookmarked" : "",
    (options.selectedTags || []).join(","),
    options.scoreFilter ? `${options.scoreFilter.min}-${options.scoreFilter.max}` : "",
  ].join(":"), [options.userId, options.searchQuery, options.filterType, options.sortBy, options.bookmarkOnly, options.selectedTags, options.scoreFilter])

  const getKey = useCallback((pageIndex: number, previousPageData: { items: LibraryItem[]; hasMore: boolean } | null) => {
    if (!options.userId) return null
    if (previousPageData && previousPageData.items.length === 0) return null
    return `${keyPrefix}:${pageIndex}`
  }, [options.userId, keyPrefix])

  const { data, error, isLoading, size, setSize, mutate } = useSWRInfinite(
    getKey,
    (key) => {
      const pageIndex = parseInt(key.split(":").pop() || "0")
      return fetcher(options, pageIndex)
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
      revalidateFirstPage: false,
      persistSize: true,
    }
  )

  // Flatten all pages into a single array - memoized to prevent infinite re-renders
  const items = useMemo(() => {
    return data ? data.flatMap((page) => page.items) : []
  }, [data])

  // Check if there are more items to load (use hasMore flag from last page)
  const hasMore = useMemo(() => {
    return data && data.length > 0 ? data[data.length - 1]?.hasMore ?? false : false
  }, [data])

  // Loading more (not initial load)
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === "undefined")

  return {
    items,
    isLoading: isLoading && !data,
    isLoadingMore,
    error,
    hasMore,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  }
}

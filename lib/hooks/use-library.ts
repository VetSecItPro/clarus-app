"use client"

import { useMemo } from "react"
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

export type LibraryItem = ContentItem & {
  content_ratings: { signal_score: number | null }[]
  summaries: SummaryData | SummaryData[]
  is_bookmarked?: boolean
  tags?: string[]
  relevance?: number
}

interface UseLibraryOptions {
  userId: string | undefined
  searchQuery?: string
  filterType?: string
  sortBy?: string
  bookmarkOnly?: boolean
  selectedTags?: string[]
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

// Regular fetcher for browsing without search
const browseFetcher = async (
  options: UseLibraryOptions,
  page: number
): Promise<{ items: LibraryItem[]; hasMore: boolean }> => {
  if (!options.userId) return { items: [], hasMore: false }

  const pageSize = options.pageSize || PAGE_SIZE
  const offset = page * pageSize

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
    // Sort by quality score (stored in summaries.triage.quality_score)
    // Fall back to date for now since jsonb sorting is complex
    query = query.order("date_added", { ascending: false })
  } else {
    query = query.order("date_added", { ascending: false })
  }

  // Apply pagination - fetch one extra to check if more exist
  query = query.range(offset, offset + pageSize)

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
      const getScore = (item: LibraryItem) => {
        const summary = Array.isArray(item.summaries) ? item.summaries[0] : item.summaries
        return summary?.triage?.quality_score ?? -1
      }
      return getScore(b) - getScore(a)
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
  const hasMoreItems = data.length > pageSize

  // Return only pageSize items, keep the extra one just for hasMore check
  return {
    items: hasMoreItems ? sortedData.slice(0, pageSize) : sortedData,
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

export function useLibrary(options: UseLibraryOptions) {
  const getKey = (pageIndex: number, previousPageData: { items: LibraryItem[]; hasMore: boolean } | null) => {
    if (!options.userId) return null
    // If previous page returned no items, don't fetch more
    if (previousPageData && previousPageData.items.length === 0) return null

    return [
      "library",
      options.userId,
      options.searchQuery || "",
      options.filterType || "all",
      options.sortBy || "date_desc",
      options.bookmarkOnly ? "bookmarked" : "",
      (options.selectedTags || []).join(","),
      pageIndex,
    ].join(":")
  }

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

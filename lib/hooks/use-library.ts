"use client"

import { useMemo } from "react"
import useSWRInfinite from "swr/infinite"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

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

export type LibraryItem = ContentItem & {
  content_ratings: { signal_score: number | null }[]
  summaries: SummaryData | SummaryData[]
  is_bookmarked?: boolean
  tags?: string[]
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

const fetcher = async (
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

  if (options.searchQuery) {
    query = query.or(`title.ilike.%${options.searchQuery}%,full_text.ilike.%${options.searchQuery}%`)
  }

  if (options.filterType && options.filterType !== "all") {
    query = query.eq("type", options.filterType)
  }

  if (options.bookmarkOnly) {
    query = query.eq("is_bookmarked", true)
  }

  // Handle sorting
  if (options.sortBy === "date_asc") {
    query = query.order("date_added", { ascending: true })
  } else {
    query = query.order("date_added", { ascending: false })
  }

  // Apply pagination - fetch one extra to check if more exist
  query = query.range(offset, offset + pageSize)

  const { data, error } = await query

  if (error) throw error
  if (!data) return { items: [], hasMore: false }

  let sortedData = data as LibraryItem[]

  // Client-side sort for ratings (only works properly for single page, but rating sort is less common)
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

export function useLibrary(options: UseLibraryOptions) {
  const pageSize = options.pageSize || PAGE_SIZE

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

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite(
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

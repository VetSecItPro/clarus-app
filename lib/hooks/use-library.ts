"use client"

import useSWR from "swr"
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
}

const fetcher = async (options: UseLibraryOptions): Promise<LibraryItem[]> => {
  if (!options.userId) return []

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

  const { data, error } = await query

  if (error) throw error

  let sortedData = data as LibraryItem[]

  // Client-side sort for ratings
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

  return sortedData
}

export function useLibrary(options: UseLibraryOptions) {
  const cacheKey = options.userId
    ? [
        "library",
        options.userId,
        options.searchQuery || "",
        options.filterType || "all",
        options.sortBy || "date_desc",
        options.bookmarkOnly ? "bookmarked" : "",
        (options.selectedTags || []).join(","),
      ].join(":")
    : null

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    () => fetcher(options),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
      keepPreviousData: true, // Keep showing old data while loading new
    }
  )

  return {
    items: data || [],
    isLoading,
    error,
    refresh: mutate,
  }
}

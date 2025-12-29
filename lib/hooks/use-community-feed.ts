"use client"

import useSWR from "swr"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

type SummaryData = {
  brief_overview: string | null
  triage: {
    quality_score?: number
    signal_noise_score?: number
    one_liner?: string
  } | null
}

type FeedItemFromDb = Database["public"]["Tables"]["content"]["Row"] & {
  users: { name: string | null; email: string | null } | null
  content_ratings: { signal_score: number | null; user_id: string; created_at: string }[]
  summaries: SummaryData | SummaryData[]
}

export type FeedItem = FeedItemFromDb & {
  ratingScore: number
  ratingSource: "ai" | "user"
}

interface UseCommunityFeedOptions {
  userId: string | undefined
  searchQuery?: string
  filterType?: string
  sortBy?: string
}

const fetcher = async (options: UseCommunityFeedOptions): Promise<FeedItem[]> => {
  if (!options.userId) return []

  let query = supabase
    .from("content")
    .select(
      `*, users:user_id(name, email), content_ratings(signal_score, user_id, created_at), summaries(brief_overview, triage)`,
    )
    .not("user_id", "eq", options.userId)
    .not("summaries", "is", "null")

  if (options.searchQuery) {
    query = query.or(`title.ilike.%${options.searchQuery}%,full_text.ilike.%${options.searchQuery}%`)
  }

  if (options.filterType && options.filterType !== "all") {
    query = query.eq("type", options.filterType)
  }

  // Handle sorting
  if (options.sortBy === "date_added_asc") {
    query = query.order("date_added", { ascending: true })
  } else {
    query = query.order("date_added", { ascending: false })
  }

  const { data, error } = await query.returns<FeedItemFromDb[]>()

  if (error) throw error

  let processed = (data || [])
    .map((item) => {
      // Get user rating if exists
      const userRating = item.content_ratings?.find((r) => r.user_id === item.user_id)
      const userScore = userRating?.signal_score ?? null

      // Get AI rating from triage
      const summaryData = Array.isArray(item.summaries) ? item.summaries[0] : item.summaries
      const aiScore = summaryData?.triage?.signal_noise_score ?? null

      // Use user rating if available, otherwise fall back to AI rating
      const ratingScore = userScore ?? aiScore
      const ratingSource: "ai" | "user" = userScore !== null ? "user" : "ai"

      return {
        ...item,
        ratingScore: ratingScore!,
        ratingSource,
      }
    })
    .filter((item): item is FeedItem => item.ratingScore !== null && item.ratingScore > 0)

  // Client-side sort for ratings
  if (options.sortBy === "rating_desc") {
    processed = processed.sort((a, b) => b.ratingScore - a.ratingScore)
  } else if (options.sortBy === "rating_asc") {
    processed = processed.sort((a, b) => a.ratingScore - b.ratingScore)
  }

  return processed
}

export function useCommunityFeed(options: UseCommunityFeedOptions) {
  const cacheKey = options.userId
    ? [
        "community",
        options.userId,
        options.searchQuery || "",
        options.filterType || "all",
        options.sortBy || "date_added_desc",
      ].join(":")
    : null

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    () => fetcher(options),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
      keepPreviousData: true,
    }
  )

  return {
    items: data || [],
    isLoading,
    error,
    refresh: mutate,
  }
}

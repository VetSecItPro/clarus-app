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

type FeedItemFromDb = Database["clarus"]["Tables"]["content"]["Row"] & {
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

  // Build content query
  let contentQuery = supabase
    .from("content")
    .select(
      `*, users:user_id(name, email), content_ratings(signal_score, user_id, created_at), summaries(brief_overview, triage)`,
    )
    .not("user_id", "eq", options.userId)
    .not("summaries", "is", "null")

  if (options.searchQuery) {
    contentQuery = contentQuery.or(`title.ilike.%${options.searchQuery}%,full_text.ilike.%${options.searchQuery}%`)
  }

  if (options.filterType && options.filterType !== "all") {
    contentQuery = contentQuery.eq("type", options.filterType)
  }

  // Handle sorting
  if (options.sortBy === "date_added_asc") {
    contentQuery = contentQuery.order("date_added", { ascending: true })
  } else {
    contentQuery = contentQuery.order("date_added", { ascending: false })
  }

  // Run both queries in parallel for better performance
  const [hiddenResult, contentResult] = await Promise.all([
    supabase
      .from("hidden_content")
      .select("content_id")
      .eq("user_id", options.userId),
    contentQuery.returns<FeedItemFromDb[]>()
  ])

  const hiddenIds = new Set((hiddenResult.data || []).map((h) => h.content_id))

  if (contentResult.error) throw contentResult.error
  const data = contentResult.data

  // Filter out hidden content
  const visibleData = (data || []).filter((item) => !hiddenIds.has(item.id))

  let processed = visibleData
    .map((item) => {
      // Get user rating if exists
      const userRating = item.content_ratings?.find((r) => r.user_id === item.user_id)
      const userScore = userRating?.signal_score ?? null

      // Get AI rating from triage - use quality_score as primary (1-10 scale)
      const summaryData = Array.isArray(item.summaries) ? item.summaries[0] : item.summaries
      const qualityScore = summaryData?.triage?.quality_score ?? null
      const signalScore = summaryData?.triage?.signal_noise_score ?? null

      // Use user rating first, then quality_score, then signal_noise_score
      const aiScore = qualityScore ?? signalScore
      const ratingScore = userScore ?? aiScore
      const ratingSource: "ai" | "user" = userScore !== null ? "user" : "ai"

      return {
        ...item,
        ratingScore: ratingScore ?? 0,
        ratingSource,
      } as FeedItem
    })

  // Client-side sort for ratings
  if (options.sortBy === "rating_desc") {
    processed = processed.sort((a, b) => b.ratingScore - a.ratingScore)
  } else if (options.sortBy === "rating_asc") {
    processed = processed.sort((a, b) => a.ratingScore - b.ratingScore)
  }

  return processed
}

export function useCommunityFeed(options: UseCommunityFeedOptions) {
  // Track if we're waiting for userId to be available (session loading)
  const isWaitingForSession = !options.userId

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
      dedupingInterval: 30000, // Dedupe requests within 30 seconds
      keepPreviousData: true,
      revalidateIfStale: false, // Don't revalidate on mount if data exists
      refreshInterval: 60000, // Background refresh every 60 seconds
    }
  )

  return {
    items: data || [],
    // Show loading state if waiting for session OR if SWR is fetching
    isLoading: isWaitingForSession || isLoading,
    error,
    refresh: mutate,
  }
}

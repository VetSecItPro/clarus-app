"use client"

import { useEffect } from "react"
import { preload } from "swr"
import { supabase } from "@/lib/supabase"

// Helper to add timeout to promises
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Prefetch timeout")), ms)
  })
  return Promise.race([promise, timeout])
}

// Prefetch key data on app mount to make navigation feel instant
export function PrefetchData({ userId }: { userId: string | undefined }) {
  useEffect(() => {
    if (!userId) return

    // Delay prefetching slightly to not block initial render
    const timer = setTimeout(async () => {
      // Prefetch library data (first page) - wrapped in try-catch
      try {
        const libraryKey = `library:${userId}::all:date_desc::0`
        preload(libraryKey, async () => {
          const query = supabase
            .from("content")
            .select(`*, content_ratings(signal_score), summaries(brief_overview, mid_length_summary, triage), tags`)
            .eq("user_id", userId)
            .order("date_added", { ascending: false })
            .range(0, 20)

          const { data } = await withTimeout(Promise.resolve(query), 5000)
          return { items: data || [], hasMore: (data?.length || 0) > 20 }
        })
      } catch (err) {
        // Silently fail - prefetch is optional
        console.debug("Library prefetch failed:", err)
      }

      // Prefetch community feed - wrapped in try-catch
      try {
        const communityKey = `community:${userId}::all:date_added_desc`
        preload(communityKey, async () => {
          const hiddenQuery = supabase
            .from("hidden_content")
            .select("content_id")
            .eq("user_id", userId)

          const contentQuery = supabase
            .from("content")
            .select(`*, users:user_id(name, email), content_ratings(signal_score, user_id, created_at), summaries(brief_overview, triage)`)
            .not("user_id", "eq", userId)
            .not("summaries", "is", "null")
            .order("date_added", { ascending: false })

          const [hiddenResult, contentResult] = await withTimeout(
            Promise.all([Promise.resolve(hiddenQuery), Promise.resolve(contentQuery)]),
            5000
          )

          const hiddenIds = new Set((hiddenResult.data || []).map((h) => h.content_id))
          const data = contentResult.data || []

          return data
            .filter((item: any) => !hiddenIds.has(item.id))
            .map((item: any) => {
              const summaryData = Array.isArray(item.summaries) ? item.summaries[0] : item.summaries
              const triage = summaryData?.triage as { quality_score?: number } | null
              const qualityScore = triage?.quality_score ?? null
              return {
                ...item,
                ratingScore: qualityScore ?? 0,
                ratingSource: "ai" as const,
              }
            })
        })
      } catch (err) {
        // Silently fail - prefetch is optional
        console.debug("Community prefetch failed:", err)
      }
    }, 500) // Wait 500ms after mount to prefetch

    return () => clearTimeout(timer)
  }, [userId])

  return null
}

"use client"

import { useEffect } from "react"
import { preload } from "swr"
import { supabase } from "@/lib/supabase"

// Prefetch key data on app mount to make navigation feel instant
export function PrefetchData({ userId }: { userId: string | undefined }) {
  useEffect(() => {
    if (!userId) return

    // Delay prefetching slightly to not block initial render
    const timer = setTimeout(() => {
      // Prefetch library data (first page)
      const libraryKey = `library:${userId}::all:date_desc::0`
      preload(libraryKey, async () => {
        const { data } = await supabase
          .from("content")
          .select(`*, content_ratings(signal_score), summaries(brief_overview, mid_length_summary, triage), tags`)
          .eq("user_id", userId)
          .order("date_added", { ascending: false })
          .range(0, 20)
        return { items: data || [], hasMore: (data?.length || 0) > 20 }
      })

      // Prefetch community feed
      const communityKey = `community:${userId}::all:date_added_desc`
      preload(communityKey, async () => {
        const [hiddenResult, contentResult] = await Promise.all([
          supabase
            .from("hidden_content")
            .select("content_id")
            .eq("user_id", userId),
          supabase
            .from("content")
            .select(`*, users:user_id(name, email), content_ratings(signal_score, user_id, created_at), summaries(brief_overview, triage)`)
            .not("user_id", "eq", userId)
            .not("summaries", "is", "null")
            .order("date_added", { ascending: false })
        ])

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
    }, 500) // Wait 500ms after mount to prefetch

    return () => clearTimeout(timer)
  }, [userId])

  return null
}

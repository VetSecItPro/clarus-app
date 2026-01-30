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
      // Prefetch library data (first page)
      const libraryKey = `library:${userId}::all:date_desc::0`
      preload(libraryKey, async () => {
        try {
          const query = supabase
            .from("content")
            .select(`*, content_ratings(signal_score), summaries(brief_overview, mid_length_summary, triage), tags`)
            .eq("user_id", userId)
            .order("date_added", { ascending: false })
            .range(0, 20)

          const { data } = await withTimeout(Promise.resolve(query), 5000)
          return { items: data || [], hasMore: (data?.length || 0) > 20 }
        } catch (err) {
          console.debug("Library prefetch failed:", err)
          return { items: [], hasMore: false }
        }
      })
    }, 500)

    return () => clearTimeout(timer)
  }, [userId])

  return null
}

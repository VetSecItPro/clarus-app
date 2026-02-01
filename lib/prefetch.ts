/**
 * Prefetch utilities for blazing fast navigation
 *
 * These utilities help pre-load data before the user navigates,
 * making page transitions feel instant.
 */

import { mutate } from "swr"
import { supabase } from "@/lib/supabase"

// Track which content has been prefetched to avoid duplicate requests
const prefetchedContent = new Set<string>()

/**
 * Prefetch content data for a specific content ID.
 * This loads the content into SWR cache before navigation.
 */
export async function prefetchContent(contentId: string): Promise<void> {
  // Skip if already prefetched
  if (prefetchedContent.has(contentId)) return
  prefetchedContent.add(contentId)

  try {
    // Fetch content data and populate SWR cache
    const { data: content } = await supabase
      .from("content")
      .select(`
        id, title, url, type, thumbnail_url, date_added, user_id, author,
        is_bookmarked, tags, detected_tone, full_text,
        summaries(id, content_id, processing_status, brief_overview, mid_length_summary, detailed_summary, triage, truth_check, action_items, key_takeaways)
      `)
      .eq("id", contentId)
      .single()

    if (content) {
      // Populate the content-status cache key used by useChatSession
      mutate(`content-status:${contentId}`, content, { revalidate: false })
    }
  } catch {
    // Silently fail - prefetch is an optimization, not critical
    console.debug("Prefetch failed for content:", contentId)
  }
}

/**
 * Prefetch library items for a user.
 * Called when navigating to the library page.
 */
export async function prefetchLibrary(userId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from("content")
      .select(`*, content_ratings(signal_score), summaries(brief_overview, mid_length_summary, triage), tags`)
      .eq("user_id", userId)
      .order("date_added", { ascending: false })
      .limit(20)

    if (data) {
      // Populate the library cache
      const cacheKey = `library:${userId}::all:date_desc::0`
      mutate(cacheKey, { items: data, hasMore: data.length >= 20 }, { revalidate: false })
    }
  } catch {
    console.debug("Prefetch failed for library")
  }
}

/**
 * Clear prefetch cache when user logs out
 */
export function clearPrefetchCache(): void {
  prefetchedContent.clear()
}

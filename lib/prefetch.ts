/**
 * @module prefetch
 * @description SWR cache prefetch utilities for instant page transitions.
 *
 * Pre-loads content and library data into the SWR cache before the user
 * navigates, so the destination page renders immediately from cache
 * rather than showing a loading skeleton.
 *
 * Tracks previously prefetched content IDs in a bounded `Set` (max 200)
 * to avoid duplicate Supabase queries. The set is cleared when it reaches
 * capacity or when the user logs out.
 *
 * @see {@link lib/hooks/use-library.ts} for the library data hook that reads from cache
 * @see {@link lib/hooks/use-chat-session.ts} for the chat session that reads content status
 */

import { mutate } from "swr"
import { supabase } from "@/lib/supabase"

/** Maximum number of content IDs to track before clearing the prefetch cache. */
const MAX_PREFETCH_CACHE_SIZE = 200
const prefetchedContent = new Set<string>()

/**
 * Prefetches a single content item and its summary into the SWR cache.
 *
 * Skips the fetch if the content was already prefetched. Clears the
 * tracking set when it reaches {@link MAX_PREFETCH_CACHE_SIZE} to
 * prevent unbounded memory growth.
 *
 * Failures are silently caught -- prefetching is an optimization,
 * not a requirement. The page will fetch the data normally on mount.
 *
 * @param contentId - The UUID of the content item to prefetch
 */
export async function prefetchContent(contentId: string): Promise<void> {
  // Skip if already prefetched
  if (prefetchedContent.has(contentId)) return
  // Prevent unbounded growth of the tracking set
  if (prefetchedContent.size >= MAX_PREFETCH_CACHE_SIZE) {
    prefetchedContent.clear()
  }
  prefetchedContent.add(contentId)

  try {
    // Fetch content data and populate SWR cache
    const { data: content } = await supabase
      .from("content")
      .select(`
        id, title, url, type, thumbnail_url, date_added, user_id, author,
        is_bookmarked, tags, detected_tone, full_text,
        summaries(id, content_id, processing_status, brief_overview, mid_length_summary, detailed_summary, triage, truth_check, action_items)
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
 * Prefetches the first page of a user's library into the SWR cache.
 *
 * Called when the user hovers or begins navigating to the library page.
 * Populates the default library cache key (no filters, date descending,
 * page 0) so the initial render is instant.
 *
 * @param userId - The UUID of the user whose library to prefetch
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


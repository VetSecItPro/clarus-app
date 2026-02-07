/**
 * @module api/usage
 * @description Returns the authenticated user's current usage counters and tier limits.
 *
 * GET — Returns usage for the current billing period, tier info, and reset date.
 * Used by the /dashboard page to render usage progress bars.
 */

import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth"
import { getUserTier, getUsageCounts } from "@/lib/usage"
import { TIER_LIMITS, getCurrentPeriod } from "@/lib/tier-limits"

export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  const [tier, counts, libraryResult, bookmarkResult] = await Promise.all([
    getUserTier(supabase, user.id),
    getUsageCounts(supabase, user.id),
    supabase
      .from("content")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("content")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_bookmarked", true),
  ])

  const limits = TIER_LIMITS[tier]
  const period = getCurrentPeriod()

  // Calculate reset date (first day of next month, UTC)
  const [yearStr, monthStr] = period.split("-")
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const resetDate = new Date(Date.UTC(
    month === 12 ? year + 1 : year,
    month === 12 ? 0 : month,
    1
  )).toISOString()

  const usage = {
    analyses: { used: counts.analyses_count, limit: limits.analyses },
    podcastAnalyses: { used: counts.podcast_analyses_count, limit: limits.podcastAnalyses },
    chatMessages: { used: counts.chat_messages_count, limit: limits.chatMessagesMonthly },
    libraryItems: { used: libraryResult.count ?? 0, limit: limits.library },
    exports: { used: counts.exports_count, limit: limits.exports },
    shareLinks: { used: counts.share_links_count, limit: limits.shareLinks },
    bookmarks: { used: bookmarkResult.count ?? 0, limit: limits.bookmarks },
  }

  return NextResponse.json(
    { tier, period, resetDate, usage },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
  )
}

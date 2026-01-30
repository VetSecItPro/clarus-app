/**
 * Usage tracking utilities
 * Server-side functions to check and increment usage counters
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, UserTier } from "@/types/database.types"
import { getCurrentPeriod, getLimitForField, normalizeTier } from "./tier-limits"
import type { UsageField } from "./tier-limits"

interface UsageCounts {
  analyses_count: number
  chat_messages_count: number
  share_links_count: number
  exports_count: number
  bookmarks_count: number
}

interface UsageCheckResult {
  allowed: boolean
  currentCount: number
  limit: number
  tier: UserTier
}

/**
 * Get the user's current tier from the database
 */
export async function getUserTier(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserTier> {
  const { data } = await supabase
    .from("users")
    .select("tier")
    .eq("id", userId)
    .single()

  return normalizeTier(data?.tier)
}

/**
 * Get usage counts for the current period
 */
export async function getUsageCounts(
  supabase: SupabaseClient<Database>,
  userId: string,
  period?: string
): Promise<UsageCounts> {
  const currentPeriod = period ?? getCurrentPeriod()

  const { data } = await supabase
    .from("usage_tracking")
    .select("analyses_count, chat_messages_count, share_links_count, exports_count, bookmarks_count")
    .eq("user_id", userId)
    .eq("period", currentPeriod)
    .single()

  return {
    analyses_count: data?.analyses_count ?? 0,
    chat_messages_count: data?.chat_messages_count ?? 0,
    share_links_count: data?.share_links_count ?? 0,
    exports_count: data?.exports_count ?? 0,
    bookmarks_count: data?.bookmarks_count ?? 0,
  }
}

/**
 * Check if a user can perform an action based on their tier and current usage.
 * Does NOT increment — use this for pre-flight checks.
 */
export async function checkUsageLimit(
  supabase: SupabaseClient<Database>,
  userId: string,
  field: UsageField
): Promise<UsageCheckResult> {
  const [tier, counts] = await Promise.all([
    getUserTier(supabase, userId),
    getUsageCounts(supabase, userId),
  ])

  const limit = getLimitForField(tier, field)
  const currentCount = counts[field]

  return {
    allowed: currentCount < limit,
    currentCount,
    limit,
    tier,
  }
}

/**
 * Increment a usage counter atomically using the database function.
 * Returns the new count, or null if the increment failed.
 * Call this AFTER the action succeeds (not before).
 */
export async function incrementUsage(
  supabase: SupabaseClient<Database>,
  userId: string,
  field: UsageField
): Promise<number | null> {
  const period = getCurrentPeriod()

  const { data, error } = await supabase.rpc("increment_usage", {
    p_user_id: userId,
    p_period: period,
    p_field: field,
  })

  if (error) {
    console.error("[usage] Failed to increment usage:", error.message)
    return null
  }

  return data
}

/**
 * Combined check-and-gate: checks the limit, returns an error message if exceeded.
 * Use this in API routes for a one-call pattern.
 */
export async function enforceUsageLimit(
  supabase: SupabaseClient<Database>,
  userId: string,
  field: UsageField
): Promise<{ allowed: true; tier: UserTier } | { allowed: false; tier: UserTier; limit: number; currentCount: number }> {
  const result = await checkUsageLimit(supabase, userId, field)

  if (result.allowed) {
    return { allowed: true, tier: result.tier }
  }

  return {
    allowed: false,
    tier: result.tier,
    limit: result.limit,
    currentCount: result.currentCount,
  }
}

/**
 * @module usage
 * @description Server-side usage tracking and limit enforcement.
 *
 * Provides functions to read a user's current tier, fetch monthly usage
 * counters, check whether an action is within limits, and atomically
 * increment counters after an action succeeds.
 *
 * The increment is performed via the `increment_usage` Postgres RPC
 * to ensure atomicity under concurrent requests.
 *
 * @see {@link lib/tier-limits.ts} for tier definitions and limit values
 * @see {@link lib/api-usage.ts} for external API cost tracking (different concern)
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
  podcast_analyses_count: number
}

interface UsageCheckResult {
  allowed: boolean
  currentCount: number
  limit: number
  tier: UserTier
}

/**
 * Fetches the user's effective subscription tier from the database.
 *
 * Handles day-pass expiration by falling back to `"free"` when the
 * pass has expired.
 *
 * @param supabase - An authenticated Supabase client
 * @param userId - The user ID to look up
 * @returns The user's effective {@link UserTier}
 */
export async function getUserTier(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserTier> {
  const { data } = await supabase
    .from("users")
    .select("tier, day_pass_expires_at")
    .eq("id", userId)
    .single()

  return normalizeTier(data?.tier, data?.day_pass_expires_at)
}

/**
 * Fetches the user's usage counters for the current (or specified) billing period.
 *
 * Returns zero for all fields if no `usage_tracking` row exists yet
 * (i.e., the user has not performed any actions this period).
 *
 * @param supabase - An authenticated Supabase client
 * @param userId - The user ID to look up
 * @param period - Optional period override in `YYYY-MM` format (defaults to current month)
 * @returns An object with all usage counter values
 */
export async function getUsageCounts(
  supabase: SupabaseClient<Database>,
  userId: string,
  period?: string
): Promise<UsageCounts> {
  const currentPeriod = period ?? getCurrentPeriod()

  const { data } = await supabase
    .from("usage_tracking")
    .select("analyses_count, chat_messages_count, share_links_count, exports_count, bookmarks_count, podcast_analyses_count")
    .eq("user_id", userId)
    .eq("period", currentPeriod)
    .single()

  return {
    analyses_count: data?.analyses_count ?? 0,
    chat_messages_count: data?.chat_messages_count ?? 0,
    share_links_count: data?.share_links_count ?? 0,
    exports_count: data?.exports_count ?? 0,
    bookmarks_count: data?.bookmarks_count ?? 0,
    podcast_analyses_count: data?.podcast_analyses_count ?? 0,
  }
}

/**
 * Pre-flight check: determines whether a user can perform an action
 * based on their tier and current usage. Does **not** increment the counter.
 *
 * @param supabase - An authenticated Supabase client
 * @param userId - The user ID to check
 * @param field - The usage counter field to check
 * @returns A {@link UsageCheckResult} indicating whether the action is allowed
 *
 * @see {@link enforceUsageLimit} for a convenience wrapper
 * @see {@link incrementUsage} for the post-action increment
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
 * Atomically increments a usage counter via the `increment_usage` Postgres RPC.
 *
 * Call this **after** the action succeeds (not before) to avoid counting
 * failed attempts. The RPC handles upsert logic for the `usage_tracking`
 * row, creating it if this is the user's first action in the period.
 *
 * @param supabase - An authenticated Supabase client
 * @param userId - The user ID whose counter to increment
 * @param field - The usage counter field to increment
 * @returns The new counter value, or `null` if the increment failed
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
 * Combined check-and-gate: verifies the limit and returns a typed result
 * that API routes can use to either proceed or return a 403.
 *
 * **Concurrency note (TOCTOU):** The check and the subsequent increment
 * (via {@link incrementUsage}) are separate operations. Under high
 * concurrency, a user could slightly exceed their limit by 1--2 requests.
 * This is acceptable because the increment itself is atomic via the
 * `increment_usage` RPC, so no data corruption occurs.
 *
 * @param supabase - An authenticated Supabase client
 * @param userId - The user ID to gate
 * @param field - The usage counter field to check
 * @returns `{ allowed: true, tier }` or `{ allowed: false, tier, limit, currentCount }`
 *
 * @example
 * ```ts
 * const gate = await enforceUsageLimit(supabase, userId, "analyses_count")
 * if (!gate.allowed) {
 *   return NextResponse.json(
 *     { error: `You've used ${gate.currentCount}/${gate.limit} analyses this month.` },
 *     { status: 403 }
 *   )
 * }
 * ```
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

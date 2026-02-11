/**
 * @module usage
 * @description Server-side usage tracking and limit enforcement.
 *
 * Provides functions to read a user's current tier, fetch monthly usage
 * counters, check whether an action is within limits, and atomically
 * increment counters after an action succeeds.
 *
 * The preferred function is {@link enforceAndIncrementUsage} which
 * atomically checks AND increments in a single Postgres operation,
 * eliminating TOCTOU race conditions. Legacy two-step functions
 * ({@link enforceUsageLimit} + {@link incrementUsage}) are retained
 * for read-only checks and backward compatibility.
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
/** Human-readable labels for usage fields (used in warning messages). */
const FIELD_LABELS: Record<UsageField, string> = {
  analyses_count: "analyses",
  chat_messages_count: "chat messages",
  share_links_count: "share links",
  exports_count: "exports",
  bookmarks_count: "bookmarks",
  podcast_analyses_count: "podcast analyses",
}

export interface UsageWarning {
  field: string
  used: number
  limit: number
  message: string
}

/**
 * Returns a warning message if usage has crossed a threshold after increment.
 *
 * Call this after {@link incrementUsage} succeeds. API routes can include the
 * returned warning in their response for the client to display as a toast.
 *
 * @param newCount - The new counter value after increment
 * @param limit - The tier limit for this field
 * @param field - The usage field (for the human-readable label)
 * @returns A warning object if at 80%+ usage, or `null` if below threshold
 */
export function getUsageWarning(
  newCount: number,
  limit: number,
  field: UsageField
): UsageWarning | null {
  if (limit <= 0) return null

  const percentage = (newCount / limit) * 100
  const label = FIELD_LABELS[field]

  if (newCount >= limit) {
    return {
      field: label,
      used: newCount,
      limit,
      message: `You've reached your ${label} limit for this month (${newCount}/${limit}). Upgrade for more.`,
    }
  }

  if (percentage >= 90) {
    return {
      field: label,
      used: newCount,
      limit,
      message: `You've used ${newCount} of ${limit} ${label} this month.`,
    }
  }

  if (percentage >= 80) {
    return {
      field: label,
      used: newCount,
      limit,
      message: `You're approaching your ${label} limit (${newCount}/${limit}).`,
    }
  }

  return null
}

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

/**
 * Atomically checks usage limit AND increments the counter in a single
 * Postgres operation. Eliminates the TOCTOU race condition where two
 * concurrent requests could both pass the check before either increments.
 *
 * Uses the `increment_usage_if_allowed` RPC which performs:
 *   `UPDATE ... SET count = count + 1 WHERE count < limit`
 * If the WHERE clause fails (at limit), zero rows update and it returns -1.
 *
 * **Trade-off:** The counter is incremented at check time, not after the
 * action succeeds. If the action fails, the user loses one credit. This is
 * acceptable because: (1) action failures are rare (simple DB writes), and
 * (2) the security benefit of eliminating limit bypass outweighs the rare
 * credit loss.
 *
 * @param supabase - An authenticated Supabase client (service role)
 * @param userId - The user ID to gate and increment
 * @param field - The usage counter field
 * @returns `{ allowed: true, tier, newCount, limit }` or `{ allowed: false, tier, limit }`
 */
export async function enforceAndIncrementUsage(
  supabase: SupabaseClient<Database>,
  userId: string,
  field: UsageField
): Promise<
  | { allowed: true; tier: UserTier; newCount: number; limit: number }
  | { allowed: false; tier: UserTier; limit: number }
> {
  const tier = await getUserTier(supabase, userId)
  const limit = getLimitForField(tier, field)
  const period = getCurrentPeriod()

  // Try atomic path first (migration 216: increment_usage_if_allowed).
  // Cast needed: RPC not yet in generated database types.
  const rpcCall = supabase.rpc as unknown as (
    fn: string,
    params: Record<string, unknown>
  ) => PromiseLike<{ data: number | null; error: { message: string } | null }>
  const { data, error } = await rpcCall(
    "increment_usage_if_allowed",
    { p_user_id: userId, p_period: period, p_field: field, p_limit: limit }
  )

  if (!error) {
    // RPC returns -1 when at or over limit
    if (data === -1) {
      return { allowed: false, tier, limit }
    }
    return { allowed: true, tier, newCount: data ?? 0, limit }
  }

  // Atomic RPC unavailable — graceful fallback to 2-step (check + increment).
  // Slightly less safe (TOCTOU window of ~1 request under heavy concurrency)
  // but functional. Remove this fallback once migration 216 is applied.
  console.warn("[usage] Atomic enforcement unavailable, falling back to 2-step:", error.message)

  const counts = await getUsageCounts(supabase, userId)
  const currentCount = counts[field]

  if (currentCount >= limit) {
    return { allowed: false, tier, limit }
  }

  // Best-effort increment via existing increment_usage RPC
  const newCount = await incrementUsage(supabase, userId, field)

  return { allowed: true, tier, newCount: newCount ?? currentCount + 1, limit }
}

/**
 * @module tier-limits
 * @description Pricing tier definitions, usage limits, and feature flags.
 *
 * Central source of truth for what each subscription tier (free, starter,
 * pro, day_pass) can access. All tiers enforce hard caps -- there is no
 * "unlimited" tier to prevent abuse.
 *
 * @see {@link lib/usage.ts} for runtime limit checking and increment logic
 * @see {@link app/pricing/page.tsx} for the customer-facing pricing page
 */

import type { UserTier } from "@/types/database.types"

/** Database column names used in the `usage_tracking` table. */
export type UsageField =
  | "analyses_count"
  | "chat_messages_count"
  | "share_links_count"
  | "exports_count"
  | "bookmarks_count"
  | "podcast_analyses_count"

/**
 * Monthly usage limits for a single tier.
 * Every value is a hard cap enforced server-side.
 */
export interface TierLimits {
  analyses: number
  chatMessagesMonthly: number
  chatMessagesPerContent: number
  shareLinks: number
  exports: number
  bookmarks: number
  tags: number
  library: number
  podcastAnalyses: number
  bulkImportBatchSize: number
}

/** Monthly limits per tier. All tiers have hard caps to prevent abuse. */
export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    analyses: 5,
    chatMessagesMonthly: 50,
    chatMessagesPerContent: 10,
    shareLinks: 0,
    exports: 0,
    bookmarks: 5,
    tags: 3,
    library: 25,
    podcastAnalyses: 0,
    bulkImportBatchSize: 2,
  },
  starter: {
    analyses: 50,
    chatMessagesMonthly: 300,
    chatMessagesPerContent: 25,
    shareLinks: 10,
    exports: 50,
    bookmarks: 50,
    tags: 50,
    library: 500,
    podcastAnalyses: 10,
    bulkImportBatchSize: 5,
  },
  pro: {
    analyses: 150,
    chatMessagesMonthly: 1000,
    chatMessagesPerContent: 50,
    shareLinks: 100,
    exports: 100,
    bookmarks: 500,
    tags: 100,
    library: 5000,
    podcastAnalyses: 30,
    bulkImportBatchSize: 15,
  },
  day_pass: {
    analyses: 15,
    chatMessagesMonthly: 100,
    chatMessagesPerContent: 25,
    shareLinks: 5,
    exports: 10,
    bookmarks: 10,
    tags: 10,
    library: 25,
    podcastAnalyses: 3,
    bulkImportBatchSize: 5,
  },
}

/** Map a usage database field to its corresponding tier limit key */
const FIELD_TO_LIMIT: Record<UsageField, keyof TierLimits> = {
  analyses_count: "analyses",
  chat_messages_count: "chatMessagesMonthly",
  share_links_count: "shareLinks",
  exports_count: "exports",
  bookmarks_count: "bookmarks",
  podcast_analyses_count: "podcastAnalyses",
}

/**
 * Returns the numeric limit for a specific usage field and tier.
 *
 * @param tier - The user's current subscription tier
 * @param field - The database column name for the usage counter
 * @returns The maximum allowed value for this field on the given tier
 *
 * @example
 * ```ts
 * const maxAnalyses = getLimitForField("free", "analyses_count") // 5
 * ```
 */
export function getLimitForField(tier: UserTier, field: UsageField): number {
  return TIER_LIMITS[tier][FIELD_TO_LIMIT[field]]
}

/**
 * Checks whether a usage count has reached or exceeded the tier limit.
 *
 * @param tier - The user's current subscription tier
 * @param field - The usage field to check
 * @param currentCount - The user's current count for this field
 * @returns `true` if the user has hit or exceeded their limit
 */
export function isAtLimit(tier: UserTier, field: UsageField, currentCount: number): boolean {
  const limit = getLimitForField(tier, field)
  return currentCount >= limit
}

/**
 * Returns the current billing period as a `YYYY-MM` string in UTC.
 *
 * Used as the partition key in the `usage_tracking` table so that
 * counters reset automatically each calendar month.
 *
 * @returns The current period string, e.g. `"2026-02"`
 */
export function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

/**
 * Normalizes a raw tier string from the database to a valid {@link UserTier}.
 *
 * Handles edge cases: `null`/`undefined` default to `"free"`, and
 * `"day_pass"` is downgraded to `"free"` if the pass has expired.
 *
 * @param tier - The raw tier value from the `users` table (may be null)
 * @param dayPassExpiresAt - ISO timestamp for day pass expiration (if applicable)
 * @returns A valid {@link UserTier} string
 *
 * @example
 * ```ts
 * const tier = normalizeTier(user.tier, user.day_pass_expires_at)
 * // "day_pass" with expired timestamp -> "free"
 * ```
 */
export function normalizeTier(tier: string | null | undefined, dayPassExpiresAt?: string | null): UserTier {
  if (tier === "starter" || tier === "pro") return tier
  if (tier === "day_pass") {
    if (!dayPassExpiresAt || new Date(dayPassExpiresAt) < new Date()) return "free"
    return "day_pass"
  }
  return "free"
}

/**
 * Boolean feature flags per tier for non-usage-based gating.
 *
 * Unlike {@link TIER_LIMITS} which track numeric counters, these flags
 * control binary access to features that are either enabled or disabled
 * for a given tier.
 */
export const TIER_FEATURES: Record<UserTier, {
  shareLinks: boolean
  exports: boolean
  weeklyDigest: boolean
  claimTracking: boolean
  priorityProcessing: boolean
  multiLanguageAnalysis: boolean
  comparativeAnalysis: boolean
}> = {
  free: {
    shareLinks: false,
    exports: false,
    weeklyDigest: false,
    claimTracking: false,
    priorityProcessing: false,
    multiLanguageAnalysis: false,
    comparativeAnalysis: false,
  },
  starter: {
    shareLinks: true,
    exports: true,
    weeklyDigest: true,
    claimTracking: true,
    priorityProcessing: false,
    multiLanguageAnalysis: true,
    comparativeAnalysis: false,
  },
  pro: {
    shareLinks: true,
    exports: true,
    weeklyDigest: true,
    claimTracking: true,
    priorityProcessing: true,
    multiLanguageAnalysis: true,
    comparativeAnalysis: true,
  },
  day_pass: {
    shareLinks: true,
    exports: true,
    weeklyDigest: false,
    claimTracking: true,
    priorityProcessing: false,
    multiLanguageAnalysis: true,
    comparativeAnalysis: true,
  },
}

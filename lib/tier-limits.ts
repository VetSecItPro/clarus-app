/**
 * Tier configuration and limit definitions
 * Defines what each tier (free/starter/pro) can access
 */

import type { UserTier } from "@/types/database.types"

export type UsageField =
  | "analyses_count"
  | "chat_messages_count"
  | "share_links_count"
  | "exports_count"
  | "bookmarks_count"
  | "podcast_analyses_count"

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

/** Get the limit value for a specific usage field and tier */
export function getLimitForField(tier: UserTier, field: UsageField): number {
  return TIER_LIMITS[tier][FIELD_TO_LIMIT[field]]
}

/** Check if a usage count has reached the tier limit */
export function isAtLimit(tier: UserTier, field: UsageField, currentCount: number): boolean {
  const limit = getLimitForField(tier, field)
  return currentCount >= limit
}

/** Get the current period string (YYYY-MM) */
export function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

/** Normalize a tier string from the database to a valid UserTier.
 *  For day_pass, checks expiration — returns "free" if expired. */
export function normalizeTier(tier: string | null | undefined, dayPassExpiresAt?: string | null): UserTier {
  if (tier === "starter" || tier === "pro") return tier
  if (tier === "day_pass") {
    if (!dayPassExpiresAt || new Date(dayPassExpiresAt) < new Date()) return "free"
    return "day_pass"
  }
  return "free"
}

/** Feature flags per tier (non-usage-based gating) */
export const TIER_FEATURES: Record<UserTier, {
  shareLinks: boolean
  exports: boolean
  weeklyDigest: boolean
  claimTracking: boolean
  priorityProcessing: boolean
  multiLanguageAnalysis: boolean
}> = {
  free: {
    shareLinks: false,
    exports: false,
    weeklyDigest: false,
    claimTracking: false,
    priorityProcessing: false,
    multiLanguageAnalysis: false,
  },
  starter: {
    shareLinks: true,
    exports: true,
    weeklyDigest: true,
    claimTracking: true,
    priorityProcessing: false,
    multiLanguageAnalysis: true,
  },
  pro: {
    shareLinks: true,
    exports: true,
    weeklyDigest: true,
    claimTracking: true,
    priorityProcessing: true,
    multiLanguageAnalysis: true,
  },
  day_pass: {
    shareLinks: true,
    exports: true,
    weeklyDigest: false,
    claimTracking: true,
    priorityProcessing: false,
    multiLanguageAnalysis: true,
  },
}

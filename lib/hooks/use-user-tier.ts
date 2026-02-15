/**
 * @module hooks/use-user-tier
 * @description Shared SWR hook for fetching the current user's tier.
 *
 * PERF: Eliminates 5+ duplicate Supabase queries for user tier data.
 * Previously, SiteHeader, MobileBottomNav, HomePage, LibraryPage, PodcastsPage,
 * and ItemPage each independently fetched `users.tier` on every mount.
 * This hook uses a single SWR cache key so only one request is made,
 * and all consumers share the cached result.
 */

import useSWR from "swr"
import { supabase } from "@/lib/supabase"
import { normalizeTier, TIER_FEATURES } from "@/lib/tier-limits"
import type { UserTier } from "@/types/database.types"

interface UserTierData {
  tier: UserTier
  name: string | null
  isAdmin: boolean
  subscriptionStatus: string | null
}

// PERF: single fetcher shared across all consumers — avoids 5+ duplicate queries per page load
const fetchUserTier = async (userId: string): Promise<UserTierData> => {
  const { data, error } = await supabase
    .from("users")
    .select("tier, day_pass_expires_at, name, is_admin, subscription_status")
    .eq("id", userId)
    .single()

  if (error || !data) {
    return { tier: "free", name: null, isAdmin: false, subscriptionStatus: null }
  }

  return {
    tier: normalizeTier(data.tier, data.day_pass_expires_at),
    name: data.name,
    isAdmin: data.is_admin ?? false,
    subscriptionStatus: data.subscription_status,
  }
}

/**
 * Shared hook for user tier, name, admin status, and subscription status.
 *
 * All components needing tier info should use this hook instead of
 * independently querying the users table. SWR deduplicates the request
 * so only one query runs per `dedupingInterval` (60s).
 *
 * @param userId - The authenticated user's ID, or null/undefined if not logged in
 * @returns User tier data, loading state, and a refresh function
 */
export function useUserTier(userId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<UserTierData>(
    userId ? `user-tier:${userId}` : null,
    () => fetchUserTier(userId!),
    {
      // PERF: tier data rarely changes — long dedup + no revalidation on stale
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60_000,
      // Revalidate every 5 minutes in case of tier changes (e.g. day pass expiry)
      refreshInterval: 5 * 60 * 1000,
    }
  )

  const isAdmin = data?.isAdmin ?? false

  // Admin users get all features enabled regardless of tier
  const features = isAdmin
    ? Object.fromEntries(
        Object.keys(TIER_FEATURES.pro).map((key) => [key, true])
      ) as typeof TIER_FEATURES["pro"]
    : TIER_FEATURES[data?.tier ?? "free"]

  return {
    tier: data?.tier ?? "free" as UserTier,
    name: data?.name ?? null,
    isAdmin,
    subscriptionStatus: data?.subscriptionStatus ?? null,
    features,
    isLoading,
    error,
    refresh: mutate,
  }
}

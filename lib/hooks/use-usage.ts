/**
 * @module hooks/use-usage
 * @description SWR hook for fetching the current user's usage data and tier limits.
 *
 * Provides reactive usage counters that auto-refresh every 60 seconds.
 * Used by the /dashboard page and the settings dropdown usage preview.
 */

import useSWR from "swr"
import type { UserTier } from "@/types/database.types"

interface UsageEntry {
  used: number
  limit: number
}

export interface UsageData {
  tier: UserTier
  period: string
  resetDate: string
  usage: {
    analyses: UsageEntry
    podcastAnalyses: UsageEntry
    chatMessages: UsageEntry
    libraryItems: UsageEntry
    exports: UsageEntry
    shareLinks: UsageEntry
    bookmarks: UsageEntry
  }
}

const fetcher = async (url: string): Promise<UsageData> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch usage data")
  return res.json()
}

/**
 * Fetches the authenticated user's current usage counters and tier limits.
 *
 * @returns Reactive usage data with 60-second auto-refresh.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useUsage()
 * if (data) console.log(data.usage.analyses.used, "/", data.usage.analyses.limit)
 * ```
 */
export function useUsage() {
  const { data, error, isLoading, mutate } = useSWR<UsageData>(
    "/api/usage",
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    }
  )

  return {
    data,
    isLoading,
    error,
    mutate,
  }
}

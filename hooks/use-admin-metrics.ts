import useSWR from "swr"
import type { DashboardMetrics } from "@/app/api/admin/metrics/route"

interface UseAdminMetricsOptions {
  userId: string | null
  timeRange: number
  enabled?: boolean
}

interface MrrData {
  mrr: number
  mrrGrowthPercent: number
  activeSubscriptions: number
  trialingSubscriptions: number
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error("Failed to fetch admin metrics")
    throw error
  }
  return res.json()
}

export function useAdminMetrics({ userId, timeRange, enabled = true }: UseAdminMetricsOptions) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<DashboardMetrics>(
    enabled && userId ? `/api/admin/metrics?userId=${userId}&timeRange=${timeRange}` : null,
    fetcher,
    {
      // Refresh every 5 minutes
      refreshInterval: 5 * 60 * 1000,
      // Keep data fresh for 1 minute
      dedupingInterval: 60 * 1000,
      // Revalidate in background
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      // Keep previous data while loading new
      keepPreviousData: true,
      // Retry on error
      errorRetryCount: 2,
    }
  )

  return {
    metrics: data,
    isLoading,
    isRefreshing: isValidating && !isLoading,
    error,
    refresh: () => mutate(),
  }
}

export function useAdminMrr({ userId, enabled = true }: { userId: string | null; enabled?: boolean }) {
  const { data, error, isLoading } = useSWR<MrrData>(
    enabled && userId ? `/api/admin/mrr?userId=${userId}` : null,
    fetcher,
    {
      // MRR doesn't change often, cache longer
      refreshInterval: 10 * 60 * 1000,
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  )

  return {
    mrrData: data,
    isLoading,
    error,
  }
}

// Prefetch admin metrics for instant navigation
export function prefetchAdminMetrics(userId: string, timeRange: number = 30) {
  if (typeof window === "undefined") return

  // Use requestIdleCallback for non-blocking prefetch
  const prefetch = () => {
    fetch(`/api/admin/metrics?userId=${userId}&timeRange=${timeRange}`)
      .then(res => res.json())
      .catch(() => {
        // Ignore prefetch errors
      })
  }

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(prefetch, { timeout: 2000 })
  } else {
    setTimeout(prefetch, 100)
  }
}

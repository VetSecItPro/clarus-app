"use client"

import { SWRConfig } from "swr"
import type { ReactNode } from "react"

interface SWRProviderProps {
  children: ReactNode
}

// PERF: FIX-PERF-007 — cap SWR cache size to prevent unbounded memory growth
const MAX_CACHE_ENTRIES = 200

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        // Keep data fresh for 30 seconds
        dedupingInterval: 30000,
        // Don't revalidate on focus by default (saves API calls)
        revalidateOnFocus: false,
        // Revalidate on reconnect
        revalidateOnReconnect: true,
        // Keep previous data while loading
        keepPreviousData: true,
        // Retry failed requests
        errorRetryCount: 2,
        // Cache data in sessionStorage for persistence with max size eviction
        provider: () => {
          const map = new Map()
          const insertionOrder: string[] = []

          // Try to restore from sessionStorage on mount
          if (typeof window !== 'undefined') {
            try {
              const cached = sessionStorage.getItem('swr-cache')
              if (cached) {
                const parsed = JSON.parse(cached)
                const entries = Object.entries(parsed)
                // Only restore up to MAX_CACHE_ENTRIES
                const toRestore = entries.slice(-MAX_CACHE_ENTRIES)
                toRestore.forEach(([key, value]) => {
                  map.set(key, value)
                  insertionOrder.push(key)
                })
              }
            } catch {
              // Ignore errors
            }

            // Save to sessionStorage periodically
            const save = () => {
              try {
                const data: Record<string, unknown> = {}
                map.forEach((value, key) => {
                  data[key] = value
                })
                sessionStorage.setItem('swr-cache', JSON.stringify(data))
              } catch {
                // Ignore quota errors
              }
            }

            // Save on page unload
            window.addEventListener('beforeunload', save)
          }

          // Wrap the Map to intercept set() for eviction
          const originalSet = map.set.bind(map)
          map.set = (key: string, value: unknown) => {
            if (!map.has(key)) {
              insertionOrder.push(key)
            }
            // Evict oldest entries when over limit
            while (insertionOrder.length > MAX_CACHE_ENTRIES) {
              const oldest = insertionOrder.shift()
              if (oldest && oldest !== key) {
                map.delete(oldest)
              }
            }
            return originalSet(key, value)
          }

          return map
        },
      }}
    >
      {children}
    </SWRConfig>
  )
}

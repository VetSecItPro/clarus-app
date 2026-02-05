"use client"

import { SWRConfig } from "swr"
import type { ReactNode } from "react"

interface SWRProviderProps {
  children: ReactNode
}

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
        // Cache data in localStorage for persistence
        provider: () => {
          const map = new Map()

          // Try to restore from sessionStorage on mount
          if (typeof window !== 'undefined') {
            try {
              const cached = sessionStorage.getItem('swr-cache')
              if (cached) {
                const parsed = JSON.parse(cached)
                Object.entries(parsed).forEach(([key, value]) => {
                  map.set(key, value)
                })
              }
            } catch {
              // Ignore errors
            }

            // Save to sessionStorage
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

            // PERF: save periodically (every 30s) in addition to beforeunload
            // to prevent data loss on crashes/force-closes
            const periodicSaveInterval = setInterval(save, 30_000)

            // Save on page unload
            window.addEventListener('beforeunload', () => {
              clearInterval(periodicSaveInterval)
              save()
            })
          }

          return map
        },
      }}
    >
      {children}
    </SWRConfig>
  )
}

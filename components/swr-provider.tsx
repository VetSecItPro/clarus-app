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

          return map
        },
      }}
    >
      {children}
    </SWRConfig>
  )
}

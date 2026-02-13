"use client"

import { SWRConfig } from "swr"
import { useEffect, useRef } from "react"
import type { ReactNode } from "react"

interface SWRProviderProps {
  children: ReactNode
}

function createCacheProvider(): Map<string, unknown> {
  const map = new Map<string, unknown>()

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
  }

  return map
}

function saveCacheToSession(map: Map<string, unknown>) {
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

export function SWRProvider({ children }: SWRProviderProps) {
  const cacheRef = useRef<Map<string, unknown> | null>(null)
  if (!cacheRef.current) {
    cacheRef.current = createCacheProvider()
  }

  useEffect(() => {
    const map = cacheRef.current
    if (!map) return

    const save = () => saveCacheToSession(map)
    const intervalId = setInterval(save, 30_000)
    const handleUnload = () => save()
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('beforeunload', handleUnload)
      save()
    }
  }, [])

  return (
    <SWRConfig value={{
      dedupingInterval: 30000,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      keepPreviousData: true,
      errorRetryCount: 2,
      provider: () => cacheRef.current! as Map<string, never>,
    }}>
      {children}
    </SWRConfig>
  )
}

"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import { useRef, useEffect, useState } from "react"

interface VirtualizedListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  estimateSize?: number
  overscan?: number
  className?: string
  gap?: number
}

export function VirtualizedList<T>({
  items,
  renderItem,
  estimateSize = 200,
  overscan = 5,
  className = "",
  gap = 12,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    gap,
  })

  const virtualItems = virtualizer.getVirtualItems()

  // Use window scroll instead of container scroll for better mobile performance
  useEffect(() => {
    const handleScroll = () => {
      if (parentRef.current) {
        virtualizer.measure()
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [virtualizer])

  if (items.length === 0) return null

  // For small lists, render normally without virtualization
  if (items.length <= 10) {
    return (
      <div className={className} style={{ display: "flex", flexDirection: "column", gap }}>
        {items.map((item, index) => (
          <div key={index}>{renderItem(item, index)}</div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className={className}
      style={{
        height: "100%",
        overflow: "auto",
        contain: "strict",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

// Simpler windowed list that works with natural document flow
export function WindowedList<T>({
  items,
  renderItem,
  batchSize = 20,
  className = "",
}: {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  batchSize?: number
  className?: string
}) {
  const [visibleCount, setVisibleCount] = useState(batchSize)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < items.length) {
          setVisibleCount((prev) => Math.min(prev + batchSize, items.length))
        }
      },
      { rootMargin: "200px" }
    )

    if (loaderRef.current) {
      observer.observe(loaderRef.current)
    }

    return () => observer.disconnect()
  }, [visibleCount, items.length, batchSize])

  // Reset when items change
  useEffect(() => {
    setVisibleCount(batchSize)
  }, [items, batchSize])

  return (
    <div className={className}>
      {items.slice(0, visibleCount).map((item, index) => (
        <div key={index}>{renderItem(item, index)}</div>
      ))}
      {visibleCount < items.length && (
        <div ref={loaderRef} className="h-20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}


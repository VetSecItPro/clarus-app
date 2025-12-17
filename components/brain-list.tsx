"use client"

import type { DisplayBrainItem } from "@/app/brain/page"
import BrainListItem from "@/components/brain-list-item"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface BrainListProps {
  items: DisplayBrainItem[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

export default function BrainList({ items, isLoading, error, onRetry }: BrainListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex space-x-4 bg-[#1a1a1a] p-4 rounded-lg">
            <Skeleton className="h-24 w-24 rounded-md sm:h-32 sm:w-48" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full mt-2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-10 text-red-400 bg-[#1a1a1a] rounded-lg">
        <p className="font-semibold">Something went wrong</p>
        <p className="text-sm mt-1">{error}</p>
        <Button onClick={onRetry} className="mt-4">
          Try Again
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return <div className="text-center py-10 text-gray-400 bg-[#1a1a1a] rounded-lg">No items found in your brain.</div>
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <BrainListItem key={item.id} item={item} />
      ))}
    </div>
  )
}

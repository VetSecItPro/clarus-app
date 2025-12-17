"use client"

import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { Play, FileText, ExternalLink, Loader2, PlusCircle, User, Star, CalendarDays } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Database } from "@/types/database.types"
import { formatDistanceToNow } from "date-fns"
import { formatDuration } from "@/lib/utils"

type ContentItem = Database["public"]["Tables"]["content"]["Row"]
type UserItem = Database["public"]["Tables"]["users"]["Row"]

// Extended DisplayItem to include rater info for the feed
export type DisplayItem = ContentItem & {
  domain: string
  savedAt: string // Original content savedAt
  displayDuration: string
  isProcessing: boolean
  raterUsername?: string | null // For feed: username/email of the rater
  ratingScore?: number | null // For feed: the score given by the rater
  ratingGivenAt?: string | null // For feed: when the rating was given
  overview?: string | null // For brain view experiment
}

interface ContentGridProps {
  items: DisplayItem[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
  emptyStateTitle: string
  emptyStateMessage: string
  onQuickAddFromClipboard?: () => Promise<void>
  isQuickAdding?: boolean
  isFeedView?: boolean // To conditionally show rater info
}

const getDomainFromUrl = (url: string | null): string => {
  if (!url) return "unknown.com"
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch (e) {
    return "unknown.com"
  }
}

// This function processes a raw ContentItem from DB into a basic DisplayItem
// For the feed, additional properties (raterUsername, ratingScore, ratingGivenAt)
// will be added in the app/feed/page.tsx fetch logic.
export const processItemForDisplay = (
  item: ContentItem,
): Omit<DisplayItem, "raterUsername" | "ratingScore" | "ratingGivenAt"> => ({
  ...item,
  domain: getDomainFromUrl(item.url),
  savedAt: item.date_added ? formatDistanceToNow(new Date(item.date_added), { addSuffix: true }) : "unknown",
  displayDuration: formatDuration(item.duration),
  isProcessing: !item.full_text,
})

const RATING_EMOJIS: { [key: number]: React.ReactNode } = {
  1: "⚡",
  2: "⚡⚡",
  3: "⚡⚡⚡",
}

export default function ContentGrid({
  items,
  isLoading,
  error,
  onRetry,
  emptyStateTitle,
  emptyStateMessage,
  onQuickAddFromClipboard,
  isQuickAdding,
  isFeedView = false,
}: ContentGridProps) {
  const handleOpenOriginal = (e: React.MouseEvent<HTMLButtonElement>, url: string | null) => {
    e.stopPropagation()
    e.preventDefault()
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="ml-2 text-gray-400">Loading content...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-10 text-red-400 bg-red-900/20 p-4 rounded-md">
        <p>Error: {error}</p>
        <Button
          onClick={onRetry}
          variant="outline"
          className="mt-4 text-gray-300 border-gray-600 hover:bg-gray-700 bg-transparent"
        >
          Try Reloading
        </Button>
      </div>
    )
  }

  if (items.length === 0 && !isLoading) {
    return (
      <div className="text-center py-20">
        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileText className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-[#F0F0F0] mb-2">{emptyStateTitle}</h3>
        <p className="text-gray-400 text-sm mb-4">{emptyStateMessage}</p>
        {onQuickAddFromClipboard && (
          <Button
            variant="outline"
            onClick={onQuickAddFromClipboard}
            disabled={isQuickAdding || isLoading}
            className="text-[#F0F0F0] border-gray-700 hover:bg-gray-800 bg-transparent"
          >
            {isQuickAdding ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PlusCircle className="w-4 h-4 mr-2" />
            )}
            Add your first item (from clipboard)
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-16">
      {items.map((item) => (
        <Link key={item.id + (item.raterUsername || "")} href={`/item/${item.id}`} passHref legacyBehavior={false}>
          <article className="group cursor-pointer block">
            {isFeedView && item.raterUsername && item.ratingScore && (
              <div className="mb-3 flex items-center gap-2 text-xs text-gray-400 border border-gray-700 bg-gray-800/30 p-2 rounded-lg">
                <User className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="font-medium text-gray-300 truncate" title={item.raterUsername}>
                  {item.raterUsername.split("@")[0]}
                </span>
                <span>rated it</span>
                <div className="text-lg h-5 flex items-center" title={`Score: ${item.ratingScore}`}>
                  {RATING_EMOJIS[item.ratingScore] || <Star className="w-3.5 h-3.5 text-yellow-400" />}
                </div>
                {item.ratingGivenAt && (
                  <>
                    <span>•</span>
                    <CalendarDays className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <span>{item.ratingGivenAt}</span>
                  </>
                )}
              </div>
            )}
            <div className="relative mb-4 overflow-hidden rounded-xl">
              <Image
                src={
                  item.thumbnail_url ||
                  `/placeholder.svg?height=240&width=400&query=stylized ${encodeURIComponent(item.type || "content")} graphic`
                }
                alt={item.title || "Saved item"}
                width={400}
                height={240}
                className="w-full h-60 object-cover transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute top-4 left-4">
                <Badge
                  variant="secondary"
                  className="bg-black/60 backdrop-blur-sm text-[#F0F0F0] border-0 text-xs font-medium"
                >
                  {item.type === "youtube" ? (
                    <>
                      <Play className="w-3 h-3 mr-1.5" />
                      {item.displayDuration}
                    </>
                  ) : (
                    <>
                      <FileText className="w-3 h-3 mr-1.5" />
                      Article
                    </>
                  )}
                </Badge>
              </div>
              {item.isProcessing &&
                !isFeedView && ( // Don't show processing overlay for feed items if they are already rated
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                    <p className="ml-2 text-white text-sm">Processing...</p>
                  </div>
                )}
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-medium text-[#F0F0F0] leading-tight group-hover:text-gray-200 transition-colors">
                {item.title || "Processing Title..."}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-400 pb-4">
                <span>{item.domain}</span>
                <span>•</span>
                <span>{item.savedAt}</span>
              </div>
              {item.url && (
                <div className="pt-2">
                  <button
                    onClick={(e) => handleOpenOriginal(e, item.url)}
                    className="inline-flex items-center text-xs text-blue-400 hover:text-blue-300 hover:underline focus:outline-none"
                    aria-label={`Open original content for ${item.title || "item"}`}
                  >
                    Open Original <ExternalLink className="w-3 h-3 ml-1" />
                  </button>
                </div>
              )}
            </div>
          </article>
        </Link>
      ))}
    </div>
  )
}

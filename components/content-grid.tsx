"use client"

import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { Play, FileText, ExternalLink, Loader2, PlusCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Database } from "@/types/database.types"

type ContentItem = Database["clarus"]["Tables"]["content"]["Row"]

type DisplayItem = ContentItem & {
  domain: string
  savedAt: string
  displayDuration: string
  isProcessing: boolean
  overview?: string | null
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
}: ContentGridProps) {
  const handleOpenOriginal = (e: React.MouseEvent<HTMLButtonElement>, url: string | null) => {
    e.stopPropagation()
    e.preventDefault()
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  if (isLoading && items.length === 0) {
    return (
      <div role="status" className="flex-grow flex items-center justify-center">
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
        <Link key={item.id} href={`/item/${item.id}`} passHref legacyBehavior={false}>
          <article className="group cursor-pointer block">
            <div className="relative mb-4 overflow-hidden rounded-xl">
              <Image
                src={
                  item.thumbnail_url ||
                  `/placeholder.svg?height=240&width=400&query=stylized ${encodeURIComponent(item.type || "content")} graphic`
                }
                alt={item.title || "Saved item"}
                width={400}
                height={240}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                className="w-full h-60 object-cover transition-transform duration-300 group-hover:scale-105"
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
              {item.isProcessing && (
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
                    className="inline-flex items-center text-xs text-blue-400 hover:text-blue-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:rounded"
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

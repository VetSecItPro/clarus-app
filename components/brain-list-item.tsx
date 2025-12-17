"use client"

import type { DisplayBrainItem } from "@/app/brain/page"
import { Card } from "@/components/ui/card"
import { Youtube, LinkIcon, Rss, Zap } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface BrainListItemProps {
  item: DisplayBrainItem
}

const TypeIcon = ({ type }: { type: string | null }) => {
  switch (type) {
    case "youtube":
      return <Youtube className="h-4 w-4 text-red-500" />
    case "article":
      return <Rss className="h-4 w-4 text-gray-400" />
    case "x_post":
      return (
        <svg className="h-3 w-3 text-gray-400" fill="currentColor" viewBox="0 0 1200 1227">
          <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6902H306.615L611.412 515.685L658.88 583.579L1055.08 1150.31H892.476L569.165 687.854V687.828Z"></path>
        </svg>
      )
    default:
      return <LinkIcon className="h-4 w-4 text-gray-400" />
  }
}

const RatingVisual = ({ rating }: { rating: number | null | undefined }) => {
  if (typeof rating !== "number" || rating < 1) {
    return null
  }
  const numberOfZaps = Math.round(rating)

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: numberOfZaps }).map((_, index) => (
        <Zap key={index} className="h-4 w-4 text-orange-500 fill-orange-500" />
      ))}
    </div>
  )
}

export default function BrainListItem({ item }: BrainListItemProps) {
  const summary = item.summaries && item.summaries.length > 0 ? item.summaries[0].mid_length_summary : ""
  const rating = item.content_ratings?.[0]?.signal_score
  const sourceDomain = item.url ? new URL(item.url).hostname.replace("www.", "") : "N/A"

  return (
    <Card className="bg-[#1a1a1a] border-gray-800 text-gray-200 overflow-hidden flex flex-col sm:flex-row hover:bg-[#222] transition-colors">
      <div className="sm:w-48 sm:flex-shrink-0">
        <Link href={`/item/${item.id}`} className="relative block h-32 sm:h-full">
          <Image
            src={item.thumbnail_url || "/placeholder.svg?width=192&height=128"}
            alt={item.title || "Content thumbnail"}
            fill
            className="object-cover"
          />
        </Link>
      </div>
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 text-xs text-gray-400 mb-1">
                <TypeIcon type={item.type} />
                <span>{sourceDomain}</span>
              </div>
              <Link href={`/item/${item.id}`}>
                <h3 className="font-semibold text-lg text-white leading-tight hover:text-blue-400 transition-colors">
                  {item.title || "Untitled"}
                </h3>
              </Link>
            </div>
            <div className="flex-shrink-0">
              <RatingVisual rating={rating} />
            </div>
          </div>
          <p className="text-sm text-gray-400 line-clamp-3 mt-2">{summary}</p>
        </div>
        <div className="flex items-center space-x-4 mt-4 text-sm">
          <a
            href={item.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 hover:underline"
          >
            Open Original
          </a>
        </div>
      </div>
    </Card>
  )
}

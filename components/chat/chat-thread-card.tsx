"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import {
  Youtube,
  FileText,
  Twitter,
  MessageSquare,
  Bookmark,
  BookmarkCheck,
  Trash2,
  User,
} from "lucide-react"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import type { TriageData } from "@/types/database.types"

interface ChatThreadCardProps {
  id: string
  title: string
  url: string
  type: "youtube" | "article" | "x_post"
  thumbnail_url?: string | null
  brief_overview?: string | null
  triage?: TriageData | null
  date_added: string
  message_count?: number
  is_bookmarked?: boolean
  // For community feed
  analyzer?: {
    name: string
    avatar_url?: string
  }
  onClick: () => void
  onBookmark?: () => void
  onDelete?: () => void
}

// Recommendation labels
const RECOMMENDATION_LABELS = [
  { label: "Skip", color: "text-red-400", bg: "bg-red-500/20" },
  { label: "Skim", color: "text-orange-400", bg: "bg-orange-500/20" },
  { label: "Worth It", color: "text-emerald-400", bg: "bg-emerald-500/20" },
  { label: "Must See", color: "text-green-400", bg: "bg-green-500/20" },
]

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch {
    return url
  }
}

function getTypeIcon(type: "youtube" | "article" | "x_post") {
  switch (type) {
    case "youtube":
      return <Youtube className="w-3.5 h-3.5 text-red-400" />
    case "x_post":
      return <Twitter className="w-3.5 h-3.5 text-white" />
    default:
      return <FileText className="w-3.5 h-3.5 text-blue-400" />
  }
}

export const ChatThreadCard = memo(function ChatThreadCard({
  id,
  title,
  url,
  type,
  thumbnail_url,
  brief_overview,
  triage,
  date_added,
  message_count = 0,
  is_bookmarked = false,
  analyzer,
  onClick,
  onBookmark,
  onDelete,
}: ChatThreadCardProps) {
  const domain = getDomainFromUrl(url)
  const recommendation =
    triage?.signal_noise_score !== undefined
      ? RECOMMENDATION_LABELS[triage.signal_noise_score] || RECOMMENDATION_LABELS[0]
      : null

  const timeAgo = formatDistanceToNow(new Date(date_added), { addSuffix: true })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
    >
      <button
        onClick={onClick}
        className="w-full text-left p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.1] transition-all"
      >
        {/* Analyzer info (community feed) */}
        {analyzer && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.06]">
            <div className="w-5 h-5 rounded-full bg-[#1d9bf0]/20 flex items-center justify-center overflow-hidden">
              {analyzer.avatar_url ? (
                <Image
                  src={analyzer.avatar_url}
                  alt=""
                  width={20}
                  height={20}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-3 h-3 text-[#1d9bf0]" />
              )}
            </div>
            <span className="text-xs text-white/60">{analyzer.name}</span>
            <span className="text-xs text-white/30">analyzed</span>
          </div>
        )}

        <div className="flex gap-3">
          {/* Thumbnail */}
          {thumbnail_url && (
            <div className="shrink-0 w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden bg-white/[0.05] relative">
              <Image
                src={thumbnail_url}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className="text-sm font-medium text-white line-clamp-2 mb-1 group-hover:text-[#1d9bf0] transition-colors">
              {title}
            </h3>

            {/* Meta row */}
            <div className="flex items-center gap-2 text-[11px] text-white/40 mb-1.5">
              {getTypeIcon(type)}
              <span className="truncate">{domain}</span>
              <span>•</span>
              <span>{timeAgo}</span>
            </div>

            {/* TL;DR preview */}
            {brief_overview && (
              <p className="text-xs text-white/50 line-clamp-1">
                {brief_overview}
              </p>
            )}
          </div>

          {/* Right side: scores and message count */}
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {/* Quality score */}
            {triage && (
              <div className="px-2 py-0.5 rounded-full bg-[#1d9bf0]/20 text-[10px] font-semibold text-[#1d9bf0]">
                {triage.quality_score}/10
              </div>
            )}

            {/* Recommendation */}
            {recommendation && (
              <div
                className={`px-2 py-0.5 rounded-full ${recommendation.bg} text-[10px] font-medium ${recommendation.color}`}
              >
                {recommendation.label}
              </div>
            )}

            {/* Message count */}
            {message_count > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-white/40">
                <MessageSquare className="w-3 h-3" />
                <span>{message_count}</span>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Action buttons (show on hover) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onBookmark && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onBookmark()
            }}
            className="w-7 h-7 rounded-lg bg-black/80 hover:bg-black flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            {is_bookmarked ? (
              <BookmarkCheck className="w-3.5 h-3.5 text-[#1d9bf0]" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="w-7 h-7 rounded-lg bg-black/80 hover:bg-black flex items-center justify-center text-white/60 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
})

"use client"

import Link from "next/link"
import { FileText, Play, MessageSquare, FileIcon, Mic } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { VoteButton } from "./vote-button"
import type { DiscoverFeedItem } from "@/app/api/discover/route"

const TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string; bg: string }> = {
  youtube: { label: "YouTube", icon: Play, color: "text-red-400", bg: "bg-red-500/10" },
  article: { label: "Article", icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
  x_post: { label: "X Post", icon: MessageSquare, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  pdf: { label: "PDF", icon: FileIcon, color: "text-purple-400", bg: "bg-purple-500/10" },
  podcast: { label: "Podcast", icon: Mic, color: "text-green-400", bg: "bg-green-500/10" },
}

function QualityBadge({ score }: { score: number }) {
  let color = "text-red-400 bg-red-500/10 border-red-500/20"
  if (score >= 8) color = "text-green-400 bg-green-500/10 border-green-500/20"
  else if (score >= 5) color = "text-amber-400 bg-amber-500/10 border-amber-500/20"

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", color)}>
      {score.toFixed(1)}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.article
  const Icon = config.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", config.color, config.bg)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

interface DiscoverCardProps {
  item: DiscoverFeedItem
  index: number
  isOwnContent?: boolean
}

export function DiscoverCard({ item, index, isOwnContent = false }: DiscoverCardProps) {
  const linkHref = isOwnContent
    ? `/item/${item.id}`
    : item.shareToken
      ? `/share/${item.shareToken}`
      : `/item/${item.id}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 sm:p-5 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
    >
      <div className="flex gap-3">
        {/* Vote column */}
        <div className="flex-shrink-0 pt-0.5">
          <VoteButton
            contentId={item.id}
            initialVoteScore={item.voteScore}
            initialUserVote={item.userVote}
          />
        </div>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          {/* Top row: type badge + quality score */}
          <div className="flex items-center justify-between mb-2">
            <TypeBadge type={item.type} />
            <QualityBadge score={item.qualityScore} />
          </div>

          {/* Title */}
          <Link href={linkHref} className="block">
            <h2 className="text-sm sm:text-base font-semibold text-white group-hover:text-[#1d9bf0] transition-colors line-clamp-2 mb-1.5">
              {item.title}
            </h2>
          </Link>

          {/* Brief overview */}
          {item.briefOverview && (
            <p className="text-xs sm:text-sm text-white/45 line-clamp-2 mb-3 leading-relaxed">
              {item.briefOverview}
            </p>
          )}

          {/* Footer: author + date + view link */}
          <div className="flex items-center justify-between text-xs text-white/30">
            <div className="flex items-center gap-2">
              {item.authorName && (
                <span className="text-white/40">
                  by {item.authorName}
                </span>
              )}
              <time dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>
            <Link
              href={linkHref}
              className="text-[#1d9bf0]/70 hover:text-[#1d9bf0] font-medium transition-colors"
            >
              View
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

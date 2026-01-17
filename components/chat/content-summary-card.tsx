"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ExternalLink,
  Youtube,
  FileText,
  Twitter,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
} from "lucide-react"
import Image from "next/image"
import type { TriageData } from "@/types/database.types"

interface ContentSummaryCardProps {
  title: string
  url: string
  type: "youtube" | "article" | "x_post"
  thumbnail_url?: string | null
  author?: string | null
  duration?: number | null
  triage?: TriageData | null
  brief_overview?: string | null
  transcript?: string | null
  onViewFullAnalysis?: () => void
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

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

function getTypeIcon(type: "youtube" | "article" | "x_post") {
  switch (type) {
    case "youtube":
      return <Youtube className="w-4 h-4 text-red-400" />
    case "x_post":
      return <Twitter className="w-4 h-4 text-white" />
    default:
      return <FileText className="w-4 h-4 text-blue-400" />
  }
}

export function ContentSummaryCard({
  title,
  url,
  type,
  thumbnail_url,
  author,
  duration,
  triage,
  brief_overview,
  transcript,
  onViewFullAnalysis,
}: ContentSummaryCardProps) {
  const [showTranscript, setShowTranscript] = useState(false)
  const domain = getDomainFromUrl(url)
  const recommendation = triage?.signal_noise_score !== undefined
    ? RECOMMENDATION_LABELS[triage.signal_noise_score] || RECOMMENDATION_LABELS[0]
    : null

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden" style={{ maxWidth: "600px" }}>
      {/* Header with thumbnail and metadata */}
      <div className="p-4">
        <div className="flex gap-3">
          {/* Thumbnail */}
          {thumbnail_url && (
            <div className="shrink-0 w-24 h-16 sm:w-32 sm:h-20 rounded-lg overflow-hidden bg-white/[0.05] relative">
              <Image
                src={thumbnail_url}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
              {duration && (
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-medium">
                  {formatDuration(duration)}
                </div>
              )}
            </div>
          )}

          {/* Content info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-white line-clamp-2 mb-1">
              {title}
            </h3>

            <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
              {getTypeIcon(type)}
              <span className="truncate">{domain}</span>
              {author && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span className="truncate">{author}</span>
                  </div>
                </>
              )}
            </div>

            {/* Quality score and recommendation */}
            {triage && (
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-full bg-[#1d9bf0]/20 text-[#1d9bf0] text-xs font-semibold">
                  {triage.quality_score}/10
                </div>
                {recommendation && (
                  <div className={`px-2 py-0.5 rounded-full ${recommendation.bg} text-xs font-medium ${recommendation.color}`}>
                    {recommendation.label}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* External link */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/50 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* TL;DR */}
        {brief_overview && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
              TL;DR
            </div>
            <p className="text-sm text-white/80 line-clamp-3">{brief_overview}</p>
          </div>
        )}
      </div>

      {/* Transcript section (YouTube only) */}
      {type === "youtube" && transcript && (
        <div className="border-t border-white/[0.06]">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-white/60 hover:text-white hover:bg-white/[0.02] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              View Transcript
            </span>
            {showTranscript ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          <AnimatePresence>
            {showTranscript && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 max-h-60 overflow-y-auto">
                  <pre className="text-xs text-white/60 whitespace-pre-wrap font-sans leading-relaxed">
                    {transcript}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

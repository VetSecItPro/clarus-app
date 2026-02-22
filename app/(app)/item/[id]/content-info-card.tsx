"use client"

import { Play, FileText, Headphones, Twitter } from "lucide-react"
import { getModeOption, type AnalysisMode } from "@/lib/analysis-modes"

interface ContentInfoCardProps {
  title: string | null
  displayDomain: string
  author: string | null
  type: string | null
  displayDuration: string | null
  displaySavedAt: string
  analysisMode: AnalysisMode
  className?: string
}

export function ContentInfoCard({
  title,
  displayDomain,
  author,
  type,
  displayDuration,
  displaySavedAt,
  analysisMode,
  className = "",
}: ContentInfoCardProps) {
  const modeOpt = getModeOption(analysisMode)
  const ModeIcon = modeOpt.icon

  return (
    <div className={`p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden ${className}`}>
      <div>
        <h1 className="text-base font-semibold text-white leading-tight mb-2 break-words">
          {title || "Processing Title..."}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 overflow-hidden">
          <span className="px-2 py-1 rounded-lg bg-white/[0.06]">{displayDomain}</span>
          {author && <span className="px-2 py-1 rounded-lg bg-white/[0.06]">{author}</span>}
          <span className="px-2 py-1 rounded-lg bg-white/[0.06] flex items-center gap-1">
            {type === "youtube" ? (
              <>
                <Play className="w-3 h-3" />
                {displayDuration}
              </>
            ) : type === "podcast" ? (
              <>
                <Headphones className="w-3 h-3" />
                {displayDuration || "Podcast"}
              </>
            ) : type === "x_post" ? (
              <>
                <Twitter className="w-3 h-3" />
                Post
              </>
            ) : (
              <>
                <FileText className="w-3 h-3" />
                Article
              </>
            )}
          </span>
          <span className="px-2 py-1 rounded-lg bg-white/[0.06]">Analyzed {displaySavedAt}</span>
          <span className="px-2 py-1 rounded-lg bg-brand/10 text-brand flex items-center gap-1">
            <ModeIcon className="w-3 h-3" />
            {modeOpt.label}
          </span>
        </div>
      </div>
    </div>
  )
}

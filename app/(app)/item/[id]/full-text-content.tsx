"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import type { TruthCheckData } from "@/types/database.types"
import type { YouTubePlayerRef } from "@/components/ui/youtube-player"
import type { Tables } from "@/types/database.types"

const MarkdownRenderer = dynamic(() => import("@/components/markdown-renderer").then(m => ({ default: m.MarkdownRenderer })), { ssr: false })
const TranscriptViewer = dynamic(() => import("@/components/ui/transcript-viewer").then(m => ({ default: m.TranscriptViewer })), { ssr: false })
const HighlightedTranscript = dynamic(() => import("@/components/ui/highlighted-transcript").then(m => ({ default: m.HighlightedTranscript })), { ssr: false })

interface FullTextContentProps {
  loading: boolean
  fullText: string | null
  isPolling: boolean
  summary: Tables<"summaries"> | null
  type: string | null
  videoId: string | null
  youtubePlayerRef: React.RefObject<YouTubePlayerRef | null>
  onTimestampClick: (seconds: number) => void
}

export function FullTextContent({
  loading,
  fullText,
  isPolling,
  summary,
  type,
  videoId,
  youtubePlayerRef,
  onTimestampClick,
}: FullTextContentProps) {
  return (
    <div>
      {loading && (
        <div className="flex items-center text-white/50 text-sm">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading full text...
        </div>
      )}
      {!loading && !fullText && (
        <div className="space-y-4">
          {isPolling ? (
            <div className="space-y-3 animate-pulse p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="h-4 bg-white/[0.08] rounded-lg w-full" />
              <div className="h-4 bg-white/[0.08] rounded-lg w-11/12" />
              <div className="h-4 bg-white/[0.08] rounded-lg w-full" />
              <div className="h-4 bg-white/[0.08] rounded-lg w-4/5" />
              <div className="h-4 bg-white/[0.08] rounded-lg w-full" />
              <div className="h-4 bg-white/[0.08] rounded-lg w-3/4" />
              <p className="text-white/50 text-xs mt-4 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Fetching content...
              </p>
            </div>
          ) : (
            <div className="flex items-center text-white/50 text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Full text still processing...
            </div>
          )}
        </div>
      )}
      {!loading && fullText && (
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          {(() => {
            const truthCheck = summary?.truth_check as TruthCheckData | null
            const claims = truthCheck?.claims || []

            if (claims.length > 0) {
              return (
                <HighlightedTranscript
                  transcript={fullText}
                  claims={claims}
                  videoId={videoId || undefined}
                  onTimestampClick={onTimestampClick}
                />
              )
            }

            if (type === "youtube" && videoId) {
              return (
                <TranscriptViewer
                  transcript={fullText}
                  videoId={videoId}
                  onTimestampClick={onTimestampClick}
                />
              )
            }

            if (type === "podcast") {
              return (
                <TranscriptViewer
                  transcript={fullText}
                />
              )
            }

            return (
              <div className="prose prose-sm prose-invert max-w-none text-white/70 leading-relaxed">
                <MarkdownRenderer
                  onTimestampClick={(seconds) => {
                    youtubePlayerRef.current?.seekTo(seconds)
                  }}
                >{fullText}</MarkdownRenderer>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

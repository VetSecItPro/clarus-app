"use client"

import { useMemo } from "react"
import { Clock } from "lucide-react"

interface TranscriptViewerProps {
  transcript: string
  videoId?: string
  onTimestampClick?: (seconds: number) => void
}

interface TranscriptSegment {
  timestamp: string
  seconds: number
  text: string
}

function parseTimestamp(timestamp: string): number {
  // Parse [M:SS] or [H:MM:SS] format to seconds
  const parts = timestamp.replace(/[\[\]]/g, "").split(":").map(Number)
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

function parseTranscript(transcript: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  // Match [timestamp] followed by text until next timestamp or end
  const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^\[]*)/g
  let match

  while ((match = regex.exec(transcript)) !== null) {
    const timestamp = match[1]
    const text = match[2].trim()
    if (text) {
      segments.push({
        timestamp: `[${timestamp}]`,
        seconds: parseTimestamp(timestamp),
        text,
      })
    }
  }

  return segments
}

export function TranscriptViewer({ transcript, videoId, onTimestampClick }: TranscriptViewerProps) {
  const segments = useMemo(() => parseTranscript(transcript), [transcript])

  // If no timestamps found, just show the raw text
  if (segments.length === 0) {
    return (
      <div className="prose prose-sm prose-invert max-w-none text-white/70 leading-relaxed whitespace-pre-wrap">
        {transcript}
      </div>
    )
  }

  const handleTimestampClick = (seconds: number) => {
    if (onTimestampClick) {
      onTimestampClick(seconds)
    } else if (videoId) {
      // Open YouTube at timestamp in new tab
      window.open(`https://youtube.com/watch?v=${videoId}&t=${seconds}s`, "_blank")
    }
  }

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => (
        <div
          key={index}
          className="flex gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
        >
          <button
            onClick={() => handleTimestampClick(segment.seconds)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg bg-[#1d9bf0]/10 text-[#1d9bf0] hover:bg-[#1d9bf0]/20 border border-[#1d9bf0]/20 transition-all"
            title={`Jump to ${segment.timestamp} in video`}
          >
            <Clock className="w-3 h-3" />
            {segment.timestamp.replace(/[\[\]]/g, "")}
          </button>
          <p className="text-sm text-white/70 leading-relaxed flex-1">
            {segment.text}
          </p>
        </div>
      ))}
    </div>
  )
}

"use client"

import { useMemo } from "react"
import { Clock } from "lucide-react"

interface TranscriptViewerProps {
  transcript: string
  videoId?: string
  onTimestampClick?: (seconds: number) => void
  blockDuration?: number // Group segments into blocks of this many seconds (default: 20)
}

interface TranscriptSegment {
  timestamp: string
  seconds: number
  text: string
}

interface TranscriptBlock {
  startTimestamp: string
  endTimestamp: string
  startSeconds: number
  endSeconds: number
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

function formatSeconds(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
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

function groupIntoBlocks(segments: TranscriptSegment[], blockDuration: number): TranscriptBlock[] {
  if (segments.length === 0) return []

  const blocks: TranscriptBlock[] = []
  let currentBlock: TranscriptBlock | null = null
  let blockStartTime = 0

  for (const segment of segments) {
    // Start a new block if:
    // 1. No current block exists
    // 2. Segment exceeds the block duration from block start
    if (!currentBlock || segment.seconds >= blockStartTime + blockDuration) {
      // Save current block if exists
      if (currentBlock) {
        blocks.push(currentBlock)
      }

      // Start new block
      blockStartTime = Math.floor(segment.seconds / blockDuration) * blockDuration
      currentBlock = {
        startTimestamp: formatSeconds(segment.seconds),
        endTimestamp: formatSeconds(segment.seconds),
        startSeconds: segment.seconds,
        endSeconds: segment.seconds,
        text: segment.text,
      }
    } else {
      // Add to current block
      currentBlock.text += " " + segment.text
      currentBlock.endTimestamp = formatSeconds(segment.seconds)
      currentBlock.endSeconds = segment.seconds
    }
  }

  // Don't forget the last block
  if (currentBlock) {
    blocks.push(currentBlock)
  }

  return blocks
}

export function TranscriptViewer({
  transcript,
  videoId,
  onTimestampClick,
  blockDuration = 20, // Default to 20-second blocks
}: TranscriptViewerProps) {
  const segments = useMemo(() => parseTranscript(transcript), [transcript])
  const blocks = useMemo(() => groupIntoBlocks(segments, blockDuration), [segments, blockDuration])

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
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <div
          key={index}
          className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group border border-white/[0.04]"
        >
          {/* Time range header */}
          <button
            onClick={() => handleTimestampClick(block.startSeconds)}
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 text-xs font-mono rounded-lg bg-[#1d9bf0]/10 text-[#1d9bf0] hover:bg-[#1d9bf0]/20 border border-[#1d9bf0]/20 transition-all"
            title={`Jump to ${block.startTimestamp} in video`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{block.startTimestamp}</span>
            {block.startTimestamp !== block.endTimestamp && (
              <>
                <span className="text-[#1d9bf0]/50">→</span>
                <span>{block.endTimestamp}</span>
              </>
            )}
          </button>

          {/* Block text */}
          <p className="text-sm text-white/70 leading-relaxed">
            {block.text}
          </p>
        </div>
      ))}
    </div>
  )
}

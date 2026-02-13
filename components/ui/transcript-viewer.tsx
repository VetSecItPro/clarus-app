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
  speaker: string | null
}

interface SpeakerSegment {
  speaker: string | null
  text: string
}

interface TranscriptBlock {
  startTimestamp: string
  endTimestamp: string
  startSeconds: number
  endSeconds: number
  speakers: SpeakerSegment[]
}

// 6 distinct colors for speaker badges
const SPEAKER_COLORS = [
  { bg: "bg-blue-500/20", text: "text-blue-300", border: "border-blue-500/30" },
  { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-500/30" },
  { bg: "bg-amber-500/20", text: "text-amber-300", border: "border-amber-500/30" },
  { bg: "bg-purple-500/20", text: "text-purple-300", border: "border-purple-500/30" },
  { bg: "bg-rose-500/20", text: "text-rose-300", border: "border-rose-500/30" },
  { bg: "bg-cyan-500/20", text: "text-cyan-300", border: "border-cyan-500/30" },
]

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

// Parse speaker label from text: "Speaker A: text" or "John Smith: text"
function parseSpeaker(text: string): { speaker: string | null; text: string } {
  const speakerMatch = text.match(/^(Speaker\s+[A-Z]|[A-Z][a-zA-Z\s.'-]{1,30}?):\s*([\s\S]*)/)
  if (speakerMatch && speakerMatch[2].trim()) {
    return { speaker: speakerMatch[1].trim(), text: speakerMatch[2].trim() }
  }
  return { speaker: null, text }
}

function parseTranscript(transcript: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  // Match [timestamp] followed by text until next timestamp or end
  const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^\[]*)/g
  let match

  while ((match = regex.exec(transcript)) !== null) {
    const timestamp = match[1]
    const rawText = match[2].trim()
    if (rawText) {
      const { speaker, text } = parseSpeaker(rawText)
      segments.push({
        timestamp: `[${timestamp}]`,
        seconds: parseTimestamp(timestamp),
        text,
        speaker,
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
        speakers: [{ speaker: segment.speaker, text: segment.text }],
      }
    } else {
      // Add to current block
      const lastSpeakerSeg = currentBlock.speakers[currentBlock.speakers.length - 1]

      // If same speaker (or both null), append text to existing segment
      if (lastSpeakerSeg.speaker === segment.speaker) {
        lastSpeakerSeg.text += " " + segment.text
      } else {
        // Different speaker — new speaker segment within same block
        currentBlock.speakers.push({ speaker: segment.speaker, text: segment.text })
      }

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

  // Build speaker color map based on first occurrence order
  const speakerColorMap = useMemo(() => {
    const map = new Map<string, typeof SPEAKER_COLORS[number]>()
    let colorIndex = 0
    for (const segment of segments) {
      if (segment.speaker && !map.has(segment.speaker)) {
        map.set(segment.speaker, SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length])
        colorIndex++
      }
    }
    return map
  }, [segments])

  const hasSpeakers = speakerColorMap.size > 0

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

  const isClickable = Boolean(onTimestampClick || videoId)

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <div
          key={index}
          className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group border border-white/[0.04]"
        >
          {/* Time range header */}
          {isClickable ? (
            <button
              onClick={() => handleTimestampClick(block.startSeconds)}
              className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 text-xs font-mono rounded-lg bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20 transition-all"
              title={`Jump to ${block.startTimestamp} in video`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{block.startTimestamp}</span>
              {block.startTimestamp !== block.endTimestamp && (
                <>
                  <span className="text-brand/50">&rarr;</span>
                  <span>{block.endTimestamp}</span>
                </>
              )}
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 text-xs font-mono rounded-lg bg-white/[0.06] text-white/50 border border-white/[0.08]">
              <Clock className="w-3.5 h-3.5" />
              <span>{block.startTimestamp}</span>
              {block.startTimestamp !== block.endTimestamp && (
                <>
                  <span className="text-white/50">&rarr;</span>
                  <span>{block.endTimestamp}</span>
                </>
              )}
            </span>
          )}

          {/* Block text with optional speaker badges */}
          {hasSpeakers ? (
            <div className="space-y-2">
              {block.speakers.map((seg, segIdx) => {
                const color = seg.speaker ? speakerColorMap.get(seg.speaker) : null
                return (
                  <div key={segIdx}>
                    {seg.speaker && color && (
                      <span className={`inline-flex items-center px-2 py-0.5 mb-1 text-[0.625rem] font-semibold uppercase tracking-wider rounded-md ${color.bg} ${color.text} border ${color.border}`}>
                        {seg.speaker}
                      </span>
                    )}
                    <p className="text-sm text-white/70 leading-relaxed">
                      {seg.text}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-white/70 leading-relaxed">
              {block.speakers.map(s => s.text).join(" ")}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

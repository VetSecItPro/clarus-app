"use client"

import { useState, useMemo, useCallback, Fragment } from "react"
import { Clock, X, CheckCircle, XCircle, AlertCircle, HelpCircle, MessageCircle, ExternalLink } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useIsDesktop } from "@/lib/hooks/use-media-query"
import type { ClaimHighlight } from "@/types/database.types"

interface TranscriptBlock {
  startTimestamp: string
  endTimestamp: string
  startSeconds: number
  endSeconds: number
  text: string
}

interface HighlightedTranscriptProps {
  transcript: string
  claims: ClaimHighlight[]
  videoId?: string
  onTimestampClick?: (seconds: number) => void
  blockDuration?: number
}

interface TextSegment {
  text: string
  claim?: ClaimHighlight
  isHighlight: boolean
}

// Parse timestamp to seconds
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.replace(/[\[\]]/g, "").split(":").map(Number)
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

// Format seconds to display string
function formatSeconds(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// Parse transcript into segments
function parseTranscript(transcript: string): { timestamp: string; seconds: number; text: string }[] {
  const segments: { timestamp: string; seconds: number; text: string }[] = []
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

// Group segments into blocks
function groupIntoBlocks(
  segments: { timestamp: string; seconds: number; text: string }[],
  blockDuration: number
): TranscriptBlock[] {
  if (segments.length === 0) return []

  const blocks: TranscriptBlock[] = []
  let currentBlock: TranscriptBlock | null = null
  let blockStartTime = 0

  for (const segment of segments) {
    if (!currentBlock || segment.seconds >= blockStartTime + blockDuration) {
      if (currentBlock) {
        blocks.push(currentBlock)
      }
      blockStartTime = Math.floor(segment.seconds / blockDuration) * blockDuration
      currentBlock = {
        startTimestamp: formatSeconds(segment.seconds),
        endTimestamp: formatSeconds(segment.seconds),
        startSeconds: segment.seconds,
        endSeconds: segment.seconds,
        text: segment.text,
      }
    } else {
      currentBlock.text += " " + segment.text
      currentBlock.endTimestamp = formatSeconds(segment.seconds)
      currentBlock.endSeconds = segment.seconds
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock)
  }

  return blocks
}

// Find and highlight claims in text using fuzzy matching
function highlightClaimsInText(text: string, claims: ClaimHighlight[]): TextSegment[] {
  if (!claims || claims.length === 0) {
    return [{ text, isHighlight: false }]
  }

  // Normalize text for matching (lowercase, collapse whitespace)
  const normalizedText = text.toLowerCase().replace(/\s+/g, " ")

  // Find all matches with their positions
  const matches: { start: number; end: number; claim: ClaimHighlight }[] = []

  for (const claim of claims) {
    if (!claim.exact_text) continue

    const normalizedClaim = claim.exact_text.toLowerCase().replace(/\s+/g, " ").trim()
    if (!normalizedClaim) continue

    // Find the claim text in the normalized text
    let searchStart = 0
    while (true) {
      const index = normalizedText.indexOf(normalizedClaim, searchStart)
      if (index === -1) break

      // Map back to original text positions
      // Count characters in original text to find real position
      let origIndex = 0
      let normIndex = 0
      while (normIndex < index && origIndex < text.length) {
        const char = text[origIndex]
        if (/\s/.test(char)) {
          // Skip additional whitespace in original
          while (origIndex + 1 < text.length && /\s/.test(text[origIndex + 1])) {
            origIndex++
          }
        }
        origIndex++
        normIndex++
      }

      // Find end position
      let endOrigIndex = origIndex
      let endNormIndex = normIndex
      while (endNormIndex < index + normalizedClaim.length && endOrigIndex < text.length) {
        endOrigIndex++
        if (endOrigIndex < text.length && !/\s/.test(text[endOrigIndex - 1])) {
          endNormIndex++
        } else if (/\s/.test(text[endOrigIndex - 1])) {
          // Skip additional whitespace
          while (endOrigIndex < text.length && /\s/.test(text[endOrigIndex])) {
            endOrigIndex++
          }
          endNormIndex++
        }
      }

      matches.push({
        start: origIndex,
        end: endOrigIndex,
        claim,
      })

      searchStart = index + normalizedClaim.length
    }
  }

  if (matches.length === 0) {
    return [{ text, isHighlight: false }]
  }

  // Sort matches by position and remove overlaps
  matches.sort((a, b) => a.start - b.start)
  const nonOverlapping: typeof matches = []
  for (const match of matches) {
    if (nonOverlapping.length === 0 || match.start >= nonOverlapping[nonOverlapping.length - 1].end) {
      nonOverlapping.push(match)
    }
  }

  // Build segments
  const segments: TextSegment[] = []
  let lastEnd = 0

  for (const match of nonOverlapping) {
    // Add non-highlighted text before this match
    if (match.start > lastEnd) {
      segments.push({
        text: text.slice(lastEnd, match.start),
        isHighlight: false,
      })
    }
    // Add highlighted match
    segments.push({
      text: text.slice(match.start, match.end),
      claim: match.claim,
      isHighlight: true,
    })
    lastEnd = match.end
  }

  // Add remaining text
  if (lastEnd < text.length) {
    segments.push({
      text: text.slice(lastEnd),
      isHighlight: false,
    })
  }

  return segments
}

// Get status color classes
function getStatusColors(status: ClaimHighlight["status"]) {
  switch (status) {
    case "verified":
      return {
        bg: "bg-emerald-500/20 hover:bg-emerald-500/30",
        border: "border-b-2 border-emerald-500/50",
        text: "text-emerald-300",
        icon: CheckCircle,
        label: "Verified",
      }
    case "false":
      return {
        bg: "bg-red-500/20 hover:bg-red-500/30",
        border: "border-b-2 border-red-500/50",
        text: "text-red-300",
        icon: XCircle,
        label: "False",
      }
    case "disputed":
      return {
        bg: "bg-amber-500/20 hover:bg-amber-500/30",
        border: "border-b-2 border-amber-500/50",
        text: "text-amber-300",
        icon: AlertCircle,
        label: "Disputed",
      }
    case "unverified":
      return {
        bg: "bg-blue-500/20 hover:bg-blue-500/30",
        border: "border-b-2 border-blue-500/50",
        text: "text-blue-300",
        icon: HelpCircle,
        label: "Unverified",
      }
    case "opinion":
      return {
        bg: "bg-purple-500/20 hover:bg-purple-500/30",
        border: "border-b-2 border-purple-500/50",
        text: "text-purple-300",
        icon: MessageCircle,
        label: "Opinion",
      }
    default:
      return {
        bg: "bg-white/10 hover:bg-white/20",
        border: "border-b-2 border-white/30",
        text: "text-white/70",
        icon: HelpCircle,
        label: "Unknown",
      }
  }
}

// Desktop Highlight Component with Tooltip
function DesktopHighlight({ segment, onClick }: { segment: TextSegment; onClick: () => void }) {
  if (!segment.claim) return null

  const colors = getStatusColors(segment.claim.status)
  const Icon = colors.icon

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            className={`cursor-pointer rounded px-0.5 -mx-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none ${colors.bg} ${colors.border}`}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } }}
            aria-label={`Claim: ${segment.claim?.exact_text?.slice(0, 50) ?? "View claim details"}`}
          >
            {segment.text}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3 space-y-2">
          <div className={`flex items-center gap-2 ${colors.text}`}>
            <Icon className="w-4 h-4" />
            <span className="font-medium text-sm">{colors.label}</span>
          </div>
          <p className="text-white/80 text-xs leading-relaxed">
            {segment.claim.explanation}
          </p>
          {segment.claim.sources && segment.claim.sources.length > 0 && (
            <div className="pt-1 border-t border-white/10">
              <p className="text-white/50 text-[0.625rem] uppercase tracking-wider mb-1">Sources</p>
              <div className="flex flex-wrap gap-1">
                {segment.claim.sources.slice(0, 2).map((source, i) => (
                  <span key={i} className="text-[0.625rem] text-brand truncate max-w-[120px]">
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-white/40 text-[0.625rem]">Click for full details</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Mobile Highlight Component - simple tap target
function MobileHighlight({ segment, onClick }: { segment: TextSegment; onClick: () => void }) {
  if (!segment.claim) return null

  const colors = getStatusColors(segment.claim.status)

  return (
    <span
      role="button"
      tabIndex={0}
      className={`rounded px-0.5 -mx-0.5 active:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none ${colors.bg} ${colors.border}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } }}
      aria-label={`Claim: ${segment.claim?.exact_text?.slice(0, 50) ?? "View claim details"}`}
    >
      {segment.text}
    </span>
  )
}

// Mobile Bottom Sheet for claim details
function ClaimDetailSheet({
  claim,
  onClose
}: {
  claim: ClaimHighlight | null
  onClose: () => void
}) {
  if (!claim) return null

  const colors = getStatusColors(claim.status)
  const Icon = colors.icon

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          role="dialog"
          aria-modal="true"
          aria-label="Claim details"
          className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-3xl border-t border-white/10 max-h-[70vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="sticky top-0 pt-3 pb-2 bg-[#1a1a1a] z-10">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
          </div>

          <div className="px-5 pb-8 pt-2">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${colors.bg}`}>
                <Icon className={`w-4 h-4 ${colors.text}`} />
                <span className={`font-medium text-sm ${colors.text}`}>{colors.label}</span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Claim text */}
            <div className="mb-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Claim</p>
              <p className={`text-base text-white/90 font-medium p-3 rounded-xl ${colors.bg} border border-white/10`}>
                "{claim.exact_text}"
              </p>
            </div>

            {/* Explanation */}
            <div className="mb-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Assessment</p>
              <p className="text-sm text-white/80 leading-relaxed">
                {claim.explanation}
              </p>
            </div>

            {/* Severity */}
            {claim.severity && (
              <div className="mb-4">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Severity</p>
                <span className={`inline-block px-2 py-0.5 rounded text-xs capitalize ${
                  claim.severity === "high" ? "bg-red-500/20 text-red-300" :
                  claim.severity === "medium" ? "bg-amber-500/20 text-amber-300" :
                  "bg-white/10 text-white/60"
                }`}>
                  {claim.severity}
                </span>
              </div>
            )}

            {/* Timestamp */}
            {claim.timestamp && (
              <div className="mb-4">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Timestamp</p>
                <div className="flex items-center gap-2 text-sm text-brand">
                  <Clock className="w-4 h-4" />
                  <span>{claim.timestamp}</span>
                </div>
              </div>
            )}

            {/* Sources */}
            {claim.sources && claim.sources.length > 0 && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Sources</p>
                <div className="space-y-2">
                  {claim.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source.startsWith("http") ? source : `https://${source}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-brand" />
                      <span className="text-sm text-brand truncate">{source}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Desktop Detail Modal (for when clicking on highlight)
function ClaimDetailModal({
  claim,
  onClose
}: {
  claim: ClaimHighlight | null
  onClose: () => void
}) {
  if (!claim) return null

  const colors = getStatusColors(claim.status)
  const Icon = colors.icon

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 400 }}
          className="bg-[#1a1a1a] rounded-2xl border border-white/10 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${colors.bg}`}>
                <Icon className={`w-4 h-4 ${colors.text}`} />
                <span className={`font-medium text-sm ${colors.text}`}>{colors.label}</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Claim text */}
            <div className="mb-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Claim</p>
              <p className={`text-sm text-white/90 font-medium p-3 rounded-xl ${colors.bg} border border-white/10`}>
                "{claim.exact_text}"
              </p>
            </div>

            {/* Explanation */}
            <div className="mb-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Assessment</p>
              <p className="text-sm text-white/80 leading-relaxed">
                {claim.explanation}
              </p>
            </div>

            {/* Severity & Timestamp row */}
            <div className="flex items-center gap-4 mb-4">
              {claim.severity && (
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Severity</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs capitalize ${
                    claim.severity === "high" ? "bg-red-500/20 text-red-300" :
                    claim.severity === "medium" ? "bg-amber-500/20 text-amber-300" :
                    "bg-white/10 text-white/60"
                  }`}>
                    {claim.severity}
                  </span>
                </div>
              )}
              {claim.timestamp && (
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Timestamp</p>
                  <div className="flex items-center gap-1.5 text-sm text-brand">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{claim.timestamp}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Sources */}
            {claim.sources && claim.sources.length > 0 && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Sources</p>
                <div className="space-y-2">
                  {claim.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source.startsWith("http") ? source : `https://${source}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 text-brand" />
                      <span className="text-xs text-brand truncate">{source}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Claims Legend Component
function ClaimsLegend({ claims }: { claims: ClaimHighlight[] }) {
  const statusCounts = useMemo(() => {
    const counts: Record<ClaimHighlight["status"], number> = {
      verified: 0,
      false: 0,
      disputed: 0,
      unverified: 0,
      opinion: 0,
    }
    for (const claim of claims) {
      if (claim.status in counts) {
        counts[claim.status]++
      }
    }
    return counts
  }, [claims])

  const activeStatuses = Object.entries(statusCounts).filter(([_, count]) => count > 0)

  if (activeStatuses.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <span className="text-xs text-white/40 mr-1">Legend:</span>
      {activeStatuses.map(([status, count]) => {
        const colors = getStatusColors(status as ClaimHighlight["status"])
        const Icon = colors.icon
        return (
          <div key={status} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${colors.bg}`}>
            <Icon className={`w-3 h-3 ${colors.text}`} />
            <span className={`text-xs ${colors.text}`}>{colors.label}</span>
            <span className="text-xs text-white/40">({count})</span>
          </div>
        )
      })}
    </div>
  )
}

// Main Component
export function HighlightedTranscript({
  transcript,
  claims,
  videoId,
  onTimestampClick,
  blockDuration = 20,
}: HighlightedTranscriptProps) {
  const [selectedClaim, setSelectedClaim] = useState<ClaimHighlight | null>(null)
  const isDesktop = useIsDesktop()

  const segments = useMemo(() => parseTranscript(transcript), [transcript])
  const blocks = useMemo(() => groupIntoBlocks(segments, blockDuration), [segments, blockDuration])

  const handleTimestampClick = useCallback((seconds: number) => {
    if (onTimestampClick) {
      onTimestampClick(seconds)
    } else if (videoId) {
      window.open(`https://youtube.com/watch?v=${videoId}&t=${seconds}s`, "_blank")
    }
  }, [onTimestampClick, videoId])

  const handleClaimClick = useCallback((claim: ClaimHighlight) => {
    setSelectedClaim(claim)
  }, [])

  // If no timestamps found, show plain text with highlights
  if (segments.length === 0) {
    const textSegments = highlightClaimsInText(transcript, claims)

    return (
      <div className="space-y-4">
        {claims.length > 0 && <ClaimsLegend claims={claims} />}
        <div className="prose prose-sm prose-invert max-w-none text-white/70 leading-relaxed whitespace-pre-wrap">
          {textSegments.map((segment, i) => (
            <Fragment key={i}>
              {segment.isHighlight ? (
                isDesktop ? (
                  <DesktopHighlight
                    segment={segment}
                    onClick={() => handleClaimClick(segment.claim!)}
                  />
                ) : (
                  <MobileHighlight
                    segment={segment}
                    onClick={() => handleClaimClick(segment.claim!)}
                  />
                )
              ) : (
                segment.text
              )}
            </Fragment>
          ))}
        </div>

        {/* Detail Modal/Sheet */}
        {isDesktop ? (
          <ClaimDetailModal claim={selectedClaim} onClose={() => setSelectedClaim(null)} />
        ) : (
          selectedClaim && <ClaimDetailSheet claim={selectedClaim} onClose={() => setSelectedClaim(null)} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {claims.length > 0 && <ClaimsLegend claims={claims} />}

      {blocks.map((block, index) => {
        const textSegments = highlightClaimsInText(block.text, claims)

        return (
          <div
            key={index}
            className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group border border-white/[0.04]"
          >
            {/* Time range header */}
            <button
              onClick={() => handleTimestampClick(block.startSeconds)}
              className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 text-xs font-mono rounded-lg bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20 transition-all"
              title={`Jump to ${block.startTimestamp} in video`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{block.startTimestamp}</span>
              {block.startTimestamp !== block.endTimestamp && (
                <>
                  <span className="text-brand/50">→</span>
                  <span>{block.endTimestamp}</span>
                </>
              )}
            </button>

            {/* Block text with highlights */}
            <p className="text-sm text-white/70 leading-relaxed">
              {textSegments.map((segment, i) => (
                <Fragment key={i}>
                  {segment.isHighlight ? (
                    isDesktop ? (
                      <DesktopHighlight
                        segment={segment}
                        onClick={() => handleClaimClick(segment.claim!)}
                      />
                    ) : (
                      <MobileHighlight
                        segment={segment}
                        onClick={() => handleClaimClick(segment.claim!)}
                      />
                    )
                  ) : (
                    segment.text
                  )}
                </Fragment>
              ))}
            </p>
          </div>
        )
      })}

      {/* Detail Modal/Sheet */}
      {isDesktop ? (
        <ClaimDetailModal claim={selectedClaim} onClose={() => setSelectedClaim(null)} />
      ) : (
        selectedClaim && <ClaimDetailSheet claim={selectedClaim} onClose={() => setSelectedClaim(null)} />
      )}
    </div>
  )
}

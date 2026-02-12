"use client"

import { motion } from "framer-motion"
import { useState, useCallback, type ReactNode } from "react"
import Link from "next/link"
import { ExternalLink, Flag } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TruthCheckData, CitationSource } from "@/types/database.types"
import { classifySource } from "@/lib/source-classification"

interface CrossReferenceMatch {
  contentId: string
  contentTitle: string
  claimText: string
  status: string
  similarityScore: number
}

export interface CrossReference {
  claimText: string
  matches: CrossReferenceMatch[]
}

interface ClaimFlag {
  claim_index: number
  flag_reason: string | null
}

interface TruthCheckCardProps {
  truthCheck: TruthCheckData
  crossReferences?: CrossReference[]
  contentId?: string
  claimFlags?: ClaimFlag[]
  onFlagClaim?: (claimIndex: number) => void
  /** Original issue index to highlight (from timeline marker click) */
  highlightedIssueIndex?: number
}

// Severity sort order: high first, then medium, then low
const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

// Severity badge styles
const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  high: { bg: "bg-red-500/15", border: "border-red-500/25", text: "text-red-400" },
  medium: { bg: "bg-amber-500/15", border: "border-amber-500/25", text: "text-amber-400" },
  low: { bg: "bg-emerald-500/15", border: "border-emerald-500/25", text: "text-emerald-400" },
}

function CrossRefBadge({ matches }: { matches: CrossReferenceMatch[] }) {
  const [isOpen, setIsOpen] = useState(false)

  if (matches.length === 0) return null

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-medium hover:bg-purple-500/30 transition-all cursor-pointer"
        title={`This claim appears in ${matches.length} other ${matches.length === 1 ? "analysis" : "analyses"}`}
      >
        Seen in {matches.length} other {matches.length === 1 ? "analysis" : "analyses"}
      </button>
      {isOpen && (
        <div className="absolute z-20 top-full left-0 mt-1.5 w-64 bg-black/95 border border-purple-500/30 rounded-xl shadow-xl p-3 space-y-2">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
            Also appears in:
          </div>
          {matches.map((match) => (
            <Link
              key={`${match.contentId}-${match.claimText.slice(0, 20)}`}
              href={`/item/${match.contentId}`}
              className="block p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
              onClick={() => setIsOpen(false)}
            >
              <div className="text-xs text-white/80 font-medium line-clamp-2">
                {match.contentTitle}
              </div>
              <div className="text-[10px] text-purple-300/60 mt-1">
                {Math.round(match.similarityScore * 100)}% match
              </div>
            </Link>
          ))}
          <button
            className="text-[10px] text-white/30 hover:text-white/50 w-full text-center pt-1"
            onClick={() => setIsOpen(false)}
          >
            Close
          </button>
        </div>
      )}
      {isOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
      )}
    </span>
  )
}

/**
 * Renders assessment text with Perplexity-style [N] inline citations.
 */
function InlineCitedText({ text, references }: { text: string; references?: CitationSource[] }) {
  if (!references || references.length === 0) {
    return <span>{text}</span>
  }

  const parts: ReactNode[] = []
  const regex = /\[(\d+)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const refNum = parseInt(match[1], 10)
    const ref = refNum >= 1 && refNum <= references.length ? references[refNum - 1] : null

    if (ref) {
      parts.push(
        <a
          key={`cite-${match.index}`}
          href={ref.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-[#1d9bf0] font-semibold cursor-pointer hover:underline align-super ml-0.5 mr-0.5"
          title={`${ref.title} — ${ref.url}`}
        >
          [{refNum}]
        </a>
      )
    } else {
      parts.push(match[0])
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <span>{parts}</span>
}

/** Legacy per-issue citation links (backward compat for cached analyses without top-level references) */
function LegacyCitationLinks({ sources }: { sources: CitationSource[] }) {
  if (sources.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {sources.map((source, i) => {
        let displayTitle = source.title
        if (!displayTitle) {
          try {
            displayTitle = new URL(source.url).hostname.replace("www.", "")
          } catch {
            displayTitle = source.url
          }
        }

        return (
          <a
            key={`${source.url}-${i}`}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 text-[#1d9bf0] text-[10px] hover:bg-[#1d9bf0]/20 transition-colors max-w-[200px]"
            title={source.url}
          >
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{displayTitle}</span>
          </a>
        )
      })}
    </div>
  )
}

/** Numbered reference list with source credibility badges */
function ReferenceList({ references }: { references: CitationSource[] }) {
  if (references.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.35 }}
    >
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Sources</div>
      <div className="space-y-1.5">
        {references.map((ref, i) => {
          let domain: string
          try {
            domain = new URL(ref.url).hostname.replace("www.", "")
          } catch {
            domain = ref.url
          }

          const classification = classifySource(ref.url)

          return (
            <div key={ref.url} className="flex items-center gap-2">
              <span className="text-[11px] text-[#1d9bf0] font-semibold shrink-0 mt-px w-4 text-right">
                {i + 1}.
              </span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0",
                classification.bg, classification.border, classification.color,
                "border"
              )}>
                {classification.label}
              </span>
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/60 hover:text-[#1d9bf0] transition-colors flex items-center gap-1 min-w-0"
              >
                <span className="truncate">
                  {ref.title && ref.title !== domain ? `${ref.title} — ` : ""}{domain}
                </span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0 text-white/30" />
              </a>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

/** Flag button for individual truth check issues */
function ClaimFlagButton({ issueIndex, isFlagged, onFlag }: {
  issueIndex: number
  isFlagged: boolean
  onFlag?: (index: number) => void
}) {
  const [submitting, setSubmitting] = useState(false)

  const handleClick = useCallback(async () => {
    if (!onFlag || submitting) return
    setSubmitting(true)
    try {
      onFlag(issueIndex)
    } finally {
      setSubmitting(false)
    }
  }, [issueIndex, onFlag, submitting])

  if (!onFlag) return null

  return (
    <button
      onClick={handleClick}
      disabled={submitting}
      aria-label={isFlagged ? "Inaccuracy flagged" : "Flag as inaccurate"}
      title={isFlagged ? "You flagged this as inaccurate" : "Flag as inaccurate"}
      className={cn(
        "p-1 rounded transition-all",
        isFlagged
          ? "text-red-400 bg-red-500/15"
          : "text-white/25 hover:text-red-400 hover:bg-red-500/10"
      )}
    >
      <Flag className={cn("w-3 h-3", isFlagged && "fill-current")} />
    </button>
  )
}

function findMatchesForClaim(claim: string, crossReferences: CrossReference[]): CrossReferenceMatch[] {
  const normalizedClaim = claim.toLowerCase().trim()
  for (const ref of crossReferences) {
    const normalizedRef = ref.claimText.toLowerCase().trim()
    if (
      normalizedClaim === normalizedRef ||
      normalizedClaim.includes(normalizedRef) ||
      normalizedRef.includes(normalizedClaim)
    ) {
      return ref.matches
    }
  }
  return []
}

export function TruthCheckCard({ truthCheck, crossReferences, contentId, claimFlags, onFlagClaim, highlightedIssueIndex }: TruthCheckCardProps) {
  const hasReferences = truthCheck.references && truthCheck.references.length > 0

  const getIssueIcon = (type: string) => {
    const icons: Record<string, string> = {
      "misinformation": "\u{1F6AB}",
      "misleading": "\u{26A0}\u{FE0F}",
      "bias": "\u{2696}\u{FE0F}",
      "unjustified_certainty": "\u{2753}",
      "missing_context": "\u{1F4DD}",
    }
    return icons[type] || "\u{26A0}\u{FE0F}"
  }

  // Sort issues by severity: high → medium → low
  const sortedIssues = truthCheck.issues
    ? [...truthCheck.issues].sort((a, b) => {
        const aOrder = SEVERITY_ORDER[a.severity] ?? 99
        const bOrder = SEVERITY_ORDER[b.severity] ?? 99
        return aOrder - bOrder
      })
    : []

  // Build a map from original index to sorted position for flag lookup
  const flaggedIndices = new Set(claimFlags?.map(f => f.claim_index) ?? [])

  return (
    <div className="space-y-5">
      {/* Overall Rating */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Overall Rating</div>
        <div className="text-lg font-semibold text-white">{truthCheck.overall_rating}</div>
      </motion.div>

      {/* Issues — sorted by severity */}
      {sortedIssues.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="text-xs text-white/40 uppercase tracking-wider mb-3">
            Issues Found ({sortedIssues.length})
          </div>
          <div className="space-y-4">
            {sortedIssues.map((issue, sortedIdx) => {
              // Find original index for flag lookup
              const originalIndex = truthCheck.issues.indexOf(issue)
              const matches = crossReferences
                ? findMatchesForClaim(issue.claim_or_issue, crossReferences)
                : []
              const severityStyle = SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.medium
              const isFlagged = flaggedIndices.has(originalIndex)
              const isHighlighted = highlightedIssueIndex === originalIndex

              return (
                <div
                  key={sortedIdx}
                  data-issue-index={originalIndex}
                  className={cn(
                    "flex items-start gap-3 rounded-xl px-2 py-2 -mx-2 transition-all duration-500",
                    isHighlighted && "bg-white/[0.06] ring-1 ring-white/[0.12]"
                  )}
                >
                  <span className="text-base mt-0.5">{getIssueIcon(issue.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="text-sm text-white/90 font-medium">{issue.claim_or_issue}</div>
                      {contentId && (
                        <ClaimFlagButton
                          issueIndex={originalIndex}
                          isFlagged={isFlagged}
                          onFlag={onFlagClaim}
                        />
                      )}
                    </div>
                    <div className="text-xs text-white/60 mb-1.5">
                      {hasReferences ? (
                        <InlineCitedText text={issue.assessment} references={truthCheck.references} />
                      ) : (
                        issue.assessment
                      )}
                    </div>
                    <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap">
                      {issue.timestamp && <span>{issue.timestamp}</span>}
                      {/* Severity badge with color coding */}
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium border capitalize",
                        severityStyle.bg, severityStyle.border, severityStyle.text
                      )}>
                        {issue.severity}
                      </span>
                      <span className="capitalize text-white/30">{issue.type.replace("_", " ")}</span>
                      {matches.length > 0 && (
                        <CrossRefBadge matches={matches} />
                      )}
                      {isFlagged && (
                        <span className="text-[10px] text-red-400/60 flex items-center gap-0.5">
                          <Flag className="w-2.5 h-2.5" /> Flagged
                        </span>
                      )}
                    </div>
                    {/* Legacy per-issue citation links */}
                    {!hasReferences && issue.sources && issue.sources.length > 0 && (
                      <LegacyCitationLinks sources={issue.sources} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Strengths */}
      {truthCheck.strengths && truthCheck.strengths.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Strengths</div>
          <div className="space-y-1.5">
            {truthCheck.strengths.map((strength, i) => (
              <div key={i} className="text-sm text-white/70 flex items-start gap-2">
                <span className="text-white/50">{"\u2713"}</span>
                <span>{strength}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sources Quality */}
      {truthCheck.sources_quality && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Sources Quality</div>
          <div className="text-sm text-white/70">{truthCheck.sources_quality}</div>
        </motion.div>
      )}

      {/* Reference List with credibility badges */}
      {hasReferences && (
        <ReferenceList references={truthCheck.references!} />
      )}
    </div>
  )
}

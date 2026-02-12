"use client"

import { motion } from "framer-motion"
import { useState, type ReactNode } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import type { TruthCheckData, CitationSource } from "@/types/database.types"

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

interface TruthCheckCardProps {
  truthCheck: TruthCheckData
  crossReferences?: CrossReference[]
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
 * Parses `[1]`, `[2]`, etc. and renders them as superscript links that
 * either scroll to the reference list or open the source URL directly.
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
    // Add text before the citation
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
      // Invalid ref number — render as plain text
      parts.push(match[0])
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text after last citation
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

/** Numbered reference list rendered at the bottom of the truth check section */
function ReferenceList({ references }: { references: CitationSource[] }) {
  if (references.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.35 }}
    >
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Sources</div>
      <div className="space-y-1">
        {references.map((ref, i) => {
          let domain: string
          try {
            domain = new URL(ref.url).hostname.replace("www.", "")
          } catch {
            domain = ref.url
          }

          return (
            <div key={ref.url} className="flex items-start gap-2">
              <span className="text-[11px] text-[#1d9bf0] font-semibold shrink-0 mt-px w-4 text-right">
                {i + 1}.
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

export function TruthCheckCard({ truthCheck, crossReferences }: TruthCheckCardProps) {
  // Determine if we have top-level references (new Perplexity-style) or need legacy per-issue links
  const hasReferences = truthCheck.references && truthCheck.references.length > 0

  const getIssueIcon = (type: string) => {
    const icons: Record<string, string> = {
      "misinformation": "🚫",
      "misleading": "⚠️",
      "bias": "⚖️",
      "unjustified_certainty": "❓",
      "missing_context": "📝",
    }
    return icons[type] || "⚠️"
  }

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

      {/* Issues */}
      {truthCheck.issues && truthCheck.issues.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="text-xs text-white/40 uppercase tracking-wider mb-3">
            Issues Found ({truthCheck.issues.length})
          </div>
          <div className="space-y-4">
            {truthCheck.issues.map((issue, i) => {
              const matches = crossReferences
                ? findMatchesForClaim(issue.claim_or_issue, crossReferences)
                : []
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-base mt-0.5">{getIssueIcon(issue.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90 font-medium mb-1">{issue.claim_or_issue}</div>
                    <div className="text-xs text-white/60 mb-1">
                      {hasReferences ? (
                        <InlineCitedText text={issue.assessment} references={truthCheck.references} />
                      ) : (
                        issue.assessment
                      )}
                    </div>
                    <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap">
                      <span>
                        {issue.timestamp && <span className="mr-2">{issue.timestamp}</span>}
                        <span className="capitalize">{issue.severity} · {issue.type.replace("_", " ")}</span>
                      </span>
                      {matches.length > 0 && (
                        <CrossRefBadge matches={matches} />
                      )}
                    </div>
                    {/* Legacy per-issue citation links — only when no top-level references */}
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
                <span className="text-white/50">✓</span>
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

      {/* Reference List — Perplexity-style numbered sources at bottom */}
      {hasReferences && (
        <ReferenceList references={truthCheck.references!} />
      )}
    </div>
  )
}

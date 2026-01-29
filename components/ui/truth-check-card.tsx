"use client"

import { motion } from "framer-motion"
import { useState } from "react"
import Link from "next/link"
import type { TruthCheckData } from "@/types/database.types"

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

  // Find cross-references whose source claim is similar to this issue's claim
  // Simple: match by checking if any cross-ref claimText overlaps
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
          {/* Invisible close helper */}
          <button
            className="text-[10px] text-white/30 hover:text-white/50 w-full text-center pt-1"
            onClick={() => setIsOpen(false)}
          >
            Close
          </button>
        </div>
      )}
      {/* Click-outside to close */}
      {isOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
      )}
    </span>
  )
}

function findMatchesForClaim(claim: string, crossReferences: CrossReference[]): CrossReferenceMatch[] {
  // Find exact or near-exact match in cross-references
  const normalizedClaim = claim.toLowerCase().trim()
  for (const ref of crossReferences) {
    const normalizedRef = ref.claimText.toLowerCase().trim()
    // Check if the claim text is substantially similar
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
                    <div className="text-xs text-white/60 mb-1">{issue.assessment}</div>
                    <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap">
                      <span>
                        {issue.timestamp && <span className="mr-2">{issue.timestamp}</span>}
                        <span className="capitalize">{issue.severity} · {issue.type.replace("_", " ")}</span>
                      </span>
                      {matches.length > 0 && (
                        <CrossRefBadge matches={matches} />
                      )}
                    </div>
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
    </div>
  )
}

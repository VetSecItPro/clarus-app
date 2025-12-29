"use client"

import { motion } from "framer-motion"
import type { TruthCheckData } from "@/types/database.types"

interface TruthCheckCardProps {
  truthCheck: TruthCheckData
}

export function TruthCheckCard({ truthCheck }: TruthCheckCardProps) {
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
            {truthCheck.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-base mt-0.5">{getIssueIcon(issue.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/90 font-medium mb-1">{issue.claim_or_issue}</div>
                  <div className="text-xs text-white/60 mb-1">{issue.assessment}</div>
                  <div className="text-xs text-white/40">
                    {issue.timestamp && <span className="mr-2">{issue.timestamp}</span>}
                    <span className="capitalize">{issue.severity} · {issue.type.replace("_", " ")}</span>
                  </div>
                </div>
              </div>
            ))}
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

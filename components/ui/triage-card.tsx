"use client"

import { motion } from "framer-motion"
import type { TriageData } from "@/types/database.types"

interface TriageCardProps {
  triage: TriageData
}

// Recommendation labels for signal_noise_score (0-3)
const RECOMMENDATION_LABELS = [
  { label: "Skip", color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
  { label: "Skim", color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" },
  { label: "Worth It", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" },
  { label: "Must See", color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
]

export function TriageCard({ triage }: TriageCardProps) {
  const recommendation = RECOMMENDATION_LABELS[triage.signal_noise_score] || RECOMMENDATION_LABELS[0]

  return (
    <div className="space-y-5">
      {/* Scores Section - Quality and Recommendation together */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Quality Score */}
          <div className="flex items-center gap-3">
            <div className="text-xs text-white/40 uppercase tracking-wider">Quality</div>
            <div className="text-2xl font-bold text-white">
              {triage.quality_score}
              <span className="text-base text-white/40">/10</span>
            </div>
          </div>

          {/* Recommendation Score */}
          <div className="flex items-center gap-3">
            <div className="text-xs text-white/40 uppercase tracking-wider">Recommendation</div>
            <div className={`px-3 py-1.5 rounded-full ${recommendation.bg} ${recommendation.border} border`}>
              <span className={`text-sm font-semibold ${recommendation.color}`}>
                {recommendation.label}
              </span>
            </div>
          </div>
        </div>

        {/* Quality progress bar */}
        <div className="mt-3 h-2 bg-white/[0.1] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${triage.quality_score * 10}%` }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="h-full rounded-full bg-brand"
          />
        </div>
      </motion.div>

      {/* Worth Your Time */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Worth Your Time?</div>
        <div className="text-sm text-white/90">{triage.worth_your_time}</div>
      </motion.div>

      {/* Target Audience */}
      {triage.target_audience && triage.target_audience.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Target Audience</div>
          <div className="text-sm text-white/70">
            {triage.target_audience.join(" · ")}
          </div>
        </motion.div>
      )}

      {/* Content Density */}
      {triage.content_density && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Content Density</div>
          <div className="text-sm text-white/70">{triage.content_density}</div>
        </motion.div>
      )}
    </div>
  )
}

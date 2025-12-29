"use client"

import { motion } from "framer-motion"
import type { TriageData } from "@/types/database.types"

interface TriageCardProps {
  triage: TriageData
}

export function TriageCard({ triage }: TriageCardProps) {
  return (
    <div className="space-y-5">
      {/* Quality Score */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-4"
      >
        <div className="text-4xl font-bold text-white">
          {triage.quality_score}
          <span className="text-xl text-white/40">/10</span>
        </div>
        <div className="flex-1 h-2 bg-white/[0.1] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${triage.quality_score * 10}%` }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="h-full rounded-full bg-[#1d9bf0]"
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

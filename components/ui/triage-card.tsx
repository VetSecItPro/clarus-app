"use client"

import { motion } from "framer-motion"
import { Gauge, Users, Clock, Sparkles } from "lucide-react"
import type { TriageData } from "@/types/database.types"

interface TriageCardProps {
  triage: TriageData
}

export function TriageCard({ triage }: TriageCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-400"
    if (score >= 6) return "text-emerald-400"
    if (score >= 4) return "text-yellow-400"
    return "text-red-400"
  }

  const getScoreGradient = (score: number) => {
    if (score >= 8) return "from-green-500/20 to-green-500/5"
    if (score >= 6) return "from-emerald-500/20 to-emerald-500/5"
    if (score >= 4) return "from-yellow-500/20 to-yellow-500/5"
    return "from-red-500/20 to-red-500/5"
  }

  const getWorthItStyle = (worth: string) => {
    const lower = worth.toLowerCase()
    if (lower.startsWith("yes")) return "bg-green-500/20 text-green-300 border-green-500/30"
    if (lower.startsWith("maybe")) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
    return "bg-red-500/20 text-red-300 border-red-500/30"
  }

  return (
    <div className="space-y-4">
      {/* Quality Score - Hero */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`p-4 rounded-xl bg-gradient-to-br ${getScoreGradient(triage.quality_score)} border border-white/[0.08]`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.08]">
              <Gauge className="w-5 h-5 text-white/70" />
            </div>
            <div>
              <div className="text-xs text-white/50 mb-0.5">Quality Score</div>
              <div className={`text-3xl font-bold ${getScoreColor(triage.quality_score)}`}>
                {triage.quality_score}
                <span className="text-lg text-white/40">/10</span>
              </div>
            </div>
          </div>
          {/* Score bar */}
          <div className="w-24 h-2 bg-white/[0.1] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${triage.quality_score * 10}%` }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className={`h-full rounded-full ${
                triage.quality_score >= 8 ? "bg-green-400" :
                triage.quality_score >= 6 ? "bg-emerald-400" :
                triage.quality_score >= 4 ? "bg-yellow-400" : "bg-red-400"
              }`}
            />
          </div>
        </div>
      </motion.div>

      {/* Worth Your Time */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white/[0.06] shrink-0">
            <Clock className="w-4 h-4 text-white/60" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/50 mb-1.5">Worth Your Time?</div>
            <span className={`inline-block px-2.5 py-1 text-sm font-medium rounded-lg border break-words ${getWorthItStyle(triage.worth_your_time)}`}>
              {triage.worth_your_time}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Target Audience */}
      {triage.target_audience && triage.target_audience.length > 0 && (
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white/[0.06] shrink-0">
              <Users className="w-4 h-4 text-white/60" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white/50 mb-2">Target Audience</div>
              <div className="flex flex-wrap gap-2">
                {triage.target_audience.map((audience, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.3 + i * 0.05 }}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[#1d9bf0]/15 text-[#1d9bf0] border border-[#1d9bf0]/25 break-words"
                  >
                    {audience}
                  </motion.span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Content Density */}
      {triage.content_density && (
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white/[0.06] shrink-0">
              <Sparkles className="w-4 h-4 text-white/60" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white/50 mb-1">Content Density</div>
              <div className="text-sm text-white/80 break-words">{triage.content_density}</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

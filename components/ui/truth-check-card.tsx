"use client"

import { motion } from "framer-motion"
import { Shield, AlertTriangle, CheckCircle2, XCircle, AlertCircle, HelpCircle, Clock } from "lucide-react"
import type { TruthCheckData } from "@/types/database.types"

interface TruthCheckCardProps {
  truthCheck: TruthCheckData
}

export function TruthCheckCard({ truthCheck }: TruthCheckCardProps) {
  const getRatingConfig = (rating: string) => {
    const configs: Record<string, { color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
      "Accurate": {
        color: "text-green-400",
        bg: "bg-green-500/15",
        border: "border-green-500/30",
        icon: CheckCircle2,
      },
      "Mostly Accurate": {
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/30",
        icon: CheckCircle2,
      },
      "Mixed": {
        color: "text-yellow-400",
        bg: "bg-yellow-500/15",
        border: "border-yellow-500/30",
        icon: AlertCircle,
      },
      "Questionable": {
        color: "text-orange-400",
        bg: "bg-orange-500/15",
        border: "border-orange-500/30",
        icon: HelpCircle,
      },
      "Unreliable": {
        color: "text-red-400",
        bg: "bg-red-500/15",
        border: "border-red-500/30",
        icon: XCircle,
      },
    }
    return configs[rating] || configs["Mixed"]
  }

  const getSeverityStyle = (severity: string) => {
    if (severity === "high") return "bg-red-500/20 text-red-300 border-red-500/30"
    if (severity === "medium") return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
    return "bg-blue-500/20 text-blue-300 border-blue-500/30"
  }

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

  const ratingConfig = getRatingConfig(truthCheck.overall_rating)
  const RatingIcon = ratingConfig.icon

  return (
    <div className="space-y-4">
      {/* Overall Rating Badge */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl ${ratingConfig.bg} ${ratingConfig.border} border`}
      >
        <RatingIcon className={`w-5 h-5 ${ratingConfig.color}`} />
        <span className={`text-base font-semibold ${ratingConfig.color}`}>
          {truthCheck.overall_rating}
        </span>
      </motion.div>

      {/* Issues */}
      {truthCheck.issues && truthCheck.issues.length > 0 && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 text-xs text-white/50">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Issues Found ({truthCheck.issues.length})</span>
          </div>
          <div className="space-y-2">
            {truthCheck.issues.map((issue, i) => (
              <motion.div
                key={i}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg">{getIssueIcon(issue.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90 font-medium mb-1">
                      {issue.claim_or_issue}
                    </div>
                    <div className="text-xs text-white/60 mb-2">
                      {issue.assessment}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {issue.timestamp && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          <Clock className="w-2.5 h-2.5" />
                          {issue.timestamp}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-md border ${getSeverityStyle(issue.severity)}`}>
                        {issue.severity}
                      </span>
                      <span className="text-[10px] text-white/40 capitalize">
                        {issue.type.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Strengths */}
      {truthCheck.strengths && truthCheck.strengths.length > 0 && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Shield className="w-3.5 h-3.5" />
            <span>Strengths</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {truthCheck.strengths.map((strength, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2, delay: 0.25 + i * 0.05 }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/10 text-green-300 border border-green-500/20"
              >
                ✓ {strength}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sources Quality */}
      {truthCheck.sources_quality && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]"
        >
          <div className="text-xs text-white/50 mb-1">Sources Quality</div>
          <div className="text-sm text-white/80">{truthCheck.sources_quality}</div>
        </motion.div>
      )}
    </div>
  )
}

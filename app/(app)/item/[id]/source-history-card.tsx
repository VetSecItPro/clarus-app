"use client"

import { Shield } from "lucide-react"

interface DomainStats {
  total_analyses: number
  avg_quality_score: number | null
  accurate_count: number
  mostly_accurate_count: number
  mixed_count: number
  questionable_count: number
  unreliable_count: number
}

interface SourceHistoryCardProps {
  domainStats: DomainStats
  displayDomain: string
}

export function SourceHistoryCard({ domainStats, displayDomain }: SourceHistoryCardProps) {
  if (domainStats.total_analyses <= 0) return null

  const totalRatings =
    domainStats.accurate_count +
    domainStats.mostly_accurate_count +
    domainStats.mixed_count +
    domainStats.questionable_count +
    domainStats.unreliable_count

  return (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-blue-400 shrink-0" />
        <h3 className="text-sm font-semibold text-white">Source History</h3>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-gray-400">
          <span className="text-white font-medium">{displayDomain}</span> has been analyzed{" "}
          <span className="text-white font-medium">{domainStats.total_analyses}</span> time{domainStats.total_analyses !== 1 ? "s" : ""}
        </p>
        {domainStats.avg_quality_score !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 shrink-0">Avg Quality:</span>
            <div className="flex-1 min-w-0 h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                style={{ width: `${(domainStats.avg_quality_score / 10) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-white shrink-0">{domainStats.avg_quality_score.toFixed(1)}/10</span>
          </div>
        )}
        {totalRatings > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {domainStats.accurate_count > 0 && (
              <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                {domainStats.accurate_count} Accurate
              </span>
            )}
            {domainStats.mostly_accurate_count > 0 && (
              <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {domainStats.mostly_accurate_count} Mostly Accurate
              </span>
            )}
            {domainStats.mixed_count > 0 && (
              <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                {domainStats.mixed_count} Mixed
              </span>
            )}
            {domainStats.questionable_count > 0 && (
              <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {domainStats.questionable_count} Questionable
              </span>
            )}
            {domainStats.unreliable_count > 0 && (
              <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                {domainStats.unreliable_count} Unreliable
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

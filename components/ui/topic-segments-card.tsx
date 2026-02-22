"use client"

import { motion } from "framer-motion"
import { Clock } from "lucide-react"
import type { TopicSegmentData } from "@/types/database.types"

interface TopicSegmentsCardProps {
  segments: TopicSegmentData[]
}

export function TopicSegmentsCard({ segments }: TopicSegmentsCardProps) {
  if (!segments || segments.length === 0) return null

  return (
    <div className="space-y-2">
      {segments.map((segment, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
          className="group relative rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors overflow-hidden"
        >
          <div className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white/90 leading-tight">
                  {segment.title}
                </h4>
                <p className="text-xs text-white/50 mt-1.5 leading-relaxed">
                  {segment.summary}
                </p>
              </div>
              <div className="flex items-center gap-1 text-[0.6875rem] text-white/40 shrink-0 tabular-nums">
                <Clock className="w-3 h-3" />
                <span>{segment.start_time}</span>
                <span className="text-white/20">–</span>
                <span>{segment.end_time}</span>
              </div>
            </div>
            {segment.speakers && segment.speakers.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {segment.speakers.map((speaker) => (
                  <span
                    key={speaker}
                    className="text-[0.625rem] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40"
                  >
                    Speaker {speaker}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Progress indicator showing relative position */}
          <div className="h-[2px] bg-white/[0.03]">
            <div
              className="h-full bg-gradient-to-r from-teal-500/40 to-teal-400/20 rounded-full"
              style={{ width: `${Math.min(100, ((index + 1) / segments.length) * 100)}%` }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  )
}

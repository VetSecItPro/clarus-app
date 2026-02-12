"use client"

import { motion } from "framer-motion"
import {
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Shield,
  ListOrdered,
  ExternalLink,
} from "lucide-react"
import { SectionCard } from "@/components/ui/section-card"

interface ComparisonSource {
  id: string
  title: string | null
  url: string
  type: string | null
}

interface ComparisonResult {
  agreements: Array<{ topic: string; detail: string }>
  disagreements: Array<{
    topic: string
    sources: Array<{ title: string; position: string }>
  }>
  unique_insights: Array<{ source_title: string; insights: string[] }>
  reliability_assessment: string
  key_takeaways: string[]
  generated_at: string
}

interface CompareResultsProps {
  comparison: ComparisonResult
  sources: ComparisonSource[]
}

export function CompareResults({ comparison, sources }: CompareResultsProps) {
  return (
    <div className="space-y-6">
      {/* Sources header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 sm:p-5"
      >
        <div className="text-xs text-white/40 uppercase tracking-wider mb-3">
          Sources Compared
        </div>
        <div className="space-y-2">
          {sources.map((source, i) => (
            <div key={source.id} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs font-semibold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-white/80 font-medium truncate block">
                  {source.title ?? "Untitled"}
                </span>
              </div>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/30 hover:text-brand transition-colors shrink-0"
                aria-label={`Open source: ${source.title ?? "Untitled"}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Agreements */}
      {comparison.agreements.length > 0 && (
        <SectionCard
          title={`Agreements (${comparison.agreements.length})`}
          delay={0.1}
          icon={<CheckCircle2 className="w-4 h-4" />}
          headerColor="emerald"
        >
          <div className="space-y-4">
            {comparison.agreements.map((agreement, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
                className="flex items-start gap-3"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm text-white/90 font-medium">
                    {agreement.topic}
                  </div>
                  <div className="text-xs text-white/60 mt-1">
                    {agreement.detail}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Disagreements */}
      {comparison.disagreements.length > 0 && (
        <SectionCard
          title={`Disagreements (${comparison.disagreements.length})`}
          delay={0.2}
          icon={<AlertTriangle className="w-4 h-4" />}
          headerColor="amber"
        >
          <div className="space-y-5">
            {comparison.disagreements.map((disagreement, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.25 + i * 0.05 }}
              >
                <div className="text-sm text-white/90 font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {disagreement.topic}
                </div>
                <div className="ml-6 space-y-2">
                  {disagreement.sources.map((source, j) => (
                    <div
                      key={j}
                      className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3"
                    >
                      <div className="text-xs text-amber-300/70 font-medium mb-1">
                        {source.title}
                      </div>
                      <div className="text-xs text-white/60">
                        {source.position}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Unique Insights */}
      {comparison.unique_insights.length > 0 && (
        <SectionCard
          title="Unique Insights"
          delay={0.3}
          icon={<Lightbulb className="w-4 h-4" />}
          headerColor="blue"
        >
          <div className="space-y-5">
            {comparison.unique_insights.map((source, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.35 + i * 0.05 }}
              >
                <div className="text-xs text-brand/80 font-semibold uppercase tracking-wider mb-2">
                  {source.source_title}
                </div>
                <div className="space-y-1.5 ml-1">
                  {source.insights.map((insight, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <Lightbulb className="w-3 h-3 text-blue-400/60 mt-1 shrink-0" />
                      <span className="text-sm text-white/70">{insight}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Reliability Assessment */}
      {comparison.reliability_assessment && (
        <SectionCard
          title="Reliability Assessment"
          delay={0.4}
          icon={<Shield className="w-4 h-4" />}
          headerColor="violet"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.45 }}
          >
            <p className="text-sm text-white/70 leading-relaxed">
              {comparison.reliability_assessment}
            </p>
          </motion.div>
        </SectionCard>
      )}

      {/* Key Takeaways */}
      {comparison.key_takeaways.length > 0 && (
        <SectionCard
          title="Key Takeaways"
          delay={0.5}
          icon={<ListOrdered className="w-4 h-4" />}
          headerColor="cyan"
        >
          <div className="space-y-3">
            {comparison.key_takeaways.map((takeaway, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.55 + i * 0.05 }}
                className="flex items-start gap-3"
              >
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[0.625rem] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-white/70">{takeaway}</span>
              </motion.div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Generated timestamp */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.6 }}
        className="text-center text-xs text-white/20 pb-4"
      >
        Generated {new Date(comparison.generated_at).toLocaleString()}
      </motion.div>
    </div>
  )
}

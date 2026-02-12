"use client"

import Link from "next/link"
import Image from "next/image"
import { Eye, Sparkles, Shield, Lightbulb, Target, BookOpen, ChevronDown, FileText, Play, ArrowRight } from "lucide-react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SectionCard } from "@/components/ui/section-card"
import { TriageCard } from "@/components/ui/triage-card"
import { TruthCheckCard } from "@/components/ui/truth-check-card"
import { ActionItemsCard } from "@/components/ui/action-items-card"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { formatDuration, getDomainFromUrl } from "@/lib/utils"
import type { TriageData, TruthCheckData, ActionItemsData } from "@/types/database.types"

interface SharePageContentProps {
  content: {
    title: string | null
    url: string
    type: string | null
    author: string | null
    duration: number | null
    thumbnailUrl: string | null
    dateAdded: string | null
  }
  summary: {
    briefOverview: string | null
    triage: TriageData | null
    truthCheck: TruthCheckData | null
    actionItems: ActionItemsData | null
    midLengthSummary: string | null
    detailedSummary: string | null
    processingStatus: string | null
  } | null
}

export function SharePageContent({ content, summary }: SharePageContentProps) {
  const [isDetailedExpanded, setIsDetailedExpanded] = useState(false)
  const displayDomain = getDomainFromUrl(content.url)
  const displayDuration = content.type === "youtube" ? formatDuration(content.duration) : null

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/clarus-logo.webp"
                alt="Clarus"
                width={32}
                height={32}
                sizes="32px"
                priority
                className="w-8 h-8"
              />
              <span className="text-white/90 font-bold text-2xl italic tracking-wide" style={{ fontFamily: 'var(--font-cormorant)' }}>
                Clarus
              </span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand/20 text-brand text-sm font-medium hover:bg-brand/30 transition-all border border-brand/30"
            >
              Analyze your own content
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Shared badge */}
      <div className="max-w-4xl mx-auto px-4 lg:px-6 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs mb-4">
          <Eye className="w-3 h-3" />
          Shared analysis (read-only)
        </div>
      </div>

      {/* Content info */}
      <div className="max-w-4xl mx-auto px-4 lg:px-6 mb-6">
        <div className="flex gap-4">
          {content.thumbnailUrl && (
            <Image
              src={content.thumbnailUrl}
              alt={content.title || "Content thumbnail"}
              width={160}
              height={90}
              sizes="160px"
              className="rounded-xl object-cover aspect-video hidden sm:block"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-2">
              {content.title || "Untitled Analysis"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              {displayDomain && (
                <span className="px-2 py-1 rounded-lg bg-white/[0.06]">{displayDomain}</span>
              )}
              {content.author && (
                <span className="px-2 py-1 rounded-lg bg-white/[0.06]">{content.author}</span>
              )}
              <span className="px-2 py-1 rounded-lg bg-white/[0.06] flex items-center gap-1">
                {content.type === "youtube" ? (
                  <>
                    <Play className="w-3 h-3" />
                    {displayDuration}
                  </>
                ) : (
                  <>
                    <FileText className="w-3 h-3" />
                    Article
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis cards */}
      <main className="max-w-4xl mx-auto px-4 lg:px-6 pb-20">
        {!summary || summary.processingStatus !== "complete" ? (
          <div className="py-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <p className="text-white/40 text-sm">This analysis is still processing. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Overview */}
            {summary.briefOverview && (
              <SectionCard title="Overview" icon={<Eye className="w-4 h-4" />} headerColor="blue">
                <p className="text-white/90 text-base leading-relaxed">{summary.briefOverview}</p>
              </SectionCard>
            )}

            {/* Quick Assessment */}
            {summary.triage && (
              <SectionCard title="Quick Assessment" icon={<Sparkles className="w-4 h-4" />} headerColor="amber">
                <TriageCard triage={summary.triage} />
              </SectionCard>
            )}

            {/* Key Takeaways */}
            {summary.midLengthSummary && (
              <SectionCard title="Key Takeaways" icon={<Lightbulb className="w-4 h-4" />} headerColor="cyan">
                <div className="prose prose-sm prose-invert max-w-none">
                  <MarkdownRenderer>{summary.midLengthSummary}</MarkdownRenderer>
                </div>
              </SectionCard>
            )}

            {/* Accuracy Analysis */}
            {summary.truthCheck && (
              <SectionCard title="Accuracy Analysis" icon={<Shield className="w-4 h-4" />} headerColor="emerald">
                <TruthCheckCard truthCheck={summary.truthCheck} />
              </SectionCard>
            )}

            {/* Action Items */}
            {summary.actionItems && (
              <SectionCard title="Action Items" icon={<Target className="w-4 h-4" />} headerColor="orange">
                <ActionItemsCard actionItems={summary.actionItems} />
              </SectionCard>
            )}

            {/* Detailed Analysis (collapsible) */}
            {summary.detailedSummary && (
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                <div
                  onClick={() => setIsDetailedExpanded(!isDetailedExpanded)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setIsDetailedExpanded(!isDetailedExpanded)}
                  className="w-full px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between text-left hover:bg-violet-500/20 transition-colors bg-violet-500/15 border-b border-violet-500/20 cursor-pointer"
                >
                  <h3 className="text-sm font-semibold text-violet-300 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Detailed Analysis
                  </h3>
                  <motion.div animate={{ rotate: isDetailedExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {isDetailedExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 sm:px-5 py-4 sm:py-5 border-t border-white/[0.06] prose prose-sm prose-invert max-w-none">
                        <MarkdownRenderer>{summary.detailedSummary}</MarkdownRenderer>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <div className="p-6 rounded-2xl bg-gradient-to-b from-brand/10 to-transparent border border-brand/20">
            <h2 className="text-lg font-semibold text-white mb-2">Want to analyze your own content?</h2>
            <p className="text-white/50 text-sm mb-4">
              Clarus gives you AI-powered analysis of any article, video, or document.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand text-white font-medium hover:bg-brand-hover transition-all"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

"use client"

import dynamic from "next/dynamic"
import { Loader2, Eye, Sparkles, Lightbulb, Shield, Target, BookOpen, ChevronDown, RefreshCw } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { SectionCard, SectionSkeleton } from "@/components/ui/section-card"
import { SectionFeedback } from "@/components/ui/section-feedback"
import type { TriageData, TruthCheckData, ActionItemsData } from "@/types/database.types"
import type { CrossReference } from "@/components/ui/truth-check-card"
import type { YouTubePlayerRef } from "@/components/ui/youtube-player"
import type { Tables } from "@/types/database.types"

const MarkdownRenderer = dynamic(() => import("@/components/markdown-renderer").then(m => ({ default: m.MarkdownRenderer })), { ssr: false })
const TriageCard = dynamic(() => import("@/components/ui/triage-card").then(m => ({ default: m.TriageCard })), { ssr: false })
const TruthCheckCard = dynamic(() => import("@/components/ui/truth-check-card").then(m => ({ default: m.TruthCheckCard })), { ssr: false })
const ActionItemsCard = dynamic(() => import("@/components/ui/action-items-card").then(m => ({ default: m.ActionItemsCard })), { ssr: false })
const AnalysisProgress = dynamic(() => import("@/components/ui/analysis-progress").then(m => ({ default: m.AnalysisProgress })), { ssr: false })

type ClaimFlagEntry = { claim_index: number; flag_reason: string | null }
type FeedbackMap = Record<string, boolean | null>

interface ItemAnalysisProps {
  summary: Tables<"summaries"> | null
  contentId: string
  contentType: string | null
  dir: string
  isPolling: boolean
  isRegenerating: boolean
  isTranslating: boolean
  isDetailedExpanded: boolean
  loading: boolean
  analysisLanguageName: string
  paywallWarning: string | null
  processingError: string | null
  isAnalysisStale: boolean
  isAnalysisVeryStale: boolean
  analysisAgeDays: number | null
  sectionFeedback: FeedbackMap
  crossReferences: CrossReference[]
  claimFlags: ClaimFlagEntry[]
  highlightedIssueIndex: number
  youtubePlayerRef: React.RefObject<YouTubePlayerRef | null>
  hasFullText: boolean
  fullTextFailed: boolean
  contentDateAdded: string | null
  onRegenerate: () => void
  onToggleDetailedExpanded: () => void
  onFlagClaim: (claimIndex: number) => void
}

export function ItemAnalysis({
  summary,
  contentId,
  contentType,
  dir,
  isPolling,
  isRegenerating,
  isTranslating,
  isDetailedExpanded,
  loading,
  analysisLanguageName,
  paywallWarning,
  processingError,
  isAnalysisStale,
  isAnalysisVeryStale,
  analysisAgeDays,
  sectionFeedback,
  crossReferences,
  claimFlags,
  highlightedIssueIndex,
  youtubePlayerRef,
  hasFullText,
  fullTextFailed,
  contentDateAdded,
  onRegenerate,
  onToggleDetailedExpanded,
  onFlagClaim,
}: ItemAnalysisProps) {
  return (
    <div className="space-y-6 sm:space-y-8" dir={dir}>
      {isTranslating && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand/10 border border-brand/20"
        >
          <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />
          <p className="text-sm text-brand/80">
            Translating to {analysisLanguageName}...
          </p>
        </motion.div>
      )}
      <AnalysisProgress
        processingStatus={summary?.processing_status ?? null}
        briefOverview={summary?.brief_overview ?? null}
        triage={summary?.triage ?? null}
        midLengthSummary={summary?.mid_length_summary ?? null}
        truthCheck={summary?.truth_check ?? null}
        actionItems={summary?.action_items ?? null}
        detailedSummary={summary?.detailed_summary ?? null}
        contentType={contentType}
        isPolling={isPolling}
        contentDateAdded={contentDateAdded}
        onRetry={onRegenerate}
      />
      {paywallWarning && !processingError && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start">
          <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-300/80 leading-relaxed">{paywallWarning}</p>
        </div>
      )}
      {isAnalysisStale && !processingError && !isPolling && (
        <div className={cn(
          "p-3 rounded-xl flex gap-3 items-center justify-between",
          isAnalysisVeryStale
            ? "bg-red-500/10 border border-red-500/20"
            : "bg-amber-500/10 border border-amber-500/20"
        )}>
          <div className="flex gap-3 items-start">
            <RefreshCw className={cn(
              "w-4 h-4 mt-0.5 shrink-0",
              isAnalysisVeryStale ? "text-red-400" : "text-amber-400"
            )} />
            <p className={cn(
              "text-sm leading-relaxed",
              isAnalysisVeryStale ? "text-red-300/80" : "text-amber-300/80"
            )}>
              {isAnalysisVeryStale
                ? `This analysis is ${analysisAgeDays} days old and likely outdated. Re-analyze for fresh results.`
                : `This analysis is ${analysisAgeDays} days old and may not reflect recent changes.`}
            </p>
          </div>
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className={cn(
              "px-3 py-1.5 rounded-full transition-all disabled:opacity-50 text-xs whitespace-nowrap",
              isAnalysisVeryStale
                ? "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
                : "bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30"
            )}
          >
            {isRegenerating ? "Re-analyzing..." : "Re-analyze"}
          </button>
        </div>
      )}
      {processingError ? (
        <div className="p-4 text-center rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
          <h3 className="text-base font-medium text-yellow-300 mb-2">Processing Failed</h3>
          <p className="text-sm text-yellow-300/70 mb-3">We couldn&apos;t retrieve the content from the source.</p>
          <p className="text-xs text-yellow-300/50 mb-4">{processingError}</p>
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="px-4 py-2 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 transition-all disabled:opacity-50 text-sm"
          >
            {isRegenerating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Regenerating...
              </span>
            ) : (
              "Try Regenerating"
            )}
          </button>
        </div>
      ) : (
        <>
          {/* 1. OVERVIEW */}
          <AnimatePresence mode="wait">
            {(summary?.brief_overview || isPolling) && (
              <SectionCard
                title="Overview"
                isLoading={isPolling && !summary?.brief_overview}
                delay={0}
                icon={<Eye className="w-4 h-4" />}
                headerColor="blue"
                minContentHeight="150px"
                headerRight={summary?.brief_overview && !isPolling ? <SectionFeedback contentId={contentId} sectionType="overview" initialValue={sectionFeedback.overview ?? null} /> : undefined}
              >
                {summary?.brief_overview ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-white/90 text-base leading-relaxed"
                  >
                    {summary.brief_overview}
                  </motion.p>
                ) : (
                  <SectionSkeleton lines={6} minHeight="150px" />
                )}
              </SectionCard>
            )}
          </AnimatePresence>

          {/* 2. QUICK ASSESSMENT */}
          <AnimatePresence mode="wait">
            {(summary?.triage || isPolling) && (
              <SectionCard
                title="Quick Assessment"
                isLoading={isPolling && !summary?.triage}
                delay={0.1}
                icon={<Sparkles className="w-4 h-4" />}
                headerColor="amber"
                minContentHeight="350px"
                headerRight={summary?.triage && !isPolling ? <SectionFeedback contentId={contentId} sectionType="triage" initialValue={sectionFeedback.triage ?? null} /> : undefined}
              >
                {summary?.triage ? (
                  <TriageCard triage={summary.triage as unknown as TriageData} />
                ) : (
                  <div className="space-y-4" style={{ minHeight: "350px" }}>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="h-4 w-24 bg-white/[0.08] rounded mb-2 animate-pulse" />
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-16 bg-white/[0.08] rounded-lg animate-pulse" />
                        <div className="flex-1 h-3 bg-white/[0.06] rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="h-4 w-32 bg-white/[0.08] rounded mb-2 animate-pulse" />
                      <div className="h-12 bg-white/[0.06] rounded-lg animate-pulse" />
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="h-4 w-28 bg-white/[0.08] rounded mb-3 animate-pulse" />
                      <div className="flex flex-wrap gap-2">
                        <div className="h-7 w-32 bg-white/[0.06] rounded-full animate-pulse" />
                        <div className="h-7 w-28 bg-white/[0.06] rounded-full animate-pulse" />
                        <div className="h-7 w-36 bg-white/[0.06] rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="h-4 w-32 bg-white/[0.08] rounded mb-2 animate-pulse" />
                      <div className="h-10 bg-white/[0.06] rounded-lg animate-pulse" />
                    </div>
                  </div>
                )}
              </SectionCard>
            )}
          </AnimatePresence>

          {/* 3. KEY TAKEAWAYS */}
          <AnimatePresence mode="wait">
            {(summary?.mid_length_summary || isPolling) && (
              <SectionCard
                title="Key Takeaways"
                isLoading={isPolling && !summary?.mid_length_summary}
                delay={0.15}
                icon={<Lightbulb className="w-4 h-4" />}
                headerColor="cyan"
                minContentHeight="500px"
                headerRight={summary?.mid_length_summary && !isPolling ? <SectionFeedback contentId={contentId} sectionType="takeaways" initialValue={sectionFeedback.takeaways ?? null} /> : undefined}
              >
                {summary?.mid_length_summary ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="prose prose-sm prose-invert max-w-none"
                  >
                    <MarkdownRenderer
                      onTimestampClick={(seconds) => {
                        youtubePlayerRef.current?.seekTo(seconds)
                      }}
                    >{summary.mid_length_summary}</MarkdownRenderer>
                  </motion.div>
                ) : (
                  <SectionSkeleton lines={20} minHeight="500px" />
                )}
              </SectionCard>
            )}
          </AnimatePresence>

          {/* 4. ACCURACY ANALYSIS */}
          <AnimatePresence mode="wait">
            {(summary?.truth_check || isPolling) && (
              <SectionCard
                title="Accuracy Analysis"
                isLoading={isPolling && !summary?.truth_check}
                delay={0.2}
                icon={<Shield className="w-4 h-4" />}
                headerColor="emerald"
                minContentHeight="650px"
                headerRight={summary?.truth_check && !isPolling ? <SectionFeedback contentId={contentId} sectionType="accuracy" initialValue={sectionFeedback.accuracy ?? null} /> : undefined}
              >
                {summary?.truth_check ? (
                  <TruthCheckCard truthCheck={summary.truth_check as unknown as TruthCheckData} crossReferences={crossReferences} contentId={contentId} claimFlags={claimFlags} onFlagClaim={onFlagClaim} highlightedIssueIndex={highlightedIssueIndex} />
                ) : (
                  <div className="space-y-4" style={{ minHeight: "650px" }}>
                    <div>
                      <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse mb-2" />
                      <div className="h-6 w-20 bg-white/[0.08] rounded animate-pulse" />
                    </div>
                    <div>
                      <div className="h-3 w-28 bg-white/[0.06] rounded animate-pulse mb-3" />
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="h-5 w-5 bg-white/[0.06] rounded animate-pulse flex-shrink-0" />
                          <div className="flex-1">
                            <div className="h-4 w-full bg-white/[0.06] rounded animate-pulse mb-2" />
                            <div className="h-3 w-4/5 bg-white/[0.04] rounded animate-pulse mb-1" />
                            <div className="h-3 w-32 bg-white/[0.04] rounded animate-pulse" />
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-5 w-5 bg-white/[0.06] rounded animate-pulse flex-shrink-0" />
                          <div className="flex-1">
                            <div className="h-4 w-11/12 bg-white/[0.06] rounded animate-pulse mb-2" />
                            <div className="h-3 w-3/4 bg-white/[0.04] rounded animate-pulse mb-1" />
                            <div className="h-3 w-28 bg-white/[0.04] rounded animate-pulse" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse mb-2" />
                      <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="h-4 w-4 bg-white/[0.04] rounded animate-pulse flex-shrink-0" />
                            <div className={`h-4 bg-white/[0.06] rounded animate-pulse`} style={{ width: `${85 - i * 5}%` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="h-3 w-28 bg-white/[0.06] rounded animate-pulse mb-2" />
                      <div className="h-4 w-full bg-white/[0.06] rounded animate-pulse mb-1" />
                      <div className="h-4 w-4/5 bg-white/[0.06] rounded animate-pulse" />
                    </div>
                  </div>
                )}
              </SectionCard>
            )}
          </AnimatePresence>

          {/* 5. ACTION ITEMS */}
          <AnimatePresence mode="wait">
            {(summary?.action_items || isPolling) && (
              <SectionCard
                title="Action Items"
                isLoading={isPolling && !summary?.action_items}
                delay={0.3}
                icon={<Target className="w-4 h-4" />}
                headerColor="orange"
                minContentHeight="350px"
                headerRight={summary?.action_items && !isPolling ? <SectionFeedback contentId={contentId} sectionType="action_items" initialValue={sectionFeedback.action_items ?? null} /> : undefined}
              >
                {summary?.action_items ? (
                  <ActionItemsCard actionItems={summary.action_items as unknown as ActionItemsData} />
                ) : (
                  <div className="space-y-3" style={{ minHeight: "350px" }}>
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-[80px] bg-white/[0.04] rounded-xl animate-pulse" />
                    ))}
                  </div>
                )}
              </SectionCard>
            )}
          </AnimatePresence>

          {/* No summary prompt */}
          {!summary?.brief_overview && !summary?.mid_length_summary && !isPolling && !isRegenerating && !loading && hasFullText && !fullTextFailed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06]"
            >
              <p className="text-white/50 text-sm mb-4">No summary generated yet.</p>
              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="px-4 py-2 rounded-full bg-brand text-white text-sm hover:bg-brand-hover transition-all disabled:opacity-50"
              >
                Generate Summary
              </button>
            </motion.div>
          )}

          {/* 6. DETAILED ANALYSIS */}
          <AnimatePresence mode="wait">
            {(summary?.detailed_summary || isPolling) && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden"
              >
                <div
                  onClick={onToggleDetailedExpanded}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isDetailedExpanded}
                  onKeyDown={(e) => e.key === 'Enter' && onToggleDetailedExpanded()}
                  className="w-full px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between text-left hover:bg-violet-500/20 transition-colors bg-violet-500/15 border-b border-violet-500/20 cursor-pointer"
                >
                  <h3 className="text-sm font-semibold text-violet-300 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Detailed Analysis
                    {isPolling && !summary?.detailed_summary && (
                      <Loader2 className="w-4 h-4 text-brand animate-spin" />
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    {summary?.detailed_summary && !isPolling && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <SectionFeedback contentId={contentId} sectionType="detailed" initialValue={sectionFeedback.detailed ?? null} />
                      </div>
                    )}
                    {summary?.detailed_summary && (
                      <motion.div
                        animate={{ rotate: isDetailedExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-5 h-5 text-white/50" />
                      </motion.div>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {summary?.detailed_summary && isDetailedExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 sm:px-5 py-4 sm:py-5 border-t border-white/[0.06] prose prose-sm prose-invert max-w-none">
                        <MarkdownRenderer
                          onTimestampClick={(seconds) => {
                            youtubePlayerRef.current?.seekTo(seconds)
                          }}
                        >{summary.detailed_summary}</MarkdownRenderer>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!summary?.detailed_summary && isPolling && (
                  <div className="px-4 sm:px-5 py-4 sm:py-5 border-t border-white/[0.06]" style={{ minHeight: "280px" }}>
                    <SectionSkeleton lines={8} minHeight="220px" />
                    <p className="text-white/50 text-xs mt-4 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating detailed analysis...
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import {
  Eye,
  Sparkles,
  Shield,
  Target,
  FileText,
  Play,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Circle,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import {
  DEMO_CONTENT,
  DEMO_OVERVIEW,
  DEMO_TRIAGE,
  DEMO_TRUTH_CHECK,
  DEMO_ACTION_ITEMS,
  DEMO_DETAILED_ANALYSIS,
  DEMO_TABS,
  type DemoTab,
} from "./demo-analysis-data"

// =============================================
// Tab icon mapping
// =============================================

const TAB_ICONS: Record<string, React.ReactNode> = {
  overview: <Eye className="w-4 h-4" />,
  assessment: <Sparkles className="w-4 h-4" />,
  "truth-check": <Shield className="w-4 h-4" />,
  "action-items": <Target className="w-4 h-4" />,
  "deep-dive": <FileText className="w-4 h-4" />,
}

// =============================================
// Color mapping for tab header accents
// =============================================

const TAB_COLORS: Record<DemoTab["color"], { activeBg: string; activeBorder: string; activeText: string; dot: string }> = {
  blue: { activeBg: "bg-blue-500/15", activeBorder: "border-blue-500/30", activeText: "text-blue-300", dot: "bg-blue-400" },
  amber: { activeBg: "bg-amber-500/15", activeBorder: "border-amber-500/30", activeText: "text-amber-300", dot: "bg-amber-400" },
  emerald: { activeBg: "bg-emerald-500/15", activeBorder: "border-emerald-500/30", activeText: "text-emerald-300", dot: "bg-emerald-400" },
  cyan: { activeBg: "bg-cyan-500/15", activeBorder: "border-cyan-500/30", activeText: "text-cyan-300", dot: "bg-cyan-400" },
  orange: { activeBg: "bg-orange-500/15", activeBorder: "border-orange-500/30", activeText: "text-orange-300", dot: "bg-orange-400" },
  violet: { activeBg: "bg-violet-500/15", activeBorder: "border-violet-500/30", activeText: "text-violet-300", dot: "bg-violet-400" },
}

// =============================================
// Main DemoAnalysis component
// =============================================

export function DemoAnalysis() {
  const [activeTab, setActiveTab] = useState("overview")
  const contentRef = useRef<HTMLDivElement>(null)

  const currentTab = DEMO_TABS.find((t) => t.id === activeTab) ?? DEMO_TABS[0]
  const colors = TAB_COLORS[currentTab.color]

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    // Scroll the content area to top on tab change
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }

  return (
    <section className="py-16 sm:py-24 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <p className="text-[#1d9bf0] text-sm font-medium tracking-wide uppercase mb-3">
            See it in action
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            A real analysis, <span className="text-white/40">not a mockup</span>
          </h2>
          <p className="text-white/40 text-base max-w-lg mx-auto">
            Here is what Clarus produces for a popular TED talk on addiction. Click through the sections to explore.
          </p>
        </motion.div>

        {/* Browser chrome frame */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden shadow-2xl shadow-black/50"
        >
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
              <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
              <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.04] rounded-full border border-white/[0.06]">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="text-[10px] text-white/40 font-mono">clarusapp.io/item/...</span>
            </div>
            <div className="w-[52px]" />
          </div>

          {/* Content area */}
          <div className="flex flex-col lg:flex-row min-h-[520px] sm:min-h-[560px]">
            {/* Left sidebar — content info + tab navigation */}
            <div className="lg:w-[260px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.06] p-3 sm:p-4">
              {/* Content card */}
              <div className="mb-4">
                {/* Video thumbnail placeholder */}
                <div className="rounded-xl bg-white/[0.04] aspect-video flex items-center justify-center border border-white/[0.06] relative overflow-hidden mb-3">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 to-orange-900/15" />
                  <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center border border-white/20 z-10">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                </div>

                <h3 className="text-xs sm:text-sm font-medium text-white leading-snug mb-1.5 line-clamp-2">
                  {DEMO_CONTENT.title}
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] text-white/30 px-1.5 py-0.5 bg-white/[0.04] rounded">{DEMO_CONTENT.domain}</span>
                  <span className="text-[9px] text-white/30 px-1.5 py-0.5 bg-white/[0.04] rounded flex items-center gap-0.5">
                    <Play className="w-2 h-2" /> {DEMO_CONTENT.duration}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/25 rounded text-amber-300">
                    {DEMO_CONTENT.detectedTone}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/15 border border-blue-500/25 rounded text-blue-300">
                    {DEMO_CONTENT.author}
                  </span>
                </div>
              </div>

              {/* Tab navigation — vertical on desktop, horizontal scroll on mobile */}
              <nav className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-1 px-1">
                {DEMO_TABS.map((tab) => {
                  const isActive = activeTab === tab.id
                  const tabColors = TAB_COLORS[tab.color]
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200 whitespace-nowrap shrink-0 ${
                        isActive
                          ? `${tabColors.activeBg} ${tabColors.activeBorder} border ${tabColors.activeText}`
                          : "text-white/40 hover:text-white/60 hover:bg-white/[0.04] border border-transparent"
                      }`}
                    >
                      <span className={isActive ? tabColors.activeText : ""}>{TAB_ICONS[tab.id]}</span>
                      <span className="text-xs font-medium hidden sm:inline">{tab.label}</span>
                      <span className="text-xs font-medium sm:hidden">{tab.shortLabel}</span>
                      {isActive && (
                        <ChevronRight className="w-3 h-3 ml-auto hidden lg:block" />
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Right side — analysis content */}
            <div
              ref={contentRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6"
              style={{ maxHeight: "560px" }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {/* Section header */}
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.activeBg} ${colors.activeBorder} border mb-5`}>
                    {TAB_ICONS[activeTab]}
                    <span className={`text-xs font-semibold uppercase tracking-wider ${colors.activeText}`}>
                      {currentTab.label}
                    </span>
                  </div>

                  {/* Tab content */}
                  {activeTab === "overview" && <OverviewContent />}
                  {activeTab === "assessment" && <AssessmentContent />}
                  {activeTab === "truth-check" && <TruthCheckContent />}
                  {activeTab === "action-items" && <ActionItemsContent />}
                  {activeTab === "deep-dive" && <DeepDiveContent />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* CTA below demo */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mt-8"
        >
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-full transition-colors duration-200 shadow-lg shadow-[#1d9bf0]/25"
          >
            Analyze your own content — free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="mt-3 text-xs text-white/30">
            5 free analyses. No credit card required.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// =============================================
// Tab content components
// =============================================

function OverviewContent() {
  const paragraphs = DEMO_OVERVIEW.split("\n\n")
  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.1 }}
          className="text-sm text-white/70 leading-relaxed"
        >
          {p}
        </motion.p>
      ))}
    </div>
  )
}

function AssessmentContent() {
  const recommendation = DEMO_TRIAGE.signal_noise_score === 3
    ? { label: "Must See", color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" }
    : DEMO_TRIAGE.signal_noise_score === 2
      ? { label: "Worth It", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" }
      : { label: "Skim", color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" }

  return (
    <div className="space-y-5">
      {/* Scores */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="text-xs text-white/40 uppercase tracking-wider">Quality</div>
            <div className="text-2xl font-bold text-white">
              {DEMO_TRIAGE.quality_score}
              <span className="text-base text-white/40">/10</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-white/40 uppercase tracking-wider">Recommendation</div>
            <div className={`px-3 py-1.5 rounded-full ${recommendation.bg} ${recommendation.border} border`}>
              <span className={`text-sm font-semibold ${recommendation.color}`}>
                {recommendation.label}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 bg-white/[0.1] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${DEMO_TRIAGE.quality_score * 10}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="h-full rounded-full bg-[#1d9bf0]"
          />
        </div>
      </motion.div>

      {/* Worth Your Time */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Worth Your Time?</div>
        <div className="text-sm text-white/80">{DEMO_TRIAGE.worth_your_time}</div>
      </motion.div>

      {/* Target Audience */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Target Audience</div>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_TRIAGE.target_audience.map((audience) => (
            <span
              key={audience}
              className="text-xs px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-white/50"
            >
              {audience}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Content Density */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Content Density</div>
        <div className="text-sm text-white/70">{DEMO_TRIAGE.content_density}</div>
      </motion.div>
    </div>
  )
}

function TruthCheckContent() {
  const ratingColor =
    DEMO_TRUTH_CHECK.overall_rating === "Accurate"
      ? "text-green-400 bg-green-500/15 border-green-500/25"
      : DEMO_TRUTH_CHECK.overall_rating === "Mostly Accurate"
        ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/25"
        : "text-yellow-400 bg-yellow-500/15 border-yellow-500/25"

  return (
    <div className="space-y-5">
      {/* Overall Rating */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <span className={`text-sm font-semibold px-3 py-1.5 rounded-full border ${ratingColor}`}>
          {DEMO_TRUTH_CHECK.overall_rating}
        </span>
      </motion.div>

      {/* Claims */}
      {DEMO_TRUTH_CHECK.claims && DEMO_TRUTH_CHECK.claims.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="text-xs text-white/40 uppercase tracking-wider mb-3">
            Key Claims Assessed ({DEMO_TRUTH_CHECK.claims.length})
          </div>
          <div className="space-y-3">
            {DEMO_TRUTH_CHECK.claims.map((claim, i) => {
              const statusConfig = {
                verified: { icon: <CheckCircle className="w-4 h-4 text-green-400" />, label: "Verified", color: "text-green-400 bg-green-500/15 border-green-500/25" },
                false: { icon: <AlertTriangle className="w-4 h-4 text-red-400" />, label: "False", color: "text-red-400 bg-red-500/15 border-red-500/25" },
                disputed: { icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />, label: "Disputed", color: "text-yellow-400 bg-yellow-500/15 border-yellow-500/25" },
                unverified: { icon: <Circle className="w-4 h-4 text-white/40" />, label: "Unverified", color: "text-white/40 bg-white/[0.06] border-white/[0.08]" },
                opinion: { icon: <Circle className="w-4 h-4 text-blue-400" />, label: "Opinion", color: "text-blue-400 bg-blue-500/15 border-blue-500/25" },
              }
              const config = statusConfig[claim.status]
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.15 + i * 0.06 }}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/90 mb-1 italic leading-snug">
                        &ldquo;{claim.exact_text}&rdquo;
                      </div>
                      <div className="text-xs text-white/55 leading-relaxed mb-2">
                        {claim.explanation}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${config.color}`}>
                          {config.label}
                        </span>
                        {claim.timestamp && (
                          <span className="text-[10px] text-white/30">
                            {claim.timestamp}
                          </span>
                        )}
                        {claim.sources && claim.sources.length > 0 && (
                          <span className="text-[10px] text-[#1d9bf0]/60 flex items-center gap-0.5">
                            <ExternalLink className="w-2.5 h-2.5" />
                            {claim.sources.length} {claim.sources.length === 1 ? "source" : "sources"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Strengths */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Strengths</div>
        <div className="space-y-1.5">
          {DEMO_TRUTH_CHECK.strengths.map((strength, i) => (
            <div key={i} className="text-sm text-white/60 flex items-start gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <span>{strength}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Sources Quality */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      >
        <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Sources Quality</div>
        <div className="text-sm text-white/60 leading-relaxed">{DEMO_TRUTH_CHECK.sources_quality}</div>
      </motion.div>
    </div>
  )
}

function ActionItemsContent() {
  const priorityColors: Record<string, string> = {
    high: "bg-red-400",
    medium: "bg-yellow-400",
    low: "bg-blue-400",
  }

  return (
    <div className="space-y-4">
      {DEMO_ACTION_ITEMS.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.06 }}
          className="group"
        >
          <div className="flex items-center gap-2 mb-1">
            <Circle className="w-4 h-4 text-white/30 shrink-0" />
            <span className="text-sm text-white/90 font-medium">{item.title}</span>
          </div>
          <div className="text-xs text-white/50 ml-6 leading-relaxed">
            {item.description}
          </div>
          <div className="text-xs text-white/30 ml-6 mt-1 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${priorityColors[item.priority] ?? "bg-white/30"}`} />
            <span className="capitalize">{item.priority} priority</span>
            {item.category && (
              <>
                <span className="text-white/15">&middot;</span>
                <span>{item.category}</span>
              </>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function DeepDiveContent() {
  // Simple markdown-like rendering for the detailed analysis
  const lines = DEMO_DETAILED_ANALYSIS.split("\n")

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return null

        if (trimmed.startsWith("## ")) {
          return (
            <motion.h3
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * Math.min(i, 10) }}
              className="text-base font-semibold text-white mt-4 first:mt-0"
            >
              {trimmed.replace("## ", "")}
            </motion.h3>
          )
        }

        if (trimmed.startsWith("1. ") || trimmed.startsWith("2. ") || trimmed.startsWith("3. ")) {
          const content = trimmed.replace(/^\d+\.\s/, "")
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 * Math.min(i, 10) }}
              className="flex items-start gap-2 ml-2"
            >
              <span className="text-[#1d9bf0] text-sm font-mono mt-0.5 shrink-0">
                {trimmed.charAt(0)}.
              </span>
              <span
                className="text-sm text-white/65 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: content
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white/90 font-medium">$1</strong>')
                    .replace(/—/g, " &mdash; "),
                }}
              />
            </motion.div>
          )
        }

        return (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 * Math.min(i, 10) }}
            className="text-sm text-white/65 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: trimmed
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white/90 font-medium">$1</strong>')
                .replace(/—/g, " &mdash; "),
            }}
          />
        )
      })}
    </div>
  )
}

"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  Eye,
  Sparkles,
  Shield,
  Target,
  Lightbulb,
  Play,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Send,
} from "lucide-react"
import {
  DEMO_CONTENT,
  DEMO_OVERVIEW,
  DEMO_TRIAGE,
  DEMO_TRUTH_CHECK,
  DEMO_ACTION_ITEMS,
} from "./demo-analysis-data"

// =============================================
// Color mapping for section card headers
// =============================================

const HEADER_COLORS = {
  blue: { bg: "bg-blue-500/15", border: "border-blue-500/20", text: "text-blue-300", icon: "text-blue-400" },
  amber: { bg: "bg-amber-500/15", border: "border-amber-500/20", text: "text-amber-300", icon: "text-amber-400" },
  cyan: { bg: "bg-cyan-500/15", border: "border-cyan-500/20", text: "text-cyan-300", icon: "text-cyan-400" },
  emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500/20", text: "text-emerald-300", icon: "text-emerald-400" },
  orange: { bg: "bg-orange-500/15", border: "border-orange-500/20", text: "text-orange-300", icon: "text-orange-400" },
}

// =============================================
// Recommendation label from signal_noise_score
// =============================================

const RECOMMENDATION_LABELS = [
  { label: "Skip", color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
  { label: "Skim", color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" },
  { label: "Worth It", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" },
  { label: "Must See", color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
]

// =============================================
// Main DemoAnalysis component
// =============================================

export const DemoAnalysis = memo(function DemoAnalysis() {
  const recommendation = RECOMMENDATION_LABELS[DEMO_TRIAGE.signal_noise_score] || RECOMMENDATION_LABELS[0]

  return (
    <section className="relative py-16 sm:py-24 px-4 overflow-hidden">
      {/* Subtle ambient glow behind the demo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-brand/[0.03] rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto">
        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <p className="text-brand text-sm font-medium tracking-wide uppercase mb-3">
            See it in action
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            What Clarus produces
          </h2>
          <p className="text-white/60 text-base max-w-lg mx-auto">
            A real TED talk analysis. Every section generated automatically.
          </p>
        </motion.div>

        {/* Browser chrome frame with glow */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative"
        >
          {/* Glow effect behind the frame */}
          <div className="absolute -inset-1 bg-gradient-to-b from-brand/10 via-transparent to-transparent rounded-3xl blur-xl" />

          <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden shadow-2xl shadow-black/60">
            {/* Title bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.04] rounded-full border border-white/[0.06]">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="text-[0.625rem] text-white/40 font-mono">clarusapp.io/item/...</span>
              </div>
              <div className="w-[52px]" />
            </div>

            {/* Content area — desktop: sidebar + sections + chat | mobile: stacked */}
            <div className="flex min-h-[520px] sm:min-h-[580px]">
              {/* Left sidebar — content metadata */}
              <div className="w-[200px] sm:w-[240px] shrink-0 border-r border-white/[0.06] p-3 space-y-3 overflow-hidden hidden sm:block">
                {/* Video thumbnail */}
                <div className="rounded-xl bg-white/[0.04] aspect-video flex items-center justify-center border border-white/[0.06] relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 to-orange-900/15" />
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[0.5rem] text-white/80">
                    {DEMO_CONTENT.duration}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center border border-white/20 z-10">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                </div>

                {/* Title + metadata */}
                <div>
                  <h3 className="text-[0.6875rem] font-medium text-white leading-tight line-clamp-2">
                    {DEMO_CONTENT.title}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[0.5625rem] text-white/40 px-1.5 py-0.5 bg-white/[0.04] rounded">{DEMO_CONTENT.domain}</span>
                    <span className="text-[0.5625rem] text-white/30 px-1.5 py-0.5 bg-white/[0.04] rounded flex items-center gap-0.5">
                      <Play className="w-2 h-2" /> {DEMO_CONTENT.duration}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[0.5625rem] px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/25 rounded text-amber-300">
                      {DEMO_CONTENT.detectedTone}
                    </span>
                    <span className="text-[0.5625rem] px-1.5 py-0.5 bg-blue-500/15 border border-blue-500/25 rounded text-blue-300">
                      {DEMO_CONTENT.author}
                    </span>
                  </div>
                </div>

                {/* Verdict + Quality Score */}
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[0.5625rem] px-2.5 py-1 rounded-full border font-bold ${recommendation.bg} ${recommendation.border} ${recommendation.color}`}>
                      {recommendation.label}
                    </span>
                    <span className="text-lg font-bold text-white">
                      {DEMO_TRIAGE.quality_score}<span className="text-xs text-white/30">/10</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand to-emerald-400 rounded-full"
                      style={{ width: `${DEMO_TRIAGE.quality_score * 10}%` }}
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {["addiction", "psychology", "policy"].map((t) => (
                    <span key={t} className="text-[0.5625rem] px-1.5 py-0.5 bg-purple-500/15 border border-purple-500/25 rounded text-purple-300 capitalize">
                      {t}
                    </span>
                  ))}
                </div>

                {/* Detected tone */}
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-[0.5625rem] text-white/40 mb-1">Detected Tone</p>
                  <span className="text-[0.5625rem] font-medium text-white/70">Persuasive, Emotional</span>
                </div>

                {/* Source history */}
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-[0.5625rem] text-white/40 mb-1">Source History</p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1 bg-white/[0.08] rounded-full overflow-hidden">
                      <div className="h-full w-[65%] bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full" />
                    </div>
                    <span className="text-[0.5625rem] font-medium text-white/60">6.5</span>
                  </div>
                </div>
              </div>

              {/* Center panel — ALL section cards stacked (like real product) */}
              <div className="flex-1 p-3 sm:p-4 space-y-3 overflow-y-auto" style={{ maxHeight: "580px" }}>
                {/* Mobile-only compact content card */}
                <div className="sm:hidden flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="w-14 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-900/30 to-orange-900/20" />
                    <Play className="w-3 h-3 text-white z-10" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{DEMO_CONTENT.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[0.625rem] text-white/40">{DEMO_CONTENT.domain}</span>
                      <span className="text-[0.5625rem] px-1.5 py-0.5 rounded-full border font-medium bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
                        {recommendation.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 1. Overview */}
                <DemoSectionCard icon={<Eye className="w-3.5 h-3.5" />} title="Overview" color="blue" delay={0}>
                  <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                    {DEMO_OVERVIEW.split("\n\n")[0].slice(0, 280)}...
                  </p>
                </DemoSectionCard>

                {/* 2. Quick Assessment */}
                <DemoSectionCard icon={<Sparkles className="w-3.5 h-3.5" />} title="Quick Assessment" color="amber" delay={0.06}>
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[0.5625rem] text-white/40 uppercase tracking-wider">Quality</span>
                          <span className="text-base font-bold text-white">
                            {DEMO_TRIAGE.quality_score}<span className="text-[0.5625rem] text-white/30">/10</span>
                          </span>
                        </div>
                        <span className={`text-[0.5625rem] px-2 py-0.5 rounded-full border font-semibold ${recommendation.bg} ${recommendation.border} ${recommendation.color}`}>
                          {recommendation.label}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${DEMO_TRIAGE.quality_score * 10}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                          className="h-full bg-brand rounded-full"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[0.5625rem] text-white/40 uppercase tracking-wider">Worth Your Time?</span>
                      <p className="text-xs text-white/65 mt-0.5 leading-relaxed line-clamp-2">{DEMO_TRIAGE.worth_your_time}</p>
                    </div>
                    <div>
                      <span className="text-[0.5625rem] text-white/40 uppercase tracking-wider">Audience</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {DEMO_TRIAGE.target_audience.slice(0, 4).map((a) => (
                          <span key={a} className="text-[0.5625rem] px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-white/50">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </DemoSectionCard>

                {/* 3. Key Takeaways */}
                <DemoSectionCard icon={<Lightbulb className="w-3.5 h-3.5" />} title="Key Takeaways" color="cyan" delay={0.12}>
                  <ul className="space-y-1.5">
                    {[
                      "Addiction is driven more by disconnection and environment than by chemical hooks alone",
                      "The Rat Park experiment showed rats with social bonds largely avoided morphine",
                      "95% of Vietnam veterans who used heroin stopped when they returned home",
                      "Portugal's decriminalization led to significant drops in drug-related harm",
                    ].map((text, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: 0.3 + i * 0.06 }}
                        className="flex items-start gap-1.5"
                      >
                        <div className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                        <span className="text-xs text-white/60 leading-relaxed">{text}</span>
                      </motion.li>
                    ))}
                  </ul>
                </DemoSectionCard>

                {/* 4. Accuracy Analysis */}
                <DemoSectionCard icon={<Shield className="w-3.5 h-3.5" />} title="Accuracy Analysis" color="emerald" delay={0.18}>
                  <div className="space-y-2.5">
                    <span className="text-[0.625rem] px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-emerald-400 inline-block font-medium">
                      {DEMO_TRUTH_CHECK.overall_rating}
                    </span>

                    {/* Show first 3 claims */}
                    <div className="space-y-2">
                      {(DEMO_TRUTH_CHECK.claims ?? []).slice(0, 3).map((claim, i) => {
                        const statusIcons: Record<string, React.ReactNode> = {
                          verified: <CheckCircle className="w-3 h-3 text-green-400" />,
                          disputed: <AlertTriangle className="w-3 h-3 text-yellow-400" />,
                          opinion: <div className="w-3 h-3 rounded-full border border-blue-400/50 bg-blue-500/20" />,
                        }
                        const statusColors: Record<string, string> = {
                          verified: "text-green-400 bg-green-500/15 border-green-500/25",
                          disputed: "text-yellow-400 bg-yellow-500/15 border-yellow-500/25",
                          opinion: "text-blue-400 bg-blue-500/15 border-blue-500/25",
                        }
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -5 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.25, delay: 0.3 + i * 0.06 }}
                            className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                          >
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 shrink-0">{statusIcons[claim.status] ?? statusIcons.opinion}</span>
                              <div className="min-w-0">
                                <p className="text-[0.625rem] text-white/80 italic leading-snug line-clamp-1">
                                  &ldquo;{claim.exact_text}&rdquo;
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className={`text-[0.5rem] font-medium px-1.5 py-0.5 rounded-full border ${statusColors[claim.status] ?? statusColors.opinion}`}>
                                    {claim.status === "verified" ? "Verified" : claim.status === "disputed" ? "Disputed" : "Opinion"}
                                  </span>
                                  {claim.timestamp && (
                                    <span className="text-[0.5rem] text-white/25">{claim.timestamp}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>

                    {/* Strengths preview */}
                    <div>
                      <span className="text-[0.5625rem] text-white/40 uppercase tracking-wider">Strengths</span>
                      <div className="mt-1 space-y-1">
                        {DEMO_TRUTH_CHECK.strengths.slice(0, 2).map((s, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                            <span className="text-[0.625rem] text-white/55 leading-relaxed line-clamp-1">{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </DemoSectionCard>

                {/* 5. Action Items */}
                <DemoSectionCard icon={<Target className="w-3.5 h-3.5" />} title="Action Items" color="orange" delay={0.24}>
                  <div className="space-y-2">
                    {DEMO_ACTION_ITEMS.slice(0, 4).map((item, i) => {
                      const priorityColors: Record<string, string> = {
                        high: "bg-red-400",
                        medium: "bg-yellow-400",
                        low: "bg-blue-400",
                      }
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.25, delay: 0.3 + i * 0.06 }}
                          className="flex items-start gap-2"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${priorityColors[item.priority] ?? "bg-white/30"}`} />
                          <div className="min-w-0">
                            <p className="text-xs text-white/80 font-medium leading-snug">{item.title}</p>
                            <p className="text-[0.625rem] text-white/40 mt-0.5 line-clamp-1">{item.description}</p>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </DemoSectionCard>
              </div>

              {/* Right panel — inline chat (desktop only, like real product) */}
              <div className="w-[220px] shrink-0 border-l border-white/[0.06] hidden lg:flex flex-col">
                {/* Chat header */}
                <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-brand" />
                  <span className="text-xs font-medium text-white/70">Ask about this content</span>
                </div>

                {/* Chat messages */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="max-w-[90%] px-3 py-2 rounded-2xl rounded-tr-sm bg-brand/20 border border-brand/20">
                      <p className="text-[0.625rem] text-white/80">Is the Rat Park study reliable?</p>
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex justify-start">
                    <div className="max-w-[95%] px-3 py-2 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06]">
                      <p className="text-[0.625rem] text-white/60 leading-relaxed">
                        The Rat Park experiment <span className="text-brand text-[0.5625rem]">[1]</span> is legitimate but has limitations. It was published in <span className="text-white/80">Psychopharmacology (1981)</span> but some replication attempts had mixed results.
                      </p>
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                        <ThumbsUp className="w-2.5 h-2.5 text-white/20" />
                        <ThumbsDown className="w-2.5 h-2.5 text-white/20" />
                      </div>
                    </div>
                  </div>

                  {/* User follow-up */}
                  <div className="flex justify-end">
                    <div className="max-w-[90%] px-3 py-2 rounded-2xl rounded-tr-sm bg-brand/20 border border-brand/20">
                      <p className="text-[0.625rem] text-white/80">What about the Portugal stats?</p>
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex justify-start">
                    <div className="max-w-[95%] px-3 py-2 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06]">
                      <p className="text-[0.625rem] text-white/60 leading-relaxed">
                        The 50% reduction claim <span className="text-brand text-[0.5625rem]">[2]</span> is <span className="text-yellow-400">disputed</span>. Portugal did see significant improvements, but the exact figure varies by source and methodology.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chat input */}
                <div className="px-3 py-2.5 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                    <span className="flex-1 text-[0.625rem] text-white/20">Ask a follow-up...</span>
                    <Send className="w-3 h-3 text-white/20" />
                  </div>
                </div>
              </div>
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
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-brand hover:bg-brand-hover text-white font-semibold rounded-full transition-all duration-200 shadow-[0_0_20px_rgba(29,155,240,0.3)] hover:shadow-[0_0_30px_rgba(29,155,240,0.4)] hover:-translate-y-0.5"
          >
            Analyze your own content, free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="mt-3 text-xs text-white/50">
            5 free analyses. No credit card required.
          </p>
        </motion.div>
      </div>
    </section>
  )
})

// =============================================
// DemoSectionCard — matches real SectionCard styling
// =============================================

function DemoSectionCard({
  icon,
  title,
  color,
  delay,
  children,
}: {
  icon: React.ReactNode
  title: string
  color: keyof typeof HEADER_COLORS
  delay: number
  children: React.ReactNode
}) {
  const colors = HEADER_COLORS[color]
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.45, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden"
    >
      <div className={`px-3 sm:px-4 py-2.5 sm:py-3 border-b flex items-center justify-between ${colors.bg} ${colors.border}`}>
        <h3 className={`text-[0.625rem] sm:text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${colors.text}`}>
          <span className={colors.icon}>{icon}</span>
          {title}
        </h3>
        {/* Section feedback (mock) */}
        <div className="flex items-center gap-1.5">
          <ThumbsUp className="w-2.5 h-2.5 text-white/15" />
          <ThumbsDown className="w-2.5 h-2.5 text-white/15" />
        </div>
      </div>
      <div className="px-3 sm:px-4 py-2.5 sm:py-3">
        {children}
      </div>
    </motion.div>
  )
}

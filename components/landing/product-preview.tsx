"use client"

import { useState, memo, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
  Play,
  Eye,
  Sparkles,
  Shield,
  Lightbulb,
  Target,
  Search,
  Bookmark,
  ArrowRight,
  FileText,
  Headphones,
  FileUp,
  CheckCircle,
  AlertTriangle,
  Twitter,
  Youtube,
  MessageSquare,
  Send,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react"

type PreviewTab = "dashboard" | "analysis" | "library"

export const ProductPreview = memo(function ProductPreview() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("dashboard")

  const handleTabChange = useCallback((tab: PreviewTab) => {
    setActiveTab(tab)
  }, [])

  return (
    <section className="py-16 sm:py-24 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <p className="text-brand text-sm font-medium tracking-wide uppercase mb-3">
            The full experience
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Paste a link. Get the full picture.
          </h2>
        </motion.div>

        {/* Browser chrome frame with subtle glow */}
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

              {/* Three-tab switcher */}
              <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-full border border-white/[0.06]">
                {(["dashboard", "analysis", "library"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-all duration-200 capitalize ${
                      activeTab === tab
                        ? "bg-brand text-white shadow-md shadow-brand/25"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* URL bar */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/[0.04] rounded-lg border border-white/[0.04] text-[0.625rem] text-white/25">
                clarusapp.io
              </div>
            </div>

            {/* Content area */}
            <div className="relative min-h-[500px] sm:min-h-[560px] overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === "dashboard" && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="absolute inset-0"
                  >
                    <DashboardPreview />
                  </motion.div>
                )}
                {activeTab === "analysis" && (
                  <motion.div
                    key="analysis"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="absolute inset-0"
                  >
                    <AnalysisPreview />
                  </motion.div>
                )}
                {activeTab === "library" && (
                  <motion.div
                    key="library"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="absolute inset-0"
                  >
                    <LibraryPreview />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* CTA below preview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mt-8"
        >
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand hover:bg-brand-hover text-white font-medium rounded-full transition-all duration-200 shadow-[0_0_20px_rgba(29,155,240,0.3)] hover:shadow-[0_0_30px_rgba(29,155,240,0.4)] hover:-translate-y-0.5"
          >
            Try it yourself
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
})

// =============================================
// Dashboard Preview — matches real authenticated home
// =============================================

function DashboardPreview() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      {/* Logo + Branding */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-2.5 mb-8"
      >
        <Image
          src="/clarus-logo.webp"
          alt="Clarus"
          width={32}
          height={32}
          sizes="32px"
          className="w-8 h-8"
        />
        <span className="text-white font-bold text-xl italic tracking-wide" style={{ fontFamily: 'var(--font-cormorant)' }}>
          Clarus
        </span>
      </motion.div>

      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-center mb-6"
      >
        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-2">
          Good morning, <span className="text-brand">Alex</span>
        </h2>
        <p className="text-white/50 text-sm">What do you want to explore today?</p>
      </motion.div>

      {/* Chat input bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="w-full max-w-lg"
      >
        <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl">
          <div className="flex-1 text-sm text-white/25">Paste any URL or upload a PDF...</div>
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shrink-0">
            <Send className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </motion.div>

      {/* Analysis mode selector */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="flex items-center gap-2 mt-4"
      >
        {["Learn", "Apply", "Debate"].map((mode, i) => (
          <span
            key={mode}
            className={`px-3 py-1 text-[0.625rem] rounded-full border transition-colors ${
              i === 1
                ? "bg-brand/15 border-brand/30 text-brand"
                : "bg-white/[0.03] border-white/[0.06] text-white/30"
            }`}
          >
            {mode}
          </span>
        ))}
      </motion.div>

      {/* Content type hints */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="flex items-center justify-center gap-5 mt-5"
      >
        {[
          { icon: Youtube, label: "YouTube" },
          { icon: FileText, label: "Articles" },
          { icon: Headphones, label: "Podcasts" },
          { icon: FileUp, label: "PDF" },
          { icon: Twitter, label: "X Posts" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-white/20">
            <Icon className="w-3 h-3" />
            <span className="text-[0.625rem]">{label}</span>
          </div>
        ))}
      </motion.div>

    </div>
  )
}

// =============================================
// Analysis Preview — split layout with chat panel
// =============================================

function AnalysisPreview() {
  return (
    <div className="flex h-full">
      {/* Left panel — content metadata */}
      <div className="w-[200px] sm:w-[240px] md:w-[280px] shrink-0 border-r border-white/[0.06] p-3 space-y-3 overflow-hidden hidden sm:block">
        {/* Video thumbnail */}
        <div className="rounded-xl bg-white/[0.04] aspect-video flex items-center justify-center border border-white/[0.06] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-blue-900/20 to-purple-900/20" />
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[0.5rem] text-white/80">28:14</div>
          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center border border-white/20 z-10">
            <Play className="w-4 h-4 text-white ml-0.5" />
          </div>
        </div>

        {/* Title */}
        <div>
          <p className="text-[0.6875rem] font-medium text-white leading-tight line-clamp-2">
            How AI Is Reshaping Investigative Journalism
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[0.5625rem] text-white/40 px-1.5 py-0.5 bg-white/[0.04] rounded">youtube.com</span>
          </div>
        </div>

        {/* Verdict + Quality */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.5625rem] px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-emerald-400 font-bold">
              Worth It
            </span>
            <span className="text-lg font-bold text-white">8.2<span className="text-xs text-white/30">/10</span></span>
          </div>
          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div className="h-full w-[82%] bg-gradient-to-r from-brand to-emerald-400 rounded-full" />
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {["ai", "journalism", "media"].map((t) => (
            <span key={t} className="text-[0.5625rem] px-1.5 py-0.5 bg-purple-500/15 border border-purple-500/25 rounded text-purple-300 capitalize">
              {t}
            </span>
          ))}
        </div>

        {/* Source history */}
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <p className="text-[0.5625rem] text-white/40 mb-1">Source History</p>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 bg-white/[0.08] rounded-full overflow-hidden">
              <div className="h-full w-[72%] bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full" />
            </div>
            <span className="text-[0.5625rem] font-medium text-white/60">7.2</span>
          </div>
        </div>

        {/* Detected tone */}
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <p className="text-[0.5625rem] text-white/40 mb-1">Detected Tone</p>
          <span className="text-[0.5625rem] font-medium text-white/70">Analytical, Balanced</span>
        </div>
      </div>

      {/* Center panel — analysis section cards */}
      <div className="flex-1 p-3 sm:p-4 space-y-3 overflow-y-auto">
        {/* Mobile-only compact content card */}
        <div className="sm:hidden flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="w-14 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 to-purple-900/20" />
            <Play className="w-3 h-3 text-white z-10" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">How AI Is Reshaping Investigative Journalism</p>
            <p className="text-[0.625rem] text-white/40">youtube.com &middot; 28:14</p>
          </div>
        </div>

        {/* 1. Overview */}
        <MockSectionCard icon={<Eye className="w-3.5 h-3.5" />} title="Overview" color="blue" delay={0}>
          <p className="text-xs text-white/60 leading-relaxed">
            This video explores how newsrooms are integrating AI tools into investigative workflows, from document analysis to pattern recognition across large datasets.
          </p>
        </MockSectionCard>

        {/* 2. Quick Assessment */}
        <MockSectionCard icon={<Sparkles className="w-3.5 h-3.5" />} title="Quick Assessment" color="amber" delay={0.06}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[0.5625rem] text-white/40 uppercase tracking-wider">Quality</span>
                <span className="text-sm font-bold text-white">8.2<span className="text-[0.5625rem] text-white/30">/10</span></span>
              </div>
              <span className="text-[0.5625rem] px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-emerald-400 font-semibold">Worth It</span>
            </div>
            <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: "82%" }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                className="h-full bg-brand rounded-full"
              />
            </div>
            <p className="text-[0.625rem] text-white/55 leading-relaxed">
              Well-sourced exploration with expert interviews. Goes beyond surface-level hype.
            </p>
          </div>
        </MockSectionCard>

        {/* 3. Key Takeaways */}
        <MockSectionCard icon={<Lightbulb className="w-3.5 h-3.5" />} title="Key Takeaways" color="cyan" delay={0.12}>
          <ul className="space-y-1.5">
            {[
              "ProPublica used AI classifiers to process 11.5M files in the Pandora Papers",
              "Local newsrooms with 3-5 reporters can now tackle impossible investigations",
              "Biggest risk: over-trusting AI outputs and skipping verification",
            ].map((text, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.3 + i * 0.08 }}
                className="flex items-start gap-1.5"
              >
                <div className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span className="text-xs text-white/60">{text}</span>
              </motion.li>
            ))}
          </ul>
        </MockSectionCard>

        {/* 4. Accuracy Analysis */}
        <MockSectionCard icon={<Shield className="w-3.5 h-3.5" />} title="Accuracy Analysis" color="emerald" delay={0.18}>
          <div className="space-y-2">
            <span className="text-[0.625rem] px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-emerald-400 inline-block">
              Mostly Accurate
            </span>
            <div className="space-y-1.5">
              <div className="flex items-start gap-1.5">
                <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                <span className="text-[0.625rem] text-white/55">Expert sources clearly identified with credentials</span>
              </div>
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" />
                <span className="text-[0.625rem] text-white/55">Open-source tool claim may overgeneralize</span>
              </div>
            </div>
          </div>
        </MockSectionCard>

        {/* 5. Action Items */}
        <MockSectionCard icon={<Target className="w-3.5 h-3.5" />} title="Action Items" color="orange" delay={0.24}>
          <div className="space-y-1.5">
            {[
              { text: "Explore open-source NLP tools for document analysis", priority: "high" as const },
              { text: "Read ICIJ methodology paper on Pandora Papers", priority: "high" as const },
              { text: "Review Hamilton's transparency standard proposal", priority: "medium" as const },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.priority === "high" ? "bg-red-400" : "bg-yellow-400"}`} />
                <span className="text-[0.625rem] text-white/60">{item.text}</span>
              </div>
            ))}
          </div>
        </MockSectionCard>
      </div>

      {/* Right panel — inline chat (desktop only) */}
      <div className="w-[220px] md:w-[260px] shrink-0 border-l border-white/[0.06] hidden md:flex flex-col">
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
              <p className="text-[0.625rem] text-white/80">What are the main criticisms of this approach?</p>
            </div>
          </div>

          {/* AI response */}
          <div className="flex justify-start">
            <div className="max-w-[95%] px-3 py-2 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06]">
              <p className="text-[0.625rem] text-white/60 leading-relaxed">
                The main criticisms center on three areas: <span className="text-white/80">over-reliance on AI for editorial decisions</span>, lack of transparency standards, and the risk that smaller newsrooms adopt tools without understanding limitations.
              </p>
              {/* Feedback */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                <ThumbsUp className="w-2.5 h-2.5 text-white/20 hover:text-white/50 cursor-pointer" />
                <ThumbsDown className="w-2.5 h-2.5 text-white/20 hover:text-white/50 cursor-pointer" />
              </div>
            </div>
          </div>

          {/* User follow-up */}
          <div className="flex justify-end">
            <div className="max-w-[90%] px-3 py-2 rounded-2xl rounded-tr-sm bg-brand/20 border border-brand/20">
              <p className="text-[0.625rem] text-white/80">How does Rat Park relate to this?</p>
            </div>
          </div>

          {/* AI response with citation */}
          <div className="flex justify-start">
            <div className="max-w-[95%] px-3 py-2 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06]">
              <p className="text-[0.625rem] text-white/60 leading-relaxed">
                That&apos;s from a different analysis. The Rat Park study is referenced in the addiction talk by Johann Hari <span className="text-brand text-[0.5625rem]">[1]</span>, not this journalism piece.
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
  )
}

// =============================================
// Library Preview — with X Posts content type
// =============================================

const LIBRARY_ITEMS = [
  {
    title: "How AI Is Reshaping Investigative Journalism",
    domain: "youtube.com",
    type: "youtube" as const,
    score: 8.2,
    badge: "Worth It",
    time: "2h ago",
    bookmarked: true,
  },
  {
    title: "Huberman Lab: Sleep Toolkit, Science-Based Protocols",
    domain: "spotify.com",
    type: "podcast" as const,
    score: 9.1,
    badge: "Must See",
    time: "3h ago",
    bookmarked: true,
  },
  {
    title: "The Hidden Economics of Cloud Computing in 2026",
    domain: "arstechnica.com",
    type: "article" as const,
    score: 7.5,
    badge: "Worth It",
    time: "5h ago",
    bookmarked: false,
  },
  {
    title: "Stanford CS229: Machine Learning Lecture Notes",
    domain: "cs229.stanford.edu",
    type: "pdf" as const,
    score: 8.9,
    badge: "Must See",
    time: "Yesterday",
    bookmarked: true,
  },
  {
    title: "Sam Altman on the next 12 months of AI progress",
    domain: "x.com",
    type: "x_post" as const,
    score: 6.4,
    badge: "Skim",
    time: "Yesterday",
    bookmarked: false,
  },
  {
    title: "Inside the FTC's New Approach to Big Tech Antitrust",
    domain: "reuters.com",
    type: "article" as const,
    score: 6.8,
    badge: "Skim",
    time: "2d ago",
    bookmarked: false,
  },
  {
    title: "Lex Fridman #412: Sam Altman on AGI",
    domain: "youtube.com",
    type: "youtube" as const,
    score: 7.9,
    badge: "Worth It",
    time: "2d ago",
    bookmarked: false,
  },
]

function LibraryPreview() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Library</h3>
          <p className="text-[0.625rem] text-white/40">7 analyses &middot; 3 bookmarked</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.5625rem] text-white/30">Sort: Recent</span>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
        <div className="w-full pl-9 pr-3 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-xs text-white/25">
          Search your library...
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {[
          { label: "All", active: true },
          { label: "Bookmarked", icon: Bookmark },
          { label: "YouTube", icon: Youtube },
          { label: "Articles", icon: FileText },
          { label: "Podcasts", icon: Headphones },
          { label: "8+ Score" },
        ].map((filter) => (
          <span
            key={filter.label}
            className={`px-2.5 py-1 rounded-full text-[0.5625rem] border transition-colors ${
              filter.active
                ? "bg-brand/15 border-brand/25 text-brand"
                : "bg-white/[0.03] border-white/[0.06] text-white/35"
            }`}
          >
            {filter.icon && <filter.icon className="w-2.5 h-2.5 inline mr-1" />}
            {filter.label}
          </span>
        ))}
      </div>

      {/* Items with staggered entrance */}
      <div className="space-y-1.5">
        {LIBRARY_ITEMS.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
          >
            <LibraryItemRow {...item} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// =============================================
// MockSectionCard — mirrors real SectionCard
// =============================================

const HEADER_COLORS = {
  blue: { bg: "bg-blue-500/15", border: "border-blue-500/20", text: "text-blue-300", icon: "text-blue-400" },
  amber: { bg: "bg-amber-500/15", border: "border-amber-500/20", text: "text-amber-300", icon: "text-amber-400" },
  cyan: { bg: "bg-cyan-500/15", border: "border-cyan-500/20", text: "text-cyan-300", icon: "text-cyan-400" },
  emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500/20", text: "text-emerald-300", icon: "text-emerald-400" },
  orange: { bg: "bg-orange-500/15", border: "border-orange-500/20", text: "text-orange-300", icon: "text-orange-400" },
  violet: { bg: "bg-violet-500/15", border: "border-violet-500/20", text: "text-violet-300", icon: "text-violet-400" },
}

function MockSectionCard({
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
      className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden hover:border-white/[0.12] transition-colors duration-200"
    >
      <div className={`px-3 sm:px-4 py-2 sm:py-3 border-b flex items-center justify-between ${colors.bg} ${colors.border}`}>
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

// =============================================
// LibraryItemRow — all 5 content types
// =============================================

function LibraryItemRow({
  title,
  domain,
  type,
  score,
  badge,
  time,
  bookmarked,
}: {
  title: string
  domain: string
  type: "youtube" | "article" | "podcast" | "pdf" | "x_post"
  score: number
  badge: string
  time: string
  bookmarked: boolean
}) {
  const typeConfig = {
    youtube: { icon: Play, color: "text-red-400" },
    podcast: { icon: Headphones, color: "text-purple-400" },
    pdf: { icon: FileUp, color: "text-orange-400" },
    article: { icon: FileText, color: "text-blue-400" },
    x_post: { icon: Twitter, color: "text-sky-400" },
  }

  const { icon: TypeIcon, color: typeColor } = typeConfig[type]

  const badgeConfig: Record<string, string> = {
    "Must See": "bg-brand/15 text-brand border-brand/25",
    "Worth It": "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    "Skim": "bg-amber-500/15 text-amber-400 border-amber-500/25",
    "Skip": "bg-red-500/15 text-red-400 border-red-500/25",
  }

  const badgeColor = badgeConfig[badge] || "bg-white/[0.06] text-white/50 border-white/[0.06]"

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-200 group">
      {/* Type icon */}
      <div className={`w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 ${typeColor}`}>
        <TypeIcon className="w-3.5 h-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[0.6875rem] font-medium text-white truncate group-hover:text-brand transition-colors">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[0.5625rem] text-white/40">{domain}</span>
          <span className="text-[0.5625rem] text-white/20">&middot;</span>
          <span className="text-[0.5625rem] text-white/40">{time}</span>
        </div>
      </div>

      {/* Verdict badge + score */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[0.5625rem] px-1.5 py-0.5 rounded-full border font-medium ${badgeColor} hidden sm:inline`}>
          {badge}
        </span>
        <div className="flex items-center gap-1">
          <div className="w-8 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full"
              style={{ width: `${score * 10}%` }}
            />
          </div>
          <span className="text-[0.625rem] font-medium text-white/60">{score}</span>
        </div>
        {bookmarked && (
          <Bookmark className="w-3 h-3 text-amber-400 fill-amber-400" />
        )}
      </div>
    </div>
  )
}

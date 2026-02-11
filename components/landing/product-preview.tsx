"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Play,
  Eye,
  Sparkles,
  Shield,
  Lightbulb,
  Target,
  Search,
  Bookmark,
  Tag,
  ArrowRight,
  FileText,
  Headphones,
  CheckCircle,
  AlertTriangle,
} from "lucide-react"

type PreviewTab = "analysis" | "library"

export function ProductPreview() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("analysis")

  return (
    <section className="py-16 sm:py-24 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Section heading */}
        <div className="text-center mb-8">
          <p className="text-[#1d9bf0] text-sm font-medium tracking-wide uppercase mb-3">
            Inside an analysis
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Six analysis sections. Claims verified. Speakers identified.
          </h2>
        </div>

        {/* Browser chrome frame */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden shadow-2xl shadow-black/50">
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
              <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
              <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-full border border-white/[0.06]">
              <button
                onClick={() => setActiveTab("analysis")}
                className={`px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                  activeTab === "analysis"
                    ? "bg-[#1d9bf0] text-white shadow-md shadow-blue-500/25"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                Analysis
              </button>
              <button
                onClick={() => setActiveTab("library")}
                className={`px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                  activeTab === "library"
                    ? "bg-[#1d9bf0] text-white shadow-md shadow-blue-500/25"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                Library
              </button>
            </div>

            <div className="w-[52px]" />
          </div>

          {/* Content area */}
          <div className="relative min-h-[480px] sm:min-h-[540px] overflow-hidden">
            {/* Analysis view */}
            <div
              className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                activeTab === "analysis"
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-8 pointer-events-none"
              }`}
            >
              <AnalysisPreview />
            </div>

            {/* Library view */}
            <div
              className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                activeTab === "library"
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-8 pointer-events-none"
              }`}
            >
              <LibraryPreview />
            </div>
          </div>
        </div>

        {/* CTA below preview */}
        <div className="text-center mt-8">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-medium rounded-full transition-colors"
          >
            Try it yourself
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

// =============================================
// Analysis Preview — simplified split layout
// =============================================

function AnalysisPreview() {
  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-[220px] sm:w-[260px] md:w-[300px] shrink-0 border-r border-white/[0.06] p-3 space-y-3 overflow-hidden hidden sm:block">
        {/* Video thumbnail */}
        <div className="rounded-xl bg-white/[0.04] aspect-video flex items-center justify-center border border-white/[0.06] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 to-purple-900/20" />
          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center border border-white/20 z-10">
            <Play className="w-4 h-4 text-white ml-0.5" />
          </div>
        </div>

        {/* Title */}
        <div>
          <p className="text-[11px] font-medium text-white leading-tight line-clamp-2">
            How AI Is Reshaping Investigative Journalism
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[9px] text-white/40 px-1.5 py-0.5 bg-white/[0.04] rounded">youtube.com</span>
            <span className="text-[9px] text-white/30 px-1.5 py-0.5 bg-white/[0.04] rounded flex items-center gap-0.5">
              <Play className="w-2 h-2" /> 28:14
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {["ai", "journalism", "media"].map((t) => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 bg-purple-500/15 border border-purple-500/25 rounded text-purple-300 capitalize">
              {t}
            </span>
          ))}
        </div>

        {/* Source history mini */}
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <p className="text-[9px] text-white/40 mb-1">Source History</p>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 bg-white/[0.08] rounded-full overflow-hidden">
              <div className="h-full w-[72%] bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full" />
            </div>
            <span className="text-[9px] font-medium text-white/60">7.2</span>
          </div>
        </div>
      </div>

      {/* Right panel — analysis cards */}
      <div className="flex-1 p-3 sm:p-4 space-y-3 overflow-y-auto">
        {/* Mobile-only compact content card */}
        <div className="sm:hidden flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="w-14 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 to-purple-900/20" />
            <Play className="w-3 h-3 text-white z-10" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">How AI Is Reshaping Investigative Journalism</p>
            <p className="text-[10px] text-white/40">youtube.com &middot; 28:14</p>
          </div>
        </div>
        {/* Overview card */}
        <MiniCard
          icon={<Eye className="w-3 h-3" />}
          title="Overview"
          color="blue"
        >
          <p className="text-xs text-white/60 leading-relaxed">
            This video explores how newsrooms are integrating AI tools into investigative workflows, from document analysis to pattern recognition across large datasets. Host Marcus Chen interviews ProPublica&apos;s data team lead and a Columbia J-School professor about the promise and risks of AI-assisted reporting.
          </p>
        </MiniCard>

        {/* Quick Assessment card */}
        <MiniCard
          icon={<Sparkles className="w-3 h-3" />}
          title="Quick Assessment"
          color="amber"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/55">Quality</span>
              <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                <div className="h-full w-[82%] bg-gradient-to-r from-yellow-500 to-green-500 rounded-full" />
              </div>
              <span className="text-xs font-semibold text-white">8.2</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-emerald-400">Insightful</span>
              <span className="text-[9px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-white/40">Documentary</span>
            </div>
            <p className="text-[10px] text-white/55 leading-relaxed">
              Well-sourced exploration with expert interviews and concrete examples. Goes beyond surface-level hype.
            </p>
          </div>
        </MiniCard>

        {/* Key Takeaways card */}
        <MiniCard
          icon={<Lightbulb className="w-3 h-3" />}
          title="Key Takeaways"
          color="cyan"
        >
          <ul className="space-y-1.5">
            <li className="flex items-start gap-1.5">
              <div className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
              <span className="text-xs text-white/60">ProPublica used AI classifiers to process 11.5M files in the Pandora Papers investigation</span>
            </li>
            <li className="flex items-start gap-1.5">
              <div className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
              <span className="text-xs text-white/60">Local newsrooms with 3-5 reporters can now tackle previously impossible investigations</span>
            </li>
            <li className="flex items-start gap-1.5">
              <div className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
              <span className="text-xs text-white/60">Biggest risk: journalists over-trusting AI outputs and skipping verification</span>
            </li>
          </ul>
        </MiniCard>

        {/* Accuracy card */}
        <MiniCard
          icon={<Shield className="w-3 h-3" />}
          title="Accuracy Analysis"
          color="emerald"
        >
          <div className="space-y-2">
            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-emerald-400 inline-block">
              Mostly Accurate
            </span>
            <div className="space-y-1.5">
              <div className="flex items-start gap-1.5">
                <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                <span className="text-[10px] text-white/55">Expert sources clearly identified with credentials</span>
              </div>
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" />
                <span className="text-[10px] text-white/55">Open-source tool claim may overgeneralize; commercial tools still lead for complex review</span>
              </div>
            </div>
          </div>
        </MiniCard>

        {/* Action Items card */}
        <MiniCard
          icon={<Target className="w-3 h-3" />}
          title="Action Items"
          color="orange"
        >
          <div className="space-y-1.5">
            {[
              { text: "Explore open-source NLP tools for document analysis", priority: "high" },
              { text: "Read ICIJ methodology paper on Pandora Papers", priority: "high" },
              { text: "Review Hamilton's proposed transparency standard", priority: "medium" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  item.priority === "high" ? "bg-red-400" : "bg-yellow-400"
                }`} />
                <span className="text-[10px] text-white/60">{item.text}</span>
              </div>
            ))}
          </div>
        </MiniCard>

        {/* Deep Dive card */}
        <MiniCard
          icon={<FileText className="w-3 h-3" />}
          title="Deep Dive"
          color="violet"
        >
          <p className="text-xs text-white/60 leading-relaxed">
            The interview reveals a tension between AI&apos;s speed and journalism&apos;s need for verification. <span className="text-white/70">Marcus Chen</span> pushes back on claims that AI can replace editorial judgment, while <span className="text-white/70">Dr. Sarah Hamilton</span> argues the real risk is newsrooms adopting AI without transparency standards...
          </p>
        </MiniCard>
      </div>
    </div>
  )
}

// =============================================
// Library Preview — simplified list
// =============================================

const LIBRARY_ITEMS = [
  {
    title: "How AI Is Reshaping Investigative Journalism",
    domain: "youtube.com",
    type: "youtube" as const,
    score: 8.2,
    badge: "Insightful",
    time: "2h ago",
    bookmarked: true,
  },
  {
    title: "Huberman Lab: Sleep Toolkit, Science-Based Protocols",
    domain: "spotify.com",
    type: "podcast" as const,
    score: 9.1,
    badge: "Mind-blowing",
    time: "3h ago",
    bookmarked: true,
  },
  {
    title: "The Hidden Economics of Cloud Computing in 2026",
    domain: "arstechnica.com",
    type: "article" as const,
    score: 7.5,
    badge: "Insightful",
    time: "5h ago",
    bookmarked: false,
  },
  {
    title: "Stanford CS229: Machine Learning Lecture Notes",
    domain: "cs229.stanford.edu",
    type: "pdf" as const,
    score: 8.9,
    badge: "Mind-blowing",
    time: "Yesterday",
    bookmarked: true,
  },
  {
    title: "Inside the FTC's New Approach to Big Tech Antitrust",
    domain: "reuters.com",
    type: "article" as const,
    score: 6.8,
    badge: "Noteworthy",
    time: "Yesterday",
    bookmarked: false,
  },
  {
    title: "Lex Fridman #412: Sam Altman on AGI and the Future of OpenAI",
    domain: "youtube.com",
    type: "youtube" as const,
    score: 7.9,
    badge: "Insightful",
    time: "2d ago",
    bookmarked: false,
  },
]

function LibraryPreview() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Library</h3>
        <p className="text-[10px] text-white/55">Your analyzed content</p>
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
        <div className="w-full pl-8 pr-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-xl text-[10px] text-white/25">
          Search...
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <span className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-[9px] text-white/40">
          <Bookmark className="w-2.5 h-2.5 inline mr-1" />Bookmarked
        </span>
        <span className="px-2.5 py-1 bg-purple-500/15 border border-purple-500/25 rounded-full text-[9px] text-purple-400">
          <Tag className="w-2.5 h-2.5 inline mr-1" />Tags (3)
        </span>
        <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-[9px] text-emerald-400">
          All Scores
        </span>
        <span className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-[9px] text-white/40">
          8+
        </span>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {LIBRARY_ITEMS.map((item, i) => (
          <LibraryItemRow key={i} {...item} />
        ))}
      </div>
    </div>
  )
}

// =============================================
// Shared mini components
// =============================================

const COLOR_MAP = {
  blue: "bg-blue-500/15 border-blue-500/25 text-blue-300",
  amber: "bg-amber-500/15 border-amber-500/25 text-amber-300",
  cyan: "bg-cyan-500/15 border-cyan-500/25 text-cyan-300",
  emerald: "bg-emerald-500/15 border-emerald-500/25 text-emerald-300",
  orange: "bg-orange-500/15 border-orange-500/25 text-orange-300",
  violet: "bg-violet-500/15 border-violet-500/25 text-violet-300",
}

function MiniCard({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode
  title: string
  color: keyof typeof COLOR_MAP
  children: React.ReactNode
}) {
  const headerClass = COLOR_MAP[color]
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
      <div className={`px-3 py-1.5 border-b border-white/[0.04] ${headerClass}`}>
        <span className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
          {icon}
          {title}
        </span>
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  )
}

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
  type: "youtube" | "article" | "podcast" | "pdf"
  score: number
  badge: string
  time: string
  bookmarked: boolean
}) {
  const TypeIcon = type === "youtube" ? Play : type === "podcast" ? Headphones : type === "pdf" ? FileText : FileText
  const typeColor = type === "youtube" ? "text-red-400" : type === "podcast" ? "text-purple-400" : type === "pdf" ? "text-orange-400" : "text-blue-400"

  const badgeColor =
    badge === "Mind-blowing"
      ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
      : badge === "Insightful"
        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
        : "bg-white/[0.06] text-white/50 border-white/[0.06]"

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors">
      {/* Type icon */}
      <div className={`w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 ${typeColor}`}>
        <TypeIcon className="w-3.5 h-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-white truncate">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] text-white/40">{domain}</span>
          <span className="text-[9px] text-white/20">&middot;</span>
          <span className="text-[9px] text-white/40">{time}</span>
        </div>
      </div>

      {/* Score + badge */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${badgeColor} hidden sm:inline`}>
          {badge}
        </span>
        <div className="flex items-center gap-1">
          <div className="w-8 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full"
              style={{ width: `${score * 10}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-white/60">{score}</span>
        </div>
        {bookmarked && (
          <Bookmark className="w-3 h-3 text-amber-400 fill-amber-400" />
        )}
      </div>
    </div>
  )
}

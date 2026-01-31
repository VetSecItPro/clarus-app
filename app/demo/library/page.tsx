"use client"

import { useState } from "react"
import {
  Search,
  SlidersHorizontal,
  Bookmark,
  Tag,
  Star,
  ChevronDown,
} from "lucide-react"
import { ChatThreadCard } from "@/components/chat"
import type { TriageData } from "@/types/database.types"
import { cn } from "@/lib/utils"

// =============================================
// MOCK DATA — Library items
// =============================================

interface MockItem {
  id: string
  title: string
  url: string
  type: "youtube" | "article" | "podcast"
  thumbnail_url: string | null
  brief_overview: string
  triage: TriageData
  date_added: string
  is_bookmarked: boolean
}

const now = new Date()
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString()
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString()

const MOCK_ITEMS: MockItem[] = [
  {
    id: "demo-1",
    title: "How AI Is Reshaping Investigative Journalism — And Why It Matters",
    url: "https://www.youtube.com/watch?v=abc123",
    type: "youtube",
    thumbnail_url: "https://img.youtube.com/vi/aircAruvnKk/maxresdefault.jpg",
    brief_overview:
      "This video explores how newsrooms are integrating AI tools into investigative workflows — from document analysis to pattern recognition across large datasets. Features interviews with ProPublica's data team lead and a Columbia J-School professor.",
    triage: {
      quality_score: 8.2,
      worth_your_time: "Yes — Well-sourced with expert interviews and concrete examples.",
      target_audience: ["Journalists", "Media professionals", "AI practitioners"],
      content_density: "High",
      signal_noise_score: 2,
      content_category: "documentary",
    },
    date_added: hoursAgo(2),
    is_bookmarked: true,
  },
  {
    id: "demo-2",
    title: "The Hidden Economics of Cloud Computing in 2026",
    url: "https://arstechnica.com/cloud-computing-economics-2026",
    type: "article",
    thumbnail_url: null,
    brief_overview:
      "An in-depth analysis of how cloud computing costs have shifted since the AI boom began. Examines AWS, Azure, and GCP pricing changes, the rise of reserved GPU instances, and why many companies are repatriating workloads back to on-premise infrastructure.",
    triage: {
      quality_score: 7.5,
      worth_your_time: "Yes — Solid reporting with original data analysis on cloud cost trends.",
      target_audience: ["Engineers", "CTOs", "Finance teams"],
      content_density: "High",
      signal_noise_score: 2,
      content_category: "tech",
    },
    date_added: hoursAgo(5),
    is_bookmarked: false,
  },
  {
    id: "demo-3",
    title: "Why Battery Technology Is Stuck — And What Might Unstick It",
    url: "https://www.youtube.com/watch?v=def456",
    type: "youtube",
    thumbnail_url: "https://img.youtube.com/vi/4-079YIasck/maxresdefault.jpg",
    brief_overview:
      "A detailed examination of the physics and chemistry behind lithium-ion battery limitations. Covers solid-state batteries, sodium-ion alternatives, and why breakthroughs in the lab rarely translate to commercial products. Features interviews with researchers from Stanford and CATL.",
    triage: {
      quality_score: 9.1,
      worth_your_time: "Yes — Outstanding scientific explainer with primary source interviews.",
      target_audience: ["Engineers", "Science enthusiasts", "Investors"],
      content_density: "High",
      signal_noise_score: 3,
      content_category: "educational",
    },
    date_added: daysAgo(1),
    is_bookmarked: true,
  },
  {
    id: "demo-4",
    title: "Inside the FTC's New Approach to Big Tech Antitrust",
    url: "https://www.reuters.com/ftc-big-tech-antitrust-2026",
    type: "article",
    thumbnail_url: null,
    brief_overview:
      "Reuters reports on the FTC's evolving strategy for antitrust enforcement against major technology companies. Includes leaked internal documents showing the agency's prioritization framework and interviews with former FTC commissioners.",
    triage: {
      quality_score: 6.8,
      worth_your_time: "Maybe — Good sourcing but leans heavily on anonymous sources.",
      target_audience: ["Policy analysts", "Tech executives", "Lawyers"],
      content_density: "Medium",
      signal_noise_score: 1,
      content_category: "news",
    },
    date_added: daysAgo(1),
    is_bookmarked: false,
  },
  {
    id: "demo-5",
    title: "Deep Dive: The Future of Remote Work After the Return-to-Office Backlash",
    url: "https://podcasts.apple.com/remote-work-deep-dive",
    type: "podcast",
    thumbnail_url: null,
    brief_overview:
      "A 90-minute podcast featuring Stanford economist Nick Bloom and Shopify's VP of Remote discussing what the data actually shows about remote work productivity, the political dynamics of return-to-office mandates, and emerging hybrid models that seem to satisfy both sides.",
    triage: {
      quality_score: 7.9,
      worth_your_time: "Yes — Two strong expert voices with data-driven arguments on both sides.",
      target_audience: ["Managers", "HR leaders", "Remote workers"],
      content_density: "Medium",
      signal_noise_score: 2,
      content_category: "podcast",
    },
    date_added: daysAgo(2),
    is_bookmarked: false,
  },
  {
    id: "demo-6",
    title: "How Generative AI Is Changing Scientific Research",
    url: "https://www.nature.com/generative-ai-scientific-research",
    type: "article",
    thumbnail_url: null,
    brief_overview:
      "Nature examines how generative AI tools are being used across disciplines — from protein structure prediction to climate modeling to drug discovery. Includes a survey of 2,400 researchers on their AI tool usage and concerns about reproducibility.",
    triage: {
      quality_score: 8.7,
      worth_your_time: "Yes — Authoritative source with original survey data across multiple disciplines.",
      target_audience: ["Researchers", "Scientists", "Science policy makers"],
      content_density: "High",
      signal_noise_score: 3,
      content_category: "educational",
    },
    date_added: daysAgo(3),
    is_bookmarked: true,
  },
  {
    id: "demo-7",
    title: "The 60-Minute MBA: What Business School Actually Teaches You",
    url: "https://www.youtube.com/watch?v=ghi789",
    type: "youtube",
    thumbnail_url: "https://img.youtube.com/vi/Ihs4VFZWwn4/maxresdefault.jpg",
    brief_overview:
      "A distilled breakdown of core MBA concepts: financial modeling, competitive strategy, organizational behavior, and negotiation frameworks. The creator is a Wharton MBA who argues that 80% of the value can be conveyed in an hour.",
    triage: {
      quality_score: 6.4,
      worth_your_time: "Maybe — Good overview but oversimplifies several key concepts.",
      target_audience: ["Aspiring MBAs", "Entrepreneurs", "Career changers"],
      content_density: "Medium",
      signal_noise_score: 1,
      content_category: "educational",
    },
    date_added: daysAgo(5),
    is_bookmarked: false,
  },
]

const SCORE_FILTER_OPTIONS = [
  { value: "all", label: "All Scores" },
  { value: "high", label: "8+" },
  { value: "good", label: "6-7" },
  { value: "low", label: "Below 6" },
]

// Group items by date
function groupByDate(items: MockItem[]): { label: string; items: MockItem[] }[] {
  const groups: Record<string, MockItem[]> = {}

  items.forEach((item) => {
    const date = new Date(item.date_added)
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)

    let key: string
    if (diffDays === 0) key = "Today"
    else if (diffDays === 1) key = "Yesterday"
    else if (diffDays <= 6) key = `${diffDays} days ago`
    else if (diffDays <= 13) key = "Last week"
    else key = "Older"

    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  })

  const order = ["Today", "Yesterday", "2 days ago", "3 days ago", "4 days ago", "5 days ago", "6 days ago", "Last week", "Older"]
  return order
    .filter((label) => groups[label] && groups[label].length > 0)
    .map((label) => ({ label, items: groups[label] }))
}

export default function DemoLibraryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [scoreFilter, setScoreFilter] = useState("all")
  const [bookmarkOnly, setBookmarkOnly] = useState(false)

  let filtered = MOCK_ITEMS

  if (bookmarkOnly) {
    filtered = filtered.filter((item) => item.is_bookmarked)
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.brief_overview.toLowerCase().includes(q)
    )
  }

  if (scoreFilter === "high") {
    filtered = filtered.filter((item) => item.triage.quality_score >= 8)
  } else if (scoreFilter === "good") {
    filtered = filtered.filter(
      (item) => item.triage.quality_score >= 6 && item.triage.quality_score < 8
    )
  } else if (scoreFilter === "low") {
    filtered = filtered.filter((item) => item.triage.quality_score < 6)
  }

  const groupedItems = groupByDate(filtered)

  return (
    <main className="flex-1 max-w-4xl mx-auto px-4 pt-4 pb-8 w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Library</h1>
        <p className="text-white/50 text-sm">Your analyzed content</p>
      </div>

      {/* Search & Filter Bar */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white/[0.06] border border-white/[0.08] rounded-2xl text-base text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="flex items-center justify-center gap-2 h-10 px-4 bg-white/[0.06] border border-white/[0.08] rounded-full text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-sm"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={() => setBookmarkOnly(!bookmarkOnly)}
            className={cn(
              "flex items-center gap-2 h-10 px-5 rounded-full text-sm transition-all",
              bookmarkOnly
                ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                : "bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
            )}
          >
            <Bookmark className={cn("w-4 h-4", bookmarkOnly && "fill-current")} />
            Bookmarked
          </button>

          <button className="flex items-center gap-2 h-10 px-5 rounded-full text-sm bg-purple-500/20 border border-purple-500/30 text-purple-400 transition-all">
            <Tag className="w-4 h-4" />
            Tags (3)
            <ChevronDown className="w-3 h-3" />
          </button>

          <div className="flex items-center gap-1">
            {SCORE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setScoreFilter(opt.value)}
                className={cn(
                  "flex items-center gap-1.5 h-10 px-3 rounded-full text-sm transition-all",
                  scoreFilter === opt.value
                    ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                    : "bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
                )}
              >
                {opt.value === "high" && <Star className="w-3 h-3 fill-current" />}
                {opt.label}
              </button>
            ))}
          </div>

          {/* Active tag pills */}
          <div className="flex items-center gap-1">
            {["ai", "journalism", "tech"].map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-400 capitalize"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content grouped by date */}
      <div className="space-y-6">
        {groupedItems.map((group) => (
          <div key={group.label}>
            <h2 className="text-white/50 text-xs font-medium uppercase tracking-wider mb-3 px-1">
              {group.label}
            </h2>
            <div className="space-y-2">
              {group.items.map((item) => (
                <ChatThreadCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  url={item.url}
                  type={item.type}
                  thumbnail_url={item.thumbnail_url}
                  brief_overview={item.brief_overview}
                  triage={item.triage}
                  date_added={item.date_added}
                  is_bookmarked={item.is_bookmarked}
                  onClick={() => {}}
                  onBookmark={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

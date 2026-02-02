import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { TriageData } from "@/types/database.types"
import type { Metadata } from "next"
import Link from "next/link"
import { FileText, Play, MessageSquare, FileIcon, ExternalLink, TrendingUp, Sparkles } from "lucide-react"
import { PublicHeader } from "@/components/public-header"
import { LandingFooter } from "@/components/landing/landing-footer"

export const revalidate = 300 // Revalidate every 5 minutes

export const metadata: Metadata = {
  title: "Discover — Trending AI Analyses This Week | Clarus",
  description:
    "Explore the most interesting content analyzed this week on Clarus. AI-powered truth analysis, summaries, and insights from YouTube videos, podcasts, articles, and PDFs — curated anonymously.",
  keywords: [
    "trending content",
    "content discovery",
    "ai analysis feed",
    "curated content",
    "trending articles",
    "trending videos",
  ],
  openGraph: {
    title: "Discover — Trending AI Analyses This Week | Clarus",
    description:
      "Explore the most interesting content analyzed this week. AI summaries, fact-checks, and insights — curated anonymously.",
    url: "https://clarusapp.io/discover",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Discover — Trending Analyses | Clarus",
    description:
      "The most interesting content analyzed this week. AI-powered summaries and fact-checks.",
  },
  alternates: {
    canonical: "https://clarusapp.io/discover",
  },
}

interface DiscoverItem {
  title: string
  sourceUrl: string
  type: string
  shareToken: string
  teaser: string
  qualityScore: number
  domain: string
  dateAdded: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string; bg: string }> = {
  youtube: { label: "YouTube", icon: Play, color: "text-red-400", bg: "bg-red-500/10" },
  article: { label: "Article", icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
  x_post: { label: "X Post", icon: MessageSquare, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  pdf: { label: "PDF", icon: FileIcon, color: "text-purple-400", bg: "bg-purple-500/10" },
}

async function getDiscoverItems(): Promise<DiscoverItem[]> {
  const supabase = createClient<Database, "clarus">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "clarus" } }
  )

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: sharedContent, error: contentError } = await supabase
    .from("content")
    .select("id, title, url, type, share_token, date_added")
    .not("share_token", "is", null)
    .gte("date_added", sevenDaysAgo)
    .order("date_added", { ascending: false })
    .limit(50)

  if (contentError || !sharedContent || sharedContent.length === 0) {
    return []
  }

  const contentIds = sharedContent.map(c => c.id)
  const { data: summaries } = await supabase
    .from("summaries")
    .select("content_id, brief_overview, triage")
    .in("content_id", contentIds)
    .eq("processing_status", "complete")

  return sharedContent
    .map(content => {
      const summary = summaries?.find(s => s.content_id === content.id)
      if (!summary) return null

      const triage = summary.triage as unknown as TriageData | null
      const qualityScore = triage?.quality_score ?? 0

      const rawOverview = summary.brief_overview || ""
      const teaser = rawOverview.length > 200
        ? rawOverview.slice(0, 200).trim() + "..."
        : rawOverview

      let domain = ""
      try {
        domain = new URL(content.url).hostname.replace(/^www\./, "")
      } catch {
        domain = "unknown"
      }

      return {
        title: content.title || "Untitled",
        sourceUrl: content.url,
        type: content.type || "article",
        shareToken: content.share_token!,
        teaser,
        qualityScore,
        domain,
        dateAdded: content.date_added || new Date().toISOString(),
      }
    })
    .filter((item): item is DiscoverItem => item !== null)
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 20)
}

function QualityBadge({ score }: { score: number }) {
  let color = "text-red-400 bg-red-500/10 border-red-500/20"
  if (score >= 7) color = "text-green-400 bg-green-500/10 border-green-500/20"
  else if (score >= 5) color = "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {score.toFixed(1)}/10
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.article
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${config.bg}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

export default async function DiscoverPage() {
  const items = await getDiscoverItems()

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 lg:px-6 py-12 w-full">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 mb-6">
            <TrendingUp className="w-3.5 h-3.5 text-[#1d9bf0]" />
            <span className="text-xs font-medium text-[#1d9bf0]">Trending This Week</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Discover
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            The most interesting content analyzed on Clarus this week.
            AI-powered truth analysis, summaries, and insights.
          </p>
        </div>

        {/* Content Grid */}
        {items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item, index) => (
              <Link
                key={item.shareToken}
                href={`/share/${item.shareToken}`}
                className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
              >
                {/* Top row: type badge + quality score */}
                <div className="flex items-center justify-between mb-3">
                  <TypeBadge type={item.type} />
                  <QualityBadge score={item.qualityScore} />
                </div>

                {/* Title */}
                <h2 className="text-base font-semibold text-white group-hover:text-[#1d9bf0] transition-colors line-clamp-2 mb-2">
                  {index < 3 && (
                    <Sparkles className="w-4 h-4 text-yellow-400 inline mr-1.5 -mt-0.5" />
                  )}
                  {item.title}
                </h2>

                {/* Teaser */}
                {item.teaser && (
                  <p className="text-sm text-white/50 line-clamp-3 mb-3 leading-relaxed">
                    {item.teaser}
                  </p>
                )}

                {/* Footer: domain + date */}
                <div className="flex items-center justify-between text-xs text-white/30">
                  <div className="flex items-center gap-1.5">
                    <ExternalLink className="w-3 h-3" />
                    <span className="truncate max-w-[160px]">{item.domain}</span>
                  </div>
                  <time dateTime={item.dateAdded}>
                    {new Date(item.dateAdded).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="inline-flex p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-4">
              <Sparkles className="w-8 h-8 text-white/20" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Nothing here yet</h2>
            <p className="text-white/40 text-sm max-w-md mx-auto mb-6">
              Content appears here when users share their analyses publicly.
              Be the first to analyze and share something interesting.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white text-sm font-medium rounded-full transition-colors"
            >
              Get Started
            </Link>
          </div>
        )}
      </main>

      <LandingFooter />
    </div>
  )
}

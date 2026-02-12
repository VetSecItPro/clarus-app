import type { Metadata } from "next"
import Link from "next/link"
import { Shield, Play, FileText, FileIcon, MessageSquare, BookOpen, Download, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Features — YouTube Summarizer, Fact-Checker, Article & PDF Analyzer | Clarus",
  description:
    "Explore all Clarus features: YouTube video summarizer, podcast analyzer, article summarizer, PDF analyzer, AI fact-checker, content chat, searchable library, and export tools.",
  keywords: [
    "youtube summarizer",
    "podcast analyzer",
    "article summarizer",
    "pdf analyzer",
    "ai fact checker",
    "content analysis tool",
    "video summary tool",
  ],
  openGraph: {
    title: "Features — YouTube Summarizer, Fact-Checker & More | Clarus",
    description:
      "YouTube summarizer, podcast analyzer, article summarizer, PDF analyzer, AI fact-checker, and more.",
    url: "https://clarusapp.io/features",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Features | Clarus",
    description:
      "YouTube summarizer, podcast analyzer, article analyzer, fact-checker, and more. Free to start.",
  },
  alternates: {
    canonical: "https://clarusapp.io/features",
  },
}

const features = [
  {
    href: "/features/truth-analysis",
    icon: Shield,
    title: "Truth Analysis",
    description: "AI-powered fact-checking that identifies claims as verified, likely accurate, or misleading.",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    href: "/features/youtube-analysis",
    icon: Play,
    title: "YouTube Analysis",
    description: "Full transcription, speaker identification, timestamped breakdown, and quality scoring.",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  {
    href: "/features/article-analysis",
    icon: FileText,
    title: "Article Analysis",
    description: "Scrape and analyze any web article or blog post. Paywall detection included.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    href: "/features/pdf-analysis",
    icon: FileIcon,
    title: "PDF Analysis",
    description: "Extract and analyze text from research papers, reports, whitepapers, and documents.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    href: "/features/ai-chat",
    icon: MessageSquare,
    title: "Chat with Content",
    description: "Ask questions about any analyzed content. Get answers with context and web search.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    href: "/features/library",
    icon: BookOpen,
    title: "Content Library",
    description: "Searchable archive with full-text search, tags, filters, and quality-based sorting.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    href: "/features/export",
    icon: Download,
    title: "Export & Share",
    description: "Export as markdown or PDF. Share with public links. Send via email.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  {
    href: "/features/weekly-digest",
    icon: Mail,
    title: "Weekly Digest",
    description: "Personal analysis recap plus trending content curated from across Clarus.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
]

// ISR: revalidate every hour — content changes infrequently
export const revalidate = 3600

export default function FeaturesIndexPage() {
  return (
    <main id="main-content" className="max-w-5xl mx-auto px-4 lg:px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Features
        </h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto">
          Everything you need to analyze, fact-check, and understand content
          from across the web.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Link
              key={feature.href}
              href={feature.href}
              className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
            >
              <div className={`inline-flex p-2.5 rounded-xl ${feature.bg} mb-4`}>
                <Icon className={`w-5 h-5 ${feature.color}`} />
              </div>
              <h2 className="text-base font-semibold text-white group-hover:text-brand transition-colors mb-2">
                {feature.title}
              </h2>
              <p className="text-sm text-white/40 leading-relaxed">
                {feature.description}
              </p>
            </Link>
          )
        })}
      </div>
    </main>
  )
}

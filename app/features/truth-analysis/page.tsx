import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

export const metadata: Metadata = {
  title: "AI Truth Analysis & Fact-Checking | Clarus",
  description:
    "Automatically fact-check claims in articles, videos, and podcasts. Clarus identifies what's fact, opinion, or unsupported with AI-powered truth analysis.",
  openGraph: {
    title: "AI Truth Analysis & Fact-Checking | Clarus",
    description:
      "Automatically fact-check claims in articles, videos, and podcasts with AI-powered truth analysis.",
  },
}

export default function TruthAnalysisPage() {
  return (
    <FeaturePage
      badge="Core Feature"
      title="AI-Powered Truth Analysis"
      subtitle="Know what's fact, opinion, or unsupported before you share or cite content."
      description="Clarus uses AI to identify specific claims in any content — articles, YouTube videos, X posts, PDFs — and evaluates each one for accuracy. Every claim gets tagged as verified, likely accurate, unverifiable, misleading, or false. You also get an overall truth rating so you can quickly gauge the reliability of what you're reading or watching."
      steps={[
        {
          number: "1",
          title: "Paste any URL",
          description: "Drop a link to an article, video, tweet, or PDF. Clarus scrapes the full content automatically.",
        },
        {
          number: "2",
          title: "Claims are extracted",
          description: "The AI identifies every factual claim, statistic, and assertion in the content and evaluates each one independently.",
        },
        {
          number: "3",
          title: "See the truth rating",
          description: "Get an overall accuracy score plus a detailed breakdown of individual claims with supporting evidence.",
        },
      ]}
      benefits={[
        "Individual claim-level fact checking",
        "Overall content truth rating (1-10)",
        "Evidence and reasoning for each rating",
        "Identifies opinions vs. factual claims",
        "Flags unsupported or misleading assertions",
        "Works across articles, videos, and PDFs",
      ]}
      relatedFeatures={[
        { title: "YouTube Analysis", href: "/features/youtube-analysis", description: "Analyze any YouTube video with timestamps" },
        { title: "Chat with Content", href: "/features/ai-chat", description: "Ask follow-up questions about any analysis" },
        { title: "Export & Share", href: "/features/export", description: "Export analyses as markdown or PDF" },
      ]}
    />
  )
}

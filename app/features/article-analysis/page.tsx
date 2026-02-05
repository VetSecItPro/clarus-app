import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

// ISR: revalidate every hour — marketing content changes infrequently
export const revalidate = 3600

export const metadata: Metadata = {
  title: "Article Summarizer — AI Analysis for Any Web Article | Clarus",
  description:
    "Summarize any article or blog post with AI. Get key takeaways, fact-checks, quality scores, and action items from news, Substack, Medium, and any web page. Free article summarizer.",
  keywords: [
    "article summarizer",
    "article summary tool",
    "ai article analyzer",
    "blog post summarizer",
    "summarize article",
    "news article summary",
    "web article analysis",
  ],
  openGraph: {
    title: "Article Summarizer — AI Analysis for Any Web Article | Clarus",
    description:
      "Summarize any article with AI. Key takeaways, fact-checks, quality scores, and action items in seconds.",
    url: "https://clarusapp.io/features/article-analysis",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Article Summarizer | Clarus",
    description:
      "Paste any article URL, get key takeaways, fact-checks, and quality scores. Free to start.",
  },
  alternates: {
    canonical: "https://clarusapp.io/features/article-analysis",
  },
}

export default function ArticleAnalysisPage() {
  return (
    <FeaturePage
      badge="Content Type"
      title="Article & Blog Analysis"
      subtitle="Cut through the noise. Get the substance of any article with AI-powered analysis."
      description="Paste a link to any article or blog post and Clarus scrapes the full text, evaluates the content quality, fact-checks claims, and extracts the key insights. Works with news articles, opinion pieces, research write-ups, Substack posts, Medium articles, and any publicly accessible web page. Paywall detection warns you when content may be truncated."
      steps={[
        {
          number: "1",
          title: "Paste any article URL",
          description: "Drop a link to any web article. Clarus scrapes the full text and metadata using advanced web extraction.",
        },
        {
          number: "2",
          title: "Six-section analysis",
          description: "Get a brief overview, quality assessment, key takeaways, truth check, action items, and a detailed analytical breakdown.",
        },
        {
          number: "3",
          title: "Save or share",
          description: "Save to your library for reference, export as markdown or PDF, or share the analysis with a public link.",
        },
      ]}
      benefits={[
        "Works with any publicly accessible web page",
        "Paywall detection warns about truncated content",
        "Quality score rates the content 1-10",
        "Extracts key quotes and evidence",
        "Identifies the target audience",
        "Actionable recommendations from the content",
      ]}
      relatedFeatures={[
        { title: "PDF Analysis", href: "/features/pdf-analysis", description: "Upload and analyze PDF documents" },
        { title: "Truth Analysis", href: "/features/truth-analysis", description: "Fact-check claims from any content" },
        { title: "AI Chat", href: "/features/ai-chat", description: "Ask questions about any analysis" },
      ]}
    />
  )
}

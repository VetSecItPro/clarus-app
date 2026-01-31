import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

export const metadata: Metadata = {
  title: "Article & Blog Analysis with AI | Clarus",
  description:
    "Analyze any web article or blog post with AI. Get summaries, fact-checks, quality scores, and actionable takeaways in seconds.",
  openGraph: {
    title: "Article & Blog Analysis with AI | Clarus",
    description:
      "Analyze any web article or blog post with AI. Get summaries, fact-checks, and quality scores.",
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

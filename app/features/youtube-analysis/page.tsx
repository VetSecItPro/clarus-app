import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

export const metadata: Metadata = {
  title: "YouTube Video Analysis & Summary | Clarus",
  description:
    "Get AI-powered summaries, fact-checks, and key takeaways from any YouTube video. Extract insights without watching the full video.",
  openGraph: {
    title: "YouTube Video Analysis & Summary | Clarus",
    description:
      "Get AI-powered summaries, fact-checks, and key takeaways from any YouTube video.",
  },
}

export default function YouTubeAnalysisPage() {
  return (
    <FeaturePage
      badge="Content Type"
      title="YouTube Video Analysis"
      subtitle="Extract key insights, fact-check claims, and get structured summaries from any YouTube video."
      description="Paste a YouTube URL and Clarus transcribes the video, identifies speakers, and produces a full analysis — overview, quality assessment, truth check, key takeaways, action items, and a detailed breakdown with timestamps. Perfect for long-form content like podcasts, interviews, lectures, and documentaries where you need the signal without the two-hour commitment."
      steps={[
        {
          number: "1",
          title: "Paste a YouTube URL",
          description: "Drop any YouTube link. Clarus pulls the transcript, video metadata, and thumbnail automatically.",
        },
        {
          number: "2",
          title: "AI analyzes the video",
          description: "Six analysis sections run in parallel: overview, quality assessment, truth check, key takeaways, action items, and detailed breakdown.",
        },
        {
          number: "3",
          title: "Navigate with timestamps",
          description: "The detailed analysis includes timestamps so you can jump to the exact moments that matter most.",
        },
      ]}
      benefits={[
        "Full transcript extraction and analysis",
        "Speaker identification and attribution",
        "Timestamped detailed breakdown",
        "Quality score and worth-your-time rating",
        "Action items extracted from the content",
        "Chat with the video to ask follow-up questions",
      ]}
      relatedFeatures={[
        { title: "Truth Analysis", href: "/features/truth-analysis", description: "Fact-check claims from any content" },
        { title: "Article Analysis", href: "/features/article-analysis", description: "Analyze web articles and blog posts" },
        { title: "Content Library", href: "/features/library", description: "Save and organize all your analyses" },
      ]}
    />
  )
}

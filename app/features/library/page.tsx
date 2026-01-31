import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

export const metadata: Metadata = {
  title: "Personal Content Library & Search | Clarus",
  description:
    "Save every analysis to a searchable personal library. Tag, filter, and find your analyzed content instantly with full-text search.",
  openGraph: {
    title: "Personal Content Library & Search | Clarus",
    description:
      "Save every analysis to a searchable personal library. Tag, filter, and find content instantly.",
  },
}

export default function LibraryPage() {
  return (
    <FeaturePage
      badge="Core Feature"
      title="Your Content Library"
      subtitle="A searchable archive of everything you've analyzed. Never lose an insight."
      description="Every piece of content you analyze on Clarus is saved to your personal library. Search across titles, URLs, and content with full-text search. Filter by content type (YouTube, articles, PDFs, X posts), tags, and quality scores. Your library grows into a curated knowledge base of vetted, analyzed content that you can reference anytime."
      steps={[
        {
          number: "1",
          title: "Analyze content",
          description: "Every URL you submit is automatically saved to your library along with the full AI analysis.",
        },
        {
          number: "2",
          title: "Organize with tags",
          description: "Add custom tags to categorize your analyses. Filter by tag to find related content quickly.",
        },
        {
          number: "3",
          title: "Search and find",
          description: "Full-text search across all your analyses. Find that specific insight you remember reading weeks ago.",
        },
      ]}
      benefits={[
        "Full-text search across all analyses",
        "Filter by content type and quality score",
        "Custom tags for organization",
        "Bookmark important analyses",
        "Hide content you no longer need",
        "Up to 5,000 items on the Pro plan",
      ]}
      relatedFeatures={[
        { title: "AI Chat", href: "/features/ai-chat", description: "Chat with any saved content" },
        { title: "Export & Share", href: "/features/export", description: "Export analyses as markdown or PDF" },
        { title: "Weekly Digest", href: "/features/weekly-digest", description: "Get weekly summaries of your analyses" },
      ]}
    />
  )
}

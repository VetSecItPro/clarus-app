import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

export const metadata: Metadata = {
  title: "Content Library — Searchable Archive of All Your Analyses | Clarus",
  description:
    "Build a personal knowledge base from everything you analyze. Full-text search, tags, quality filters, and bookmarks across videos, articles, podcasts, and PDFs.",
  keywords: [
    "content library",
    "knowledge base",
    "research library",
    "content archive",
    "searchable notes",
    "content organizer",
  ],
  openGraph: {
    title: "Content Library — Searchable Archive | Clarus",
    description:
      "Build a personal knowledge base. Full-text search, tags, and quality filters across all your analyses.",
    url: "https://clarusapp.io/features/library",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Content Library | Clarus",
    description:
      "Save every analysis to a searchable library. Tags, filters, and full-text search.",
  },
  alternates: {
    canonical: "https://clarusapp.io/features/library",
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

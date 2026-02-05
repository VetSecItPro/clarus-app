import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

// ISR: revalidate every hour — marketing content changes infrequently
export const revalidate = 3600

export const metadata: Metadata = {
  title: "Export & Share — Markdown, PDF & Public Links | Clarus",
  description:
    "Export AI analyses as clean markdown for Notion and Obsidian, formatted PDF for sharing, or public links anyone can view. Share insights with your team instantly.",
  keywords: [
    "export analysis",
    "markdown export",
    "pdf export",
    "share analysis",
    "content sharing",
    "notion export",
  ],
  openGraph: {
    title: "Export & Share — Markdown, PDF & Public Links | Clarus",
    description:
      "Export analyses as markdown, PDF, or shareable links. Perfect for Notion, Obsidian, and team sharing.",
    url: "https://clarusapp.io/features/export",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Export & Share | Clarus",
    description:
      "Export as markdown or PDF. Share via public links or email.",
  },
  alternates: {
    canonical: "https://clarusapp.io/features/export",
  },
}

export default function ExportPage() {
  return (
    <FeaturePage
      badge="Feature"
      title="Export & Share"
      subtitle="Take your analyses anywhere. Export as markdown, PDF, or share with a public link."
      description="Clarus gives you multiple ways to use your analyses outside the app. Export the full analysis as clean markdown — perfect for Notion, Obsidian, or any note-taking tool. Generate a formatted PDF for sharing with colleagues or archiving. Or create a public share link that lets anyone view the analysis without a Clarus account."
      steps={[
        {
          number: "1",
          title: "Run an analysis",
          description: "Analyze any content. Once the analysis is complete, export and share options are available.",
        },
        {
          number: "2",
          title: "Choose your format",
          description: "Export as markdown for note-taking tools, PDF for documents, or create a public share link.",
        },
        {
          number: "3",
          title: "Share or archive",
          description: "Send the export to colleagues, paste into your knowledge base, or save for future reference.",
        },
      ]}
      benefits={[
        "Clean markdown export for Notion, Obsidian, etc.",
        "Formatted PDF with all analysis sections",
        "Public share links — no account required to view",
        "Share via email directly from Clarus",
        "All analysis sections included in exports",
        "Available on Starter and Pro plans",
      ]}
      relatedFeatures={[
        { title: "Content Library", href: "/features/library", description: "Save and organize all your analyses" },
        { title: "AI Chat", href: "/features/ai-chat", description: "Chat with content before exporting" },
        { title: "Truth Analysis", href: "/features/truth-analysis", description: "Fact-check claims in any content" },
      ]}
    />
  )
}

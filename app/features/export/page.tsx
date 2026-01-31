import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

export const metadata: Metadata = {
  title: "Export Analyses as Markdown & PDF | Clarus",
  description:
    "Export your Clarus analyses as markdown or PDF. Share insights with your team, save to Notion, or archive for reference.",
  openGraph: {
    title: "Export Analyses as Markdown & PDF | Clarus",
    description:
      "Export your Clarus analyses as markdown or PDF. Share insights with your team.",
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

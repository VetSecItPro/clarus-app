import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

export const metadata: Metadata = {
  title: "PDF Document Analysis with AI | Clarus",
  description:
    "Upload or link to any PDF and get AI-powered analysis. Summaries, fact-checks, key takeaways, and action items from research papers, reports, and documents.",
  openGraph: {
    title: "PDF Document Analysis with AI | Clarus",
    description:
      "Upload or link to any PDF and get AI-powered analysis, summaries, and key takeaways.",
  },
}

export default function PdfAnalysisPage() {
  return (
    <FeaturePage
      badge="Content Type"
      title="PDF Document Analysis"
      subtitle="Turn dense documents into clear, structured insights."
      description="Clarus extracts text from PDF documents and applies the same six-section analysis used for articles and videos. This works for research papers, business reports, whitepapers, legal documents, and any other PDF you can link to. The AI identifies the core arguments, evaluates evidence quality, and extracts actionable recommendations — saving you from reading the full document."
      steps={[
        {
          number: "1",
          title: "Link to a PDF",
          description: "Paste a URL that points to a publicly accessible PDF. Clarus extracts the text content automatically.",
        },
        {
          number: "2",
          title: "AI breaks it down",
          description: "The full document gets analyzed for quality, accuracy, key findings, and actionable takeaways.",
        },
        {
          number: "3",
          title: "Chat with the document",
          description: "Ask specific questions about the PDF content and get answers with context from the document.",
        },
      ]}
      benefits={[
        "Full text extraction from PDF documents",
        "Quality and credibility assessment",
        "Key findings and conclusions extracted",
        "Action items from reports and papers",
        "Chat with the document for specific questions",
        "Save to your library for future reference",
      ]}
      relatedFeatures={[
        { title: "Article Analysis", href: "/features/article-analysis", description: "Analyze web articles and blog posts" },
        { title: "Content Library", href: "/features/library", description: "Save and search all your analyses" },
        { title: "Export & Share", href: "/features/export", description: "Export analyses as markdown or PDF" },
      ]}
    />
  )
}

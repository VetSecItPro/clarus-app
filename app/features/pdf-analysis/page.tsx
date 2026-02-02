import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

export const metadata: Metadata = {
  title: "PDF Summarizer — AI Analysis for Documents & Research Papers | Clarus",
  description:
    "Summarize any PDF with AI. Get key findings, fact-checks, and action items from research papers, reports, whitepapers, and legal documents. Free PDF summarizer and analyzer.",
  keywords: [
    "pdf summarizer",
    "pdf summary tool",
    "ai pdf analyzer",
    "research paper summarizer",
    "document summary",
    "pdf key takeaways",
    "summarize pdf",
  ],
  openGraph: {
    title: "PDF Summarizer — AI Analysis for Documents | Clarus",
    description:
      "Summarize any PDF with AI. Key findings, fact-checks, and action items from research papers and reports.",
    url: "https://clarusapp.io/features/pdf-analysis",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF Summarizer | Clarus",
    description:
      "Link any PDF, get key findings, fact-checks, and action items. Free to start.",
  },
  alternates: {
    canonical: "https://clarusapp.io/features/pdf-analysis",
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

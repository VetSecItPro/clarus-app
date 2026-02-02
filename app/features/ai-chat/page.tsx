import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

export const metadata: Metadata = {
  title: "Chat with Any Content — AI Q&A for Videos, Articles & PDFs | Clarus",
  description:
    "Ask questions about any YouTube video, article, podcast, or PDF after analysis. Get AI-powered answers grounded in the original content with web search for additional context.",
  keywords: [
    "chat with content",
    "ai content chat",
    "ask questions about video",
    "chat with article",
    "ai research assistant",
    "content q&a",
  ],
  openGraph: {
    title: "Chat with Any Content — AI Q&A | Clarus",
    description:
      "Ask questions about any video, article, or PDF. Get AI answers grounded in the original content.",
    url: "https://clarusapp.io/features/ai-chat",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chat with Any Content | Clarus",
    description:
      "Ask follow-up questions about any analyzed content. AI answers with context and citations.",
  },
  alternates: {
    canonical: "https://clarusapp.io/features/ai-chat",
  },
}

export default function AiChatPage() {
  return (
    <FeaturePage
      badge="Core Feature"
      title="Chat with Any Content"
      subtitle="Ask questions about what you've analyzed and get answers grounded in the actual content."
      description="After Clarus analyzes a piece of content, you can start a conversation about it. Ask clarifying questions, request deeper analysis on specific points, or explore implications the original analysis didn't cover. The AI has full context of the original content, the analysis, and optionally searches the web for additional information to give you comprehensive answers."
      steps={[
        {
          number: "1",
          title: "Analyze content first",
          description: "Submit any URL for analysis. Once the analysis is complete, the chat interface appears alongside it.",
        },
        {
          number: "2",
          title: "Ask anything",
          description: "Type a question about the content. The AI uses the full text, analysis, and optionally web search to answer.",
        },
        {
          number: "3",
          title: "Go deeper",
          description: "Follow up with more questions. The conversation context is maintained, so each answer builds on the previous ones.",
        },
      ]}
      benefits={[
        "Full context of original content and analysis",
        "Optional web search for additional information",
        "Conversational follow-ups that build on context",
        "Works with all content types (videos, articles, PDFs)",
        "Split-screen view alongside the analysis",
        "Chat history saved per content item",
      ]}
      relatedFeatures={[
        { title: "Truth Analysis", href: "/features/truth-analysis", description: "Fact-check claims from any content" },
        { title: "YouTube Analysis", href: "/features/youtube-analysis", description: "Analyze any YouTube video" },
        { title: "Content Library", href: "/features/library", description: "Access all your analyses and chats" },
      ]}
    />
  )
}

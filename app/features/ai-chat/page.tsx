import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

export const metadata: Metadata = {
  title: "Chat with Any Content Using AI | Clarus",
  description:
    "Ask questions about articles, videos, and PDFs you've analyzed. Get AI-powered answers with context and citations from the original content.",
  openGraph: {
    title: "Chat with Any Content Using AI | Clarus",
    description:
      "Ask questions about articles, videos, and PDFs with AI. Get answers with citations from the original content.",
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

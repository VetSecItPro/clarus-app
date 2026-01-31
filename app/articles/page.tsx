import type { Metadata } from "next"
import { blogArticles, getFeaturedArticles } from "@/lib/data/blog-articles"
import { ArticlesPageClient } from "./ArticlesPageClient"

export const metadata: Metadata = {
  title: "Articles — AI Content Analysis, Fact-Checking & Media Literacy | Clarus",
  description:
    "Read articles about AI content analysis, fact-checking, media literacy, and smarter content consumption. Learn how to evaluate what you read, watch, and listen to.",
  keywords: [
    "content analysis articles",
    "fact-checking guide",
    "media literacy",
    "AI content tools",
    "content quality",
  ],
  openGraph: {
    title: "Articles — AI Content Analysis & Media Literacy | Clarus",
    description:
      "Articles about AI content analysis, fact-checking, and smarter content consumption.",
    url: "https://clarusapp.io/articles",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Articles — AI Content Analysis & Media Literacy | Clarus",
    description:
      "Articles about AI content analysis, fact-checking, and smarter content consumption.",
  },
  alternates: {
    canonical: "https://clarusapp.io/articles",
  },
}

export default function ArticlesPage() {
  const featured = getFeaturedArticles()

  return (
    <ArticlesPageClient
      articles={blogArticles}
      featuredArticles={featured}
    />
  )
}

import type { MetadataRoute } from "next"

const BASE_URL = "https://clarusapp.io"

// Static articles from the blog
const ARTICLE_SLUGS = [
  "why-most-people-miss-the-point-of-long-youtube-videos",
  "5-signs-youre-consuming-low-quality-content-online",
  "the-rise-of-podcast-analysis",
  "how-ai-helps-you-read-smarter-not-harder",
  "why-content-summaries-beat-bookmarking",
  "ai-fact-checking-explained",
  "how-to-extract-action-items-from-any-article",
  "youtube-video-analysis-complete-guide",
  "pdf-analysis-for-professionals",
  "content-overload-solution",
  "why-truth-checking-matters-more-than-ever",
  "building-a-personal-knowledge-base",
  "ai-content-analysis-vs-manual-note-taking",
  "weekly-digest-productivity-hack",
  "from-passive-consumer-to-active-learner",
]

const FEATURE_PAGES = [
  "ai-chat",
  "article-analysis",
  "export",
  "library",
  "pdf-analysis",
  "truth-analysis",
  "weekly-digest",
  "youtube-analysis",
]

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/features`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/articles`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ]

  const featurePages: MetadataRoute.Sitemap = FEATURE_PAGES.map((slug) => ({
    url: `${BASE_URL}/features/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }))

  const articlePages: MetadataRoute.Sitemap = ARTICLE_SLUGS.map((slug) => ({
    url: `${BASE_URL}/articles/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }))

  return [...staticPages, ...featurePages, ...articlePages]
}

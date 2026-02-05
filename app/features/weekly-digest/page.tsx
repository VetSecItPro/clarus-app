import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

// ISR: revalidate every hour — marketing content changes infrequently
export const revalidate = 3600

export const metadata: Metadata = {
  title: "Weekly Digest — Personal Recap & Trending Content | Clarus",
  description:
    "Receive a weekly email with your top analyses ranked by quality score plus trending content curated anonymously from across Clarus. Stay informed without opening the app.",
  keywords: [
    "weekly digest",
    "content newsletter",
    "trending content",
    "analysis recap",
    "content discovery",
    "curated content",
  ],
  openGraph: {
    title: "Weekly Digest — Personal Recap & Trending Content | Clarus",
    description:
      "Weekly email with your top analyses plus trending content curated from across Clarus.",
    url: "https://clarusapp.io/features/weekly-digest",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Weekly Digest | Clarus",
    description:
      "Your top analyses plus trending content — delivered weekly.",
  },
  alternates: {
    canonical: "https://clarusapp.io/features/weekly-digest",
  },
}

export default function WeeklyDigestPage() {
  return (
    <FeaturePage
      badge="Feature"
      title="Weekly Digest & Discovery"
      subtitle="Your personal analysis recap plus the most interesting content from across Clarus — delivered weekly."
      description="Every Sunday, Clarus sends you a digest of your top analyses from the week along with a curated selection of trending content analyzed by other users. The discovery section is completely anonymous — no user attribution, just great content and AI-powered insights. Think of it as a Flipboard for people who care about truth and substance."
      steps={[
        {
          number: "1",
          title: "Opt in",
          description: "Weekly digests are enabled by default. You can toggle the setting on or off in your account preferences.",
        },
        {
          number: "2",
          title: "Analyze content",
          description: "Throughout the week, analyze content as usual. Your top analyses by quality score are featured in your digest.",
        },
        {
          number: "3",
          title: "Discover new content",
          description: "The trending section surfaces the best publicly shared analyses — a curated feed of vetted content and insights.",
        },
      ]}
      benefits={[
        "Personal weekly recap of your top analyses",
        "Trending content curated from across Clarus",
        "Zero user attribution — completely anonymous curation",
        "Quality-scored ranking (best content surfaces first)",
        "One-click access to full analyses",
        "Easy opt-out in settings",
      ]}
      relatedFeatures={[
        { title: "Content Library", href: "/features/library", description: "Browse all your saved analyses" },
        { title: "Export & Share", href: "/features/export", description: "Export or share analyses publicly" },
        { title: "Truth Analysis", href: "/features/truth-analysis", description: "Fact-check claims from any content" },
      ]}
    />
  )
}

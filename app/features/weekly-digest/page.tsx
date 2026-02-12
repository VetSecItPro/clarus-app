import type { Metadata } from "next"
import { FeaturePage } from "@/components/features/feature-page"

// ISR: revalidate every hour — marketing content changes infrequently
export const revalidate = 3600

export const metadata: Metadata = {
  title: "Weekly Digest — Personal Analysis Recap | Clarus",
  description:
    "Receive a weekly email with your top analyses ranked by quality score. Stay informed without opening the app.",
  keywords: [
    "weekly digest",
    "content newsletter",
    "analysis recap",
    "curated content",
  ],
  openGraph: {
    title: "Weekly Digest — Personal Analysis Recap | Clarus",
    description:
      "Weekly email with your top analyses delivered every Sunday.",
    url: "https://clarusapp.io/features/weekly-digest",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Weekly Digest | Clarus",
    description:
      "Your top analyses — delivered weekly.",
  },
  alternates: {
    canonical: "https://clarusapp.io/features/weekly-digest",
  },
}

export default function WeeklyDigestPage() {
  return (
    <FeaturePage
      badge="Feature"
      title="Weekly Digest"
      subtitle="Your personal analysis recap — delivered every Sunday."
      description="Every Sunday, Clarus sends you a digest of your top analyses from the week. See which content scored highest, revisit key insights, and stay on top of your learning without opening the app."
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
          title: "Review your recap",
          description: "Every Sunday, get an email with your best analyses ranked by quality score — one click to revisit any insight.",
        },
      ]}
      benefits={[
        "Personal weekly recap of your top analyses",
        "Quality-scored ranking (best content surfaces first)",
        "One-click access to full analyses",
        "Easy opt-out in settings",
      ]}
      relatedFeatures={[
        { title: "Content Library", href: "/features/library", description: "Browse all your saved analyses" },
        { title: "Export & Share", href: "/features/export", description: "Export or share analyses" },
        { title: "Truth Analysis", href: "/features/truth-analysis", description: "Fact-check claims from any content" },
      ]}
    />
  )
}

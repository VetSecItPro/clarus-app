import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pricing — Free, Starter & Pro Plans | Clarus",
  description:
    "Analyze YouTube videos, podcasts, articles, and PDFs with AI. Free plan with 5 analyses/month. Starter at $18/mo or Pro at $29/mo. Day Pass available for $10.",
  keywords: [
    "youtube summarizer pricing",
    "ai content analysis pricing",
    "podcast analyzer cost",
    "article summarizer plans",
    "clarus pricing",
  ],
  openGraph: {
    title: "Pricing — Free, Starter & Pro Plans | Clarus",
    description:
      "Free plan with 5 analyses/month. Starter at $18/mo or Pro at $29/mo. Analyze videos, podcasts, articles, and PDFs.",
    url: "https://clarusapp.io/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Free, Starter & Pro Plans | Clarus",
    description:
      "Free plan with 5 analyses/month. Starter at $18/mo, Pro at $29/mo, or Day Pass for $10.",
  },
  alternates: {
    canonical: "https://clarusapp.io/pricing",
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}

// FIX-FE-010: Add metadata for SEO — pricing page split into server wrapper + client component
// ISR: revalidate every hour — pricing rarely changes
export const revalidate = 3600

import type { Metadata } from "next"
import PricingPageClient from "./pricing-page-client"

export const metadata: Metadata = {
  title: "Pricing | Clarus",
  description:
    "Compare Clarus plans for AI-powered content analysis. Free, Starter, and Pro tiers with transparent pricing. No hidden fees, cancel anytime.",
}

export default function PricingPage() {
  return <PricingPageClient />
}

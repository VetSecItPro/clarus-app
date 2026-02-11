"use client"

import dynamic from "next/dynamic"
import { LandingHeader } from "./landing-header"
import { HeroSection } from "./hero-section"
import { SocialProofBar } from "./social-proof-bar"
import { WorksWithBar } from "./works-with-bar"
import { LandingFooter } from "./landing-footer"
import { StickyMobileCTA } from "./sticky-mobile-cta"
import { InlineCTA } from "./inline-cta"
import { TestimonialSection } from "./testimonial-section"
import { ScrollToTop } from "./scroll-to-top"

// PERF: Dynamic import heavy components (ssr: false) to reduce initial bundle
// ProductPreview (491 lines) and DemoAnalysis (567 lines) are the heaviest
const ProductPreview = dynamic(() => import("./product-preview").then(m => ({ default: m.ProductPreview })), { ssr: false })
const DemoAnalysis = dynamic(() => import("./demo-analysis").then(m => ({ default: m.DemoAnalysis })), {
  ssr: false,
  loading: () => (
    <div className="py-16 sm:py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="h-8 w-48 bg-white/[0.04] rounded-lg mx-auto mb-4 animate-pulse" />
        <div className="h-6 w-72 bg-white/[0.03] rounded-lg mx-auto mb-10 animate-pulse" />
        <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] min-h-[520px] animate-pulse" />
      </div>
    </div>
  ),
})

// SEO: Enable SSR for lightweight below-fold sections (renders in server HTML for crawlers)
const HowItWorks = dynamic(() => import("./how-it-works").then(m => ({ default: m.HowItWorks })))
const FeatureGrid = dynamic(() => import("./feature-grid").then(m => ({ default: m.FeatureGrid })))
const BeforeYouPlay = dynamic(() => import("./before-you-play").then(m => ({ default: m.BeforeYouPlay })))
const AudienceSection = dynamic(() => import("./audience-section").then(m => ({ default: m.AudienceSection })))
const CTASection = dynamic(() => import("./cta-section").then(m => ({ default: m.CTASection })))

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <LandingHeader />

      <main className="pt-16 pb-20 md:pb-0 flex-1">
        <HeroSection />
        <ProductPreview />
        <SocialProofBar />
        <HowItWorks />
        <InlineCTA variant="primary" />
        <WorksWithBar />
        <DemoAnalysis />
        <FeatureGrid />
        <InlineCTA variant="secondary" />
        <BeforeYouPlay />
        <InlineCTA variant="primary" />
        <AudienceSection />
        <TestimonialSection />
        <CTASection />
      </main>

      <LandingFooter />
      <StickyMobileCTA />
      <ScrollToTop />
    </div>
  )
}

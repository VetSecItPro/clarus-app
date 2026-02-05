"use client"

import dynamic from "next/dynamic"
import { LandingHeader } from "./landing-header"
import { HeroSection } from "./hero-section"
import { SocialProofBar } from "./social-proof-bar"
import { LandingFooter } from "./landing-footer"

// PERF: Dynamic import below-fold landing sections to reduce initial bundle
// ProductPreview (491 lines) and DemoAnalysis (567 lines) are the heaviest
const ProductPreview = dynamic(() => import("./product-preview").then(m => ({ default: m.ProductPreview })), { ssr: false })
const HowItWorks = dynamic(() => import("./how-it-works").then(m => ({ default: m.HowItWorks })), { ssr: false })
const DemoAnalysis = dynamic(() => import("./demo-analysis").then(m => ({ default: m.DemoAnalysis })), { ssr: false })
const FeatureGrid = dynamic(() => import("./feature-grid").then(m => ({ default: m.FeatureGrid })), { ssr: false })
const AudienceSection = dynamic(() => import("./audience-section").then(m => ({ default: m.AudienceSection })), { ssr: false })
const CTASection = dynamic(() => import("./cta-section").then(m => ({ default: m.CTASection })), { ssr: false })

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <LandingHeader />

      <main className="pt-16 flex-1">
        <HeroSection />
        <ProductPreview />
        <SocialProofBar />
        <HowItWorks />
        <DemoAnalysis />
        <FeatureGrid />
        <AudienceSection />
        <CTASection />
      </main>

      <LandingFooter />
    </div>
  )
}

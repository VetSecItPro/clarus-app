"use client"

import { LandingHeader } from "./landing-header"
import { HeroSection } from "./hero-section"
import { FeatureGrid } from "./feature-grid"
import { SocialProof } from "./social-proof"
import { CTASection } from "./cta-section"
import SiteFooter from "@/components/site-footer"

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      <LandingHeader />

      <main className="pt-16">
        <HeroSection />
        <FeatureGrid />
        <SocialProof />
        <CTASection />
      </main>

      <SiteFooter />
    </div>
  )
}

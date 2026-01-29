"use client"

import { LandingHeader } from "./landing-header"
import { HeroSection } from "./hero-section"
import { FeatureGrid } from "./feature-grid"
import { SocialProof } from "./social-proof"
import { CTASection } from "./cta-section"
import { LandingFooter } from "./landing-footer"

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <LandingHeader />

      <main className="pt-16 flex-1">
        <HeroSection />
        <FeatureGrid />
        <SocialProof />
        <CTASection />
      </main>

      <LandingFooter />
    </div>
  )
}

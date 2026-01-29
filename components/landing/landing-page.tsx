"use client"

import { LandingHeader } from "./landing-header"
import { HeroSection } from "./hero-section"
import { HowItWorks } from "./how-it-works"
import { FeatureGrid } from "./feature-grid"
import { CTASection } from "./cta-section"
import { LandingFooter } from "./landing-footer"

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <LandingHeader />

      <main className="pt-16 flex-1">
        <HeroSection />
        <HowItWorks />
        <FeatureGrid />
        <CTASection />
      </main>

      <LandingFooter />
    </div>
  )
}

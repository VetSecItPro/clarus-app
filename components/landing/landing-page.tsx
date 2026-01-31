"use client"

import { LandingHeader } from "./landing-header"
import { HeroSection } from "./hero-section"
import { SocialProofBar } from "./social-proof-bar"
import { HowItWorks } from "./how-it-works"
import { FeatureGrid } from "./feature-grid"
import { AudienceSection } from "./audience-section"
import { CTASection } from "./cta-section"
import { LandingFooter } from "./landing-footer"
import { StickyCTA } from "./sticky-cta"

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <LandingHeader />

      <main className="pt-16 flex-1">
        <HeroSection />
        <SocialProofBar />
        <HowItWorks />
        <FeatureGrid />
        <AudienceSection />
        <CTASection />
      </main>

      <LandingFooter />
      <StickyCTA />
    </div>
  )
}

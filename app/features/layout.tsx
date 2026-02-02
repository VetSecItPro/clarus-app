import { PublicHeader } from "@/components/public-header"
import { LandingFooter } from "@/components/landing/landing-footer"

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <LandingFooter />
    </div>
  )
}

import SiteHeader from "@/components/site-header"
import MobileBottomNav from "@/components/mobile-bottom-nav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <MobileBottomNav />
    </>
  )
}

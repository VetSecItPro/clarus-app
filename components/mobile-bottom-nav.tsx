"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Clock, Rss } from "lucide-react"
import { cn } from "@/lib/utils"
import GlasmorphicSettingsButton from "@/components/glassmorphic-settings-button"
import { ActiveAnalysisNavLink } from "@/components/active-analysis-nav-link"
import { useState } from "react"
import { getCachedSession } from "@/components/with-auth"
import { TIER_FEATURES } from "@/lib/tier-limits"
// PERF: use shared SWR hook instead of independent Supabase query for tier data
import { useUserTier } from "@/lib/hooks/use-user-tier"

const baseNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Clock },
]

const feedsNavItem = { href: "/feeds", label: "Feeds", icon: Rss }

export default function MobileBottomNav() {
  const pathname = usePathname()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // PERF: shared SWR hook eliminates duplicate tier query (was independent useEffect+fetch)
  const { session } = getCachedSession()
  const { tier: userTier } = useUserTier(session?.user?.id ?? null)

  // Hide on auth pages
  if (pathname?.startsWith("/login") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password")) {
    return null
  }

  const showFeeds = TIER_FEATURES[userTier].podcastSubscriptions || TIER_FEATURES[userTier].youtubeSubscriptions
  const navItems = showFeeds ? [...baseNavItems, feedsNavItem] : baseNavItems

  return (
    <nav className="fixed left-0 right-0 z-50 bg-black/95 backdrop-blur-2xl border-t border-white/[0.06] rounded-t-2xl sm:hidden fixed-bottom-safe select-none">
      <div className="flex items-center justify-around h-[60px]">
        {navItems.map((item, index) => {
          // Only show as active if Settings dropdown is NOT open
          const isActive = (pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))) && !settingsOpen
          const Icon = item.icon
          return (
            <span key={item.label} className="contents">
              <Link
                href={item.href}
                prefetch={true}
                className="relative flex flex-col items-center justify-center flex-1 h-full group"
              >
                <div className={cn(
                  "flex flex-col items-center transition-all duration-200",
                  isActive ? "text-brand" : "text-white/50 group-active:text-white/70"
                )}>
                  <Icon className={cn(
                    "w-6 h-6 transition-transform duration-200",
                    isActive && "scale-110"
                  )} />
                  <span className={cn(
                    "text-[0.6875rem] mt-1 font-medium transition-opacity duration-200",
                    isActive ? "opacity-100" : "opacity-70"
                  )}>{item.label}</span>
                </div>
                {/* Active indicator dot */}
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand" />
                )}
              </Link>
              {/* Active analysis link between Home and Library */}
              {index === 0 && <ActiveAnalysisNavLink variant="mobile" />}
            </span>
          )
        })}
        {/* Settings - embedded dropdown */}
        <div className="flex flex-col items-center justify-center flex-1 h-full">
          <GlasmorphicSettingsButton variant="mobile" onOpenChange={setSettingsOpen} />
        </div>
      </div>
    </nav>
  )
}

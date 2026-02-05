"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Clock, Compass, Podcast } from "lucide-react"
import { cn } from "@/lib/utils"
import GlasmorphicSettingsButton from "@/components/glassmorphic-settings-button"
import { ActiveAnalysisNavLink } from "@/components/active-analysis-nav-link"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { getCachedSession } from "@/components/with-auth"
import { normalizeTier, TIER_FEATURES } from "@/lib/tier-limits"
import type { UserTier } from "@/types/database.types"

const baseNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Clock },
  { href: "/discover", label: "Discover", icon: Compass },
]

const podcastNavItem = { href: "/podcasts", label: "Podcasts", icon: Podcast }

export default function MobileBottomNav() {
  const pathname = usePathname()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [userTier, setUserTier] = useState<UserTier | null>(null)

  useEffect(() => {
    const fetchTier = async () => {
      const { session } = getCachedSession()
      const userId = session?.user?.id
      if (!userId) {
        const { data: { session: freshSession } } = await supabase.auth.getSession()
        if (!freshSession?.user) return
        const { data } = await supabase
          .from("users")
          .select("tier, day_pass_expires_at")
          .eq("id", freshSession.user.id)
          .single()
        if (data) setUserTier(normalizeTier(data.tier, data.day_pass_expires_at))
        return
      }
      const { data } = await supabase
        .from("users")
        .select("tier, day_pass_expires_at")
        .eq("id", userId)
        .single()
      if (data) setUserTier(normalizeTier(data.tier, data.day_pass_expires_at))
    }
    fetchTier()
  }, [])

  // Hide on auth pages
  if (pathname?.startsWith("/login") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password")) {
    return null
  }

  const showPodcasts = userTier ? TIER_FEATURES[userTier].podcastSubscriptions : false
  const navItems = showPodcasts ? [...baseNavItems, podcastNavItem] : baseNavItems

  return (
    <nav className="fixed left-0 right-0 z-50 bg-black/95 backdrop-blur-2xl border-t border-white/[0.06] rounded-t-2xl sm:hidden fixed-bottom-safe">
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
                  isActive ? "text-[#1d9bf0]" : "text-white/40 group-active:text-white/70"
                )}>
                  <Icon className={cn(
                    "w-6 h-6 transition-transform duration-200",
                    isActive && "scale-110"
                  )} />
                  <span className={cn(
                    "text-[11px] mt-1 font-medium transition-opacity duration-200",
                    isActive ? "opacity-100" : "opacity-70"
                  )}>{item.label}</span>
                </div>
                {/* Active indicator dot */}
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1d9bf0]" />
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

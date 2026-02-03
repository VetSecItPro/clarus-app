"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Home, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import GlasmorphicSettingsButton from "@/components/glassmorphic-settings-button"
import { supabase } from "@/lib/supabase"
import { getCachedSession } from "@/components/with-auth"
import { normalizeTier } from "@/lib/tier-limits"
import { InstantTooltip } from "@/components/ui/tooltip"
import { ActiveAnalysisNavLink } from "@/components/active-analysis-nav-link"
import type { UserTier } from "@/types/database.types"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Clock },
]

const TIER_BADGE_CONFIG: Record<UserTier, { label: string; bg: string; text: string; border: string } | null> = {
  free: { label: "Free", bg: "bg-white/[0.06]", text: "text-white/50", border: "border-white/[0.08]" },
  starter: { label: "Starter", bg: "bg-[#1d9bf0]/10", text: "text-[#1d9bf0]", border: "border-[#1d9bf0]/20" },
  pro: { label: "Pro", bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
  day_pass: { label: "Day Pass", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
}

interface SiteHeaderProps {
  showNav?: boolean
  showSettings?: boolean
}

export default function SiteHeader({ showNav = true, showSettings = true }: SiteHeaderProps) {
  const pathname = usePathname()
  const [userTier, setUserTier] = useState<UserTier | null>(null)

  useEffect(() => {
    const fetchTier = async () => {
      const { session } = getCachedSession()
      if (!session?.user) {
        // Try getting session directly if cache isn't ready
        const { data: { session: freshSession } } = await supabase.auth.getSession()
        if (!freshSession?.user) return

        const { data } = await supabase
          .from("users")
          .select("tier, day_pass_expires_at")
          .eq("id", freshSession.user.id)
          .single()

        if (data) {
          setUserTier(normalizeTier(data.tier, data.day_pass_expires_at))
        }
        return
      }

      const { data } = await supabase
        .from("users")
        .select("tier, day_pass_expires_at")
        .eq("id", session.user.id)
        .single()

      if (data) {
        setUserTier(normalizeTier(data.tier, data.day_pass_expires_at))
      }
    }
    fetchTier()
  }, [])

  const badgeConfig = userTier ? TIER_BADGE_CONFIG[userTier] : null

  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/[0.06] hidden sm:block">
      <div className="px-4 lg:px-6">
        <div className="relative flex items-center h-14">
          {/* Logo/Brand - pushed to left */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <Image
                src="/clarus-logo.webp"
                alt="Clarus"
                width={40}
                height={40}
                className="w-10 h-10 transition-all duration-300 group-hover:scale-105"
              />
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-[#1d9bf0]/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-white/90 font-bold text-3xl italic tracking-wide group-hover:text-white transition-colors duration-200" style={{ fontFamily: 'var(--font-cormorant)' }}>
              Clarus
            </span>
          </Link>

          {/* Tier badge */}
          {badgeConfig && (
            <InstantTooltip content="View plans">
              <Link
                href="/pricing"
                className={cn(
                  "ml-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border transition-opacity hover:opacity-80",
                  badgeConfig.bg,
                  badgeConfig.text,
                  badgeConfig.border
                )}
              >
                {badgeConfig.label}
              </Link>
            </InstantTooltip>
          )}

          {/* Navigation - absolutely centered */}
          {showNav && (
            <nav className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-1">
              {navItems.map((item, index) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <span key={item.label} className="contents">
                    <Link
                      href={item.href}
                      prefetch={true}
                      className="relative px-4 py-2 group"
                    >
                      <div className={cn(
                        "flex items-center gap-2 transition-all duration-200",
                        isActive ? "text-white" : "text-white/50 group-hover:text-white/90"
                      )}>
                        <Icon className={cn(
                          "w-4 h-4 transition-colors duration-200",
                          isActive ? "text-[#1d9bf0]" : "group-hover:text-[#1d9bf0]/70"
                        )} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      {/* Animated underline */}
                      <div className={cn(
                        "absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-gradient-to-r from-[#1d9bf0] to-[#06b6d4] rounded-full transition-all duration-300",
                        isActive ? "w-8 opacity-100" : "w-0 opacity-0 group-hover:w-6 group-hover:opacity-60"
                      )} />
                    </Link>
                    {/* Active analysis link between Home and Library */}
                    {index === 0 && <ActiveAnalysisNavLink variant="desktop" />}
                  </span>
                )
              })}
            </nav>
          )}

          {/* Settings - pushed to right */}
          {showSettings && (
            <div className="ml-auto flex items-center">
              <GlasmorphicSettingsButton />
            </div>
          )}

          {/* Spacer when no settings */}
          {!showSettings && <div className="ml-auto w-10" />}
        </div>
      </div>
    </header>
  )
}

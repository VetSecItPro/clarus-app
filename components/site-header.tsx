"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield, Home, Clock, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import GlasmorphicSettingsButton from "@/components/glassmorphic-settings-button"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Clock },
  { href: "/feed", label: "Community", icon: Users },
]

interface SiteHeaderProps {
  showNav?: boolean
  showSettings?: boolean
}

export default function SiteHeader({ showNav = true, showSettings = true }: SiteHeaderProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/[0.06] hidden sm:block">
      <div className="max-w-6xl mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo/Brand - minimal and elegant */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-[#1d9bf0] via-[#0ea5e9] to-[#06b6d4] rounded-lg flex items-center justify-center shadow-lg shadow-[#1d9bf0]/25 group-hover:shadow-[#1d9bf0]/40 transition-all duration-300 group-hover:scale-105">
                <Shield className="w-4 h-4 text-white" />
              </div>
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-[#1d9bf0]/20 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-white/90 font-medium text-[15px] tracking-tight group-hover:text-white transition-colors duration-200">
              Truth Checker
            </span>
          </Link>

          {/* Navigation - centered, minimal with underline effect */}
          {showNav && (
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.label}
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
                )
              })}
            </nav>
          )}

          {/* Settings - refined */}
          {showSettings && (
            <div className="flex items-center">
              <GlasmorphicSettingsButton />
            </div>
          )}

          {/* Spacer when no settings */}
          {!showSettings && <div className="w-10" />}
        </div>
      </div>
    </header>
  )
}

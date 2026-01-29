"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Home, Clock, Users } from "lucide-react"
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
              <Image
                src="/clarus-logo.png"
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

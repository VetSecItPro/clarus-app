"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Clock, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import GlasmorphicSettingsButton from "@/components/glassmorphic-settings-button"
import { useState } from "react"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Clock },
  { href: "/feed", label: "Community", icon: Users },
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Hide on auth pages
  if (pathname?.startsWith("/login") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password")) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-2xl border-t border-white/[0.06] sm:hidden safe-area-pb">
      <div className="flex items-center justify-around h-[64px]">
        {navItems.map((item) => {
          // Only show as active if Settings dropdown is NOT open
          const isActive = pathname === item.href && !settingsOpen
          const Icon = item.icon
          return (
            <Link
              key={item.label}
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

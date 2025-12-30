"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Clock, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import GlasmorphicSettingsButton from "@/components/glassmorphic-settings-button"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Clock },
  { href: "/feed", label: "Community", icon: Users },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  // Hide on auth pages
  if (pathname?.startsWith("/login") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password")) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-2xl border-t border-white/[0.06] sm:hidden safe-area-pb">
      <div className="flex items-center justify-around h-[52px]">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              className="relative flex flex-col items-center justify-center flex-1 h-full group"
            >
              <div className={cn(
                "flex flex-col items-center transition-all duration-200",
                isActive ? "text-[#1d9bf0]" : "text-white/40 group-active:text-white/70"
              )}>
                <Icon className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  isActive && "scale-110"
                )} />
                <span className={cn(
                  "text-[10px] mt-0.5 font-medium transition-opacity duration-200",
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
          <GlasmorphicSettingsButton variant="mobile" />
        </div>
      </div>
    </nav>
  )
}

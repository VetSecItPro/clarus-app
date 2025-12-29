"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Clock, Users, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Clock },
  { href: "/feed", label: "Community", icon: Users },
]

interface MobileBottomNavProps {
  onSettingsClick?: () => void
}

export default function MobileBottomNav({ onSettingsClick }: MobileBottomNavProps) {
  const pathname = usePathname()

  // Hide on auth pages
  if (pathname?.startsWith("/login") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password")) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/[0.08] sm:hidden safe-area-pb">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors",
                isActive ? "text-[#1d9bf0]" : "text-white/50"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </Link>
          )
        })}
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="flex flex-col items-center justify-center flex-1 h-full text-white/50"
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Settings</span>
          </button>
        )}
      </div>
    </nav>
  )
}

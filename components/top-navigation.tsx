"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Clock, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import BlueCheckLogo from "@/components/blue-check-logo"

const navItems = [
  { href: "/", label: "Home", icon: null, isLogo: true },
  { href: "/library", label: "Library", icon: Clock, isLogo: false },
  { href: "/feed", label: "Community", icon: Users, isLogo: false },
]

export default function TopNavigation() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link key={item.label} href={item.href}>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-white/[0.08]"
                  : "hover:bg-white/[0.04]",
              )}
            >
              {item.isLogo ? (
                <BlueCheckLogo size="sm" />
              ) : (
                item.icon && (
                  <item.icon
                    className={cn(
                      "w-5 h-5 transition-colors",
                      isActive ? "text-[#1d9bf0]" : "text-white/50"
                    )}
                  />
                )
              )}
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  isActive ? "text-white" : "text-white/50"
                )}
              >
                {item.label}
              </span>
            </div>
          </Link>
        )
      })}
    </nav>
  )
}

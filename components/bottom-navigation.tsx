"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Clock, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import BlueCheckLogo from "@/components/blue-check-logo"

const navItems = [
  { href: "/", label: "Home", icon: null, isLogo: true },
  { href: "/library", label: "History", icon: Clock, isLogo: false },
  { href: "/feed", label: "Community", icon: Users, isLogo: false },
]

export default function BottomNavigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-3rem)] max-w-md">
      <div className="flex items-center justify-around bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl px-2 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.label} href={item.href} className="flex-1">
              <div
                className={cn(
                  "relative flex flex-col items-center gap-1 py-3 px-4 rounded-3xl transition-all duration-300",
                  isActive ? "bg-white/[0.12]" : "hover:bg-white/[0.04]",
                )}
              >
                {item.isLogo ? (
                  <BlueCheckLogo size="sm" />
                ) : (
                  item.icon && (
                    <item.icon
                      className={cn("w-6 h-6 transition-colors", isActive ? "text-[#1d9bf0]" : "text-white/50")}
                    />
                  )
                )}
                <span
                  className={cn("text-[11px] font-medium transition-colors", isActive ? "text-white" : "text-white/50")}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

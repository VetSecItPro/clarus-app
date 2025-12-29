"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield, Home, Clock, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import GlasmorphicSettingsButton from "@/components/glassmorphic-settings-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const navItems = [
  { href: "/", label: "Home", icon: Home, tooltip: "Submit content for analysis" },
  { href: "/library", label: "Library", icon: Clock, tooltip: "Your analyzed content" },
  { href: "/feed", label: "Community", icon: Users, tooltip: "Public analyses from others" },
]

interface SiteHeaderProps {
  showNav?: boolean
  showSettings?: boolean
}

export default function SiteHeader({ showNav = true, showSettings = true }: SiteHeaderProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-gradient-to-br from-[#1d9bf0] to-[#1a8cd8] rounded-xl flex items-center justify-center shadow-lg shadow-[#1d9bf0]/20 group-hover:shadow-[#1d9bf0]/30 transition-shadow">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-lg hidden sm:block">
              Truth Checker
            </span>
          </Link>

          {/* Navigation - hidden on mobile (bottom nav used instead) */}
          {showNav && (
            <nav className="hidden sm:flex items-center gap-1">
              <TooltipProvider delayDuration={300}>
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Tooltip key={item.label}>
                      <TooltipTrigger asChild>
                        <Link href={item.href}>
                          <div
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200",
                              isActive
                                ? "bg-white/[0.1] text-white"
                                : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                            )}
                          >
                            <Icon className={cn("w-4 h-4", isActive && "text-[#1d9bf0]")} />
                            <span className="text-sm font-medium">{item.label}</span>
                          </div>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>{item.tooltip}</TooltipContent>
                    </Tooltip>
                  )
                })}
              </TooltipProvider>
            </nav>
          )}

          {/* Settings */}
          {showSettings && (
            <div className="flex items-center -mr-2">
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

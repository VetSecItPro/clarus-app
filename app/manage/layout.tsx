"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, LayoutDashboard, Users, FileText, DollarSign, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { AdminProvider } from "./admin-context"

const NAV_ITEMS = [
  { href: "/manage", label: "Overview", icon: LayoutDashboard },
  { href: "/manage/users", label: "Users", icon: Users },
  { href: "/manage/content", label: "Content", icon: FileText },
  { href: "/manage/costs", label: "Costs", icon: DollarSign },
  { href: "/manage/health", label: "Health", icon: Activity },
]

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AdminProvider>
      <div className="min-h-screen bg-black">
        {/* Header */}
        <header className="border-b border-white/[0.06] bg-black/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {/* Top row */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="text-sm hidden sm:inline">Back to App</span>
                </Link>
                <div className="h-6 w-px bg-white/10 hidden sm:block" />
                <h1 className="text-lg font-semibold text-white">Admin</h1>
              </div>
            </div>

            {/* Tab navigation */}
            <nav className="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-hide">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/manage"
                    ? pathname === "/manage"
                    : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1 focus-visible:ring-offset-black focus-visible:outline-none active:opacity-80",
                      isActive
                        ? "border-brand text-white"
                        : "border-transparent text-white/50 hover:text-white/70 hover:border-white/20"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </AdminProvider>
  )
}

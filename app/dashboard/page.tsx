"use client"

import { useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import dynamic from "next/dynamic"
import {
  BarChart3, SlidersHorizontal, Zap, Mic, MessageSquare,
  Library, Share2, Bookmark, FileDown, ArrowRight, Loader2,
} from "lucide-react"
import Link from "next/link"
import withAuth, { type WithAuthInjectedProps } from "@/components/with-auth"
import SiteHeader from "@/components/site-header"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { UsageBar } from "@/components/ui/usage-bar"
import { useUsage } from "@/lib/hooks/use-usage"
import { useUserTier } from "@/lib/hooks/use-user-tier"
import { TIER_FEATURES } from "@/lib/tier-limits"
import { cn } from "@/lib/utils"

const PreferencesTab = dynamic(
  () => import("@/components/dashboard/preferences-tab").then((m) => ({ default: m.PreferencesTab })),
  { ssr: false }
)

const TIER_DISPLAY: Record<string, { label: string; color: string }> = {
  free: { label: "Free Plan", color: "text-white/50" },
  starter: { label: "Starter Plan", color: "text-[#1d9bf0]" },
  pro: { label: "Pro Plan", color: "text-violet-400" },
  day_pass: { label: "Day Pass", color: "text-amber-400" },
}

/** Usage bar configuration — maps API response keys to display labels and icons. */
const USAGE_ITEMS = [
  { key: "analyses" as const, label: "Analyses", icon: Zap },
  { key: "podcastAnalyses" as const, label: "Podcast Analyses", icon: Mic },
  { key: "chatMessages" as const, label: "Chat Messages", icon: MessageSquare },
  { key: "libraryItems" as const, label: "Library Items", icon: Library },
  { key: "exports" as const, label: "Exports", icon: FileDown },
  { key: "shareLinks" as const, label: "Share Links", icon: Share2 },
  { key: "bookmarks" as const, label: "Bookmarks", icon: Bookmark },
]

type Tab = "usage" | "preferences"

type DashboardPageProps = WithAuthInjectedProps

function DashboardPage({ session }: DashboardPageProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get("tab")
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam === "preferences" ? "preferences" : "usage"
  )
  const { data, isLoading } = useUsage()
  const { tier } = useUserTier(session?.user?.id ?? null)

  // Sync tab with URL param changes
  useEffect(() => {
    if (tabParam === "preferences") setActiveTab("preferences")
    else setActiveTab("usage")
  }, [tabParam])

  const tierDisplay = TIER_DISPLAY[tier] ?? TIER_DISPLAY.free

  const hasPreferencesAccess = TIER_FEATURES[tier]?.analysisPreferences ?? false

  // Format the period as a readable month name
  const periodLabel = data?.period
    ? new Date(data.period + "-01").toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : ""

  // Format reset date
  const resetLabel = data?.resetDate
    ? new Date(data.resetDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : ""

  const isDayPass = tier === "day_pass"

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "usage", label: "Usage", icon: BarChart3 },
    { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 sm:pb-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">
            Track your usage and customize your experience.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-white/[0.06]">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-[#1d9bf0] text-white"
                    : "border-transparent text-white/40 hover:text-white/60"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ─── Usage Tab ─── */}
        {activeTab === "usage" && (
          <div>
            {/* Period + Tier header */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between mb-6"
            >
              <div>
                <p className="text-lg font-semibold text-white">
                  {periodLabel || "This Month"}
                </p>
                {resetLabel && !isDayPass && (
                  <p className="text-xs text-white/30 mt-0.5">
                    Resets {resetLabel}
                  </p>
                )}
                {isDayPass && (
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    Expires when your day pass ends
                  </p>
                )}
              </div>
              <span className={cn("text-sm font-semibold", tierDisplay.color)}>
                {tierDisplay.label}
              </span>
            </motion.div>

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            )}

            {/* Usage bars */}
            {data && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5"
              >
                {USAGE_ITEMS.map((item, index) => {
                  const entry = data.usage[item.key]
                  return (
                    <motion.div
                      key={item.key}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <UsageBar
                        label={item.label}
                        used={entry.used}
                        limit={entry.limit}
                        icon={item.icon}
                      />
                    </motion.div>
                  )
                })}
              </motion.div>
            )}

            {/* Upgrade CTA for non-Pro users */}
            {data && tier !== "pro" && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Need more?</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      Upgrade your plan for higher limits and more features.
                    </p>
                  </div>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white text-sm font-medium transition-colors"
                  >
                    Upgrade
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ─── Preferences Tab ─── */}
        {activeTab === "preferences" && (
          <PreferencesTab hasAccess={hasPreferencesAccess} />
        )}
      </main>

      <MobileBottomNav />
    </div>
  )
}

export default withAuth(DashboardPage)

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Settings, LogOut, Loader2, Sparkles, UserIcon, CreditCard, Bookmark, FileText, Shield, LayoutDashboard, BarChart3, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { EditAIPromptsModal } from "@/components/edit-ai-prompts-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabase"
import { clearAuthCache, getCachedSession } from "@/components/with-auth"
import { prefetchAdminMetrics } from "@/hooks/use-admin-metrics"
// PERF: use shared SWR hook instead of independent Supabase query for user data
import { useUserTier } from "@/lib/hooks/use-user-tier"
import { TIER_FEATURES } from "@/lib/tier-limits"
import type { User } from "@supabase/supabase-js"

interface GlasmorphicSettingsButtonProps {
  variant?: "default" | "mobile"
  onOpenChange?: (open: boolean) => void
}

export default function GlasmorphicSettingsButton({ variant = "default", onOpenChange }: GlasmorphicSettingsButtonProps) {
  const [isEditPromptModalOpen, setIsEditPromptModalOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()

  const [managingSubscription, setManagingSubscription] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // PERF: shared SWR hook eliminates duplicate query for subscription_status + is_admin
  const { session: cachedSession } = getCachedSession()
  const { tier: userTier, isAdmin, subscriptionStatus } = useUserTier(cachedSession?.user?.id ?? null)

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    fetchUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setLoading(false)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      // Clear in-memory auth cache first
      clearAuthCache()

      // Clear localStorage/sessionStorage items
      if (typeof window !== "undefined") {
        localStorage.removeItem("clarus-remember-session")
        localStorage.removeItem("clarus-session-expiry")
        sessionStorage.removeItem("clarus-session-active")
      }

      await supabase.auth.signOut()
      // Force a hard navigation to clear all cached state
      window.location.href = "/login"
    } catch (error) {
      console.error("Logout error:", error)
      setLoggingOut(false)
    }
  }

  const handleLogin = () => {
    router.push("/login")
  }

  // Function to manage subscription via Polar portal
  const handleManageSubscription = async () => {
    if (!user) return

    setManagingSubscription(true)
    try {
      const res = await fetch("/api/polar/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        console.error("Failed to create portal session:", data.error)
      }
    } catch (error) {
      console.error("Error managing subscription:", error)
    } finally {
      setManagingSubscription(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsDropdownOpen(open)
    onOpenChange?.(open)
  }

  return (
    <>
      <DropdownMenu onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          {variant === "mobile" ? (
            <button
              className={`flex flex-col items-center justify-center transition-colors focus:outline-none ${
                isDropdownOpen ? "text-brand" : "text-white/40"
              }`}
              aria-label="Settings and Profile"
            >
              <Settings className="w-6 h-6" />
              <span className="text-[0.6875rem] mt-1 font-medium">Settings</span>
            </button>
          ) : (
            <button
              className="relative p-2 rounded-lg text-white/50 hover:text-white/90 transition-all duration-200 group focus:outline-none"
              aria-label="Settings and Profile"
            >
              <Settings className="h-5 w-5 transition-transform duration-200 group-hover:rotate-45" />
              {/* Subtle hover background */}
              <div className="absolute inset-0 rounded-lg bg-white/[0.06] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={variant === "mobile" ? "end" : "end"}
          side={variant === "mobile" ? "top" : "bottom"}
          sideOffset={variant === "mobile" ? 12 : 8}
          className="w-72 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/50 rounded-2xl p-2 shadow-2xl"
        >
          {/* User section */}
          {loading ? (
            <div className="flex items-center gap-3 px-3 py-3">
              <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />
              <span className="text-sm text-neutral-400">Loading...</span>
            </div>
          ) : user ? (
            <div className="px-3 py-3 mb-1">
              <p className="text-xs text-neutral-500 mb-1">Signed in as</p>
              <p className="text-sm text-neutral-200 truncate">{user.email}</p>
            </div>
          ) : (
            <DropdownMenuItem
              onClick={handleLogin}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-200"
            >
              <UserIcon className="h-4 w-4 text-neutral-400" />
              <span>Sign In</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="bg-neutral-700/50 my-1" />

          {/* My Usage — links to /dashboard */}
          {user && (
            <Link href="/dashboard" className="block">
              <DropdownMenuItem className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-200">
                <BarChart3 className="h-4 w-4 text-brand" />
                <span>My Usage</span>
              </DropdownMenuItem>
            </Link>
          )}

          {/* Analysis Preferences — Starter+ only */}
          {user && TIER_FEATURES[userTier]?.analysisPreferences && (
            <Link href="/dashboard?tab=preferences" className="block">
              <DropdownMenuItem className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-200">
                <SlidersHorizontal className="h-4 w-4 text-neutral-400" />
                <span>Analysis Preferences</span>
              </DropdownMenuItem>
            </Link>
          )}

          {/* Bookmarks */}
          {user && (
            <DropdownMenuItem
              onClick={() => router.push("/library?bookmarks=true")}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-200"
            >
              <Bookmark className="h-4 w-4 text-amber-400" />
              <span>Reading List</span>
            </DropdownMenuItem>
          )}

          {/* Edit AI Prompts - Admin only */}
          {user && isAdmin && (
            <DropdownMenuItem
              onClick={() => setIsEditPromptModalOpen(true)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-200"
            >
              <Sparkles className="h-4 w-4 text-neutral-400" />
              <span>Edit AI Prompts</span>
            </DropdownMenuItem>
          )}

          {user && subscriptionStatus && ["active", "trialing"].includes(subscriptionStatus) && (
            <DropdownMenuItem
              onClick={handleManageSubscription}
              disabled={managingSubscription}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-200"
            >
              <CreditCard className="h-4 w-4 text-neutral-400" />
              <span>Manage Subscription</span>
              {managingSubscription && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
            </DropdownMenuItem>
          )}

          {/* Admin Dashboard - only show for admin users */}
          {user && isAdmin && (
            <>
              <DropdownMenuSeparator className="bg-neutral-700/50 my-1" />
              <Link
                href="/manage"
                className="block"
                onMouseEnter={() => prefetchAdminMetrics(user.id)}
                onFocus={() => prefetchAdminMetrics(user.id)}
              >
                <DropdownMenuItem className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-brand/10 cursor-pointer text-brand">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Admin Dashboard</span>
                </DropdownMenuItem>
              </Link>
            </>
          )}

          {/* Legal links */}
          <DropdownMenuSeparator className="bg-neutral-700/50 my-1" />
          <Link href="/terms" className="block">
            <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-400 hover:text-neutral-200">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Terms of Service</span>
            </DropdownMenuItem>
          </Link>
          <Link href="/privacy" className="block">
            <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-400 hover:text-neutral-200">
              <Shield className="h-4 w-4" />
              <span className="text-sm">Privacy Policy</span>
            </DropdownMenuItem>
          </Link>

          {/* Logout - only show when logged in */}
          {user && (
            <>
              <DropdownMenuSeparator className="bg-neutral-700/50 my-1" />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-500/10 cursor-pointer text-red-400 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
                {loggingOut && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <EditAIPromptsModal isOpen={isEditPromptModalOpen} onOpenChange={setIsEditPromptModalOpen} />
    </>
  )
}

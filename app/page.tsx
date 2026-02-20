"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { getCachedSession, setAuthCache } from "@/components/with-auth"

// PERF: Dynamic imports split the bundle by auth state.
// Unauthenticated users only download landing page code (~landing components).
// Authenticated users only download home content code (~chat, framer-motion, hooks).
const LandingPage = dynamic(() => import("@/components/landing/landing-page").then(m => ({ default: m.LandingPage })), { ssr: false })
const HomeContent = dynamic(() => import("./home-content"), { ssr: false })

/**
 * Synchronous check for Supabase auth token in localStorage or cookies.
 * Returns true if a token exists (user might be authenticated).
 * Returns false if no token (user is definitely not authenticated).
 * This avoids the ~500ms async getSession() call for first-time visitors.
 *
 * Checks cookies in addition to localStorage because after an OAuth redirect,
 * the auth callback sets session cookies server-side but localStorage hasn't
 * been populated yet by the client-side Supabase SDK.
 */
function hasLocalAuthToken(): boolean {
  if (typeof window === "undefined") return false
  try {
    // Check localStorage (standard path for returning users)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        return true
      }
    }
    // Check cookies (OAuth redirect path — cookies exist before localStorage is populated)
    const cookies = document.cookie
    if (cookies.includes("sb-") && cookies.includes("-auth-token")) {
      return true
    }
  } catch {
    // localStorage/cookies may be inaccessible (e.g. private browsing restrictions)
  }
  return false
}

export default function HomePage() {
  const cached = getCachedSession()
  const [session, setSession] = useState<Session | null>(cached.session)
  const [loading, setLoading] = useState(!cached.initialized)

  useEffect(() => {
    if (cached.initialized) {
      setSession(cached.session)
      setLoading(false)
      return
    }

    let isMounted = true

    // PERF: Fast path for first-time visitors. If no Supabase auth token
    // exists in localStorage, the user is definitely not authenticated.
    // This skips the async getSession() round-trip and resolves in ~16ms
    // (one React commit) instead of ~500ms-1s.
    if (hasLocalAuthToken()) {
      // Token exists — validate the session asynchronously (returning user)
      const getSessionWithTimeout = async () => {
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Session timeout")), 5000)
          })

          const {
            data: { session },
          } = await Promise.race([supabase.auth.getSession(), timeoutPromise])

          if (isMounted) {
            setSession(session)

            // Also fetch subscription status for auth cache
            type SubscriptionStatus = "active" | "trialing" | "grandfathered" | "enterprise" | "canceled" | "none" | null
            let subscriptionStatus: SubscriptionStatus = null
            if (session?.user) {
              const { data: userData } = await supabase
                .from("users")
                .select("subscription_status")
                .eq("id", session.user.id)
                .single()
              subscriptionStatus = (userData?.subscription_status as SubscriptionStatus) || "none"
            }

            setAuthCache(session, subscriptionStatus)
            setLoading(false)
          }
        } catch {
          if (isMounted) {
            setSession(null)
            setAuthCache(null)
            setLoading(false)
          }
        }
      }

      getSessionWithTimeout()
    } else {
      // No token in localStorage — user is definitely not authenticated.
      // Resolve immediately without any network calls.
      setSession(null)
      setAuthCache(null)
      setLoading(false)
    }

    // Auth state listener — needed in both paths for when user logs in
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isMounted) {
        setSession(session)

        type SubStatus = "active" | "trialing" | "grandfathered" | "enterprise" | "canceled" | "none" | null
        let subStatus: SubStatus = null
        if (session?.user) {
          const { data: userData } = await supabase
            .from("users")
            .select("subscription_status")
            .eq("id", session.user.id)
            .single()
          subStatus = (userData?.subscription_status as SubStatus) || "none"
        }

        setAuthCache(session, subStatus)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [cached.initialized, cached.session])

  if (loading) {
    return (
      <div role="status" className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (!session) {
    return <LandingPage />
  }

  return <HomeContent session={session} />
}

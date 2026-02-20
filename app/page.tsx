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

    // Always validate session asynchronously. This adds ~500ms for first-time
    // visitors but correctly handles OAuth redirects where the session exists
    // only in httpOnly cookies (invisible to localStorage and document.cookie).
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

    // Auth state listener — handles login/logout events after initial load
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

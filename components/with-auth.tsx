"use client"

import { useEffect, useState, useRef, type ComponentType } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Session } from "@supabase/supabase-js"

type SubscriptionStatus = "active" | "trialing" | "grandfathered" | "canceled" | "none" | null

// Props injected by the withAuth HOC
export interface WithAuthInjectedProps {
  session: Session | null
  subscriptionStatus: SubscriptionStatus
}

// Global auth cache - persists across page navigations
let cachedSession: Session | null = null
let cachedSubscriptionStatus: SubscriptionStatus = null
let authInitialized = false
let authCheckPromise: Promise<void> | null = null

/**
 * HOC that wraps a component with authentication logic.
 * Uses aggressive caching to prevent any flickering between pages.
 */
export default function withAuth<P extends object>(
  WrappedComponent: ComponentType<P & WithAuthInjectedProps>
): ComponentType<P> {
  const AuthComponent = (props: P) => {
    const router = useRouter()
    const pathname = usePathname()
    const [session, setSession] = useState<Session | null>(cachedSession)
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(cachedSubscriptionStatus)
    // Only show loading on very first app load when we have NO cached data
    const [loading, setLoading] = useState(!authInitialized && cachedSession === null)
    const listenerSetupRef = useRef(false)

    // Public auth paths that don't require authentication
    const publicAuthPaths = ["/login", "/signup", "/forgot-password", "/update-password", "/pricing"]
    const isPublicPath = publicAuthPaths.includes(pathname)

    // Sync with cache on mount (for navigations after initial load)
    useEffect(() => {
      if (authInitialized && cachedSession !== session) {
        setSession(cachedSession)
        setSubscriptionStatus(cachedSubscriptionStatus)
      }
    }, [pathname])

    useEffect(() => {
      // Only set up listener once globally
      if (listenerSetupRef.current) return
      listenerSetupRef.current = true

      const initAuth = async () => {
        // If already initialized, just sync state
        if (authInitialized) {
          setSession(cachedSession)
          setSubscriptionStatus(cachedSubscriptionStatus)
          setLoading(false)
          return
        }

        // Prevent duplicate auth checks
        if (authCheckPromise) {
          await authCheckPromise
          setSession(cachedSession)
          setSubscriptionStatus(cachedSubscriptionStatus)
          setLoading(false)
          return
        }

        authCheckPromise = (async () => {
          try {
            const { data: { session: initialSession }, error } = await supabase.auth.getSession()

            if (error) {
              console.warn("Auth session error:", error.message)
              cachedSession = null
              cachedSubscriptionStatus = null
            } else {
              cachedSession = initialSession

              if (initialSession?.user) {
                const { data: userData } = await supabase
                  .from("users")
                  .select("subscription_status")
                  .eq("id", initialSession.user.id)
                  .single()

                cachedSubscriptionStatus = (userData?.subscription_status as SubscriptionStatus) || "none"
              }
            }

            authInitialized = true
          } catch (err) {
            console.warn("Auth initialization error:", err)
            cachedSession = null
            cachedSubscriptionStatus = null
            authInitialized = true
          }
        })()

        await authCheckPromise
        authCheckPromise = null

        setSession(cachedSession)
        setSubscriptionStatus(cachedSubscriptionStatus)
        setLoading(false)
      }

      initAuth()

      // Set up auth state listener
      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (_event === "TOKEN_REFRESHED" && !newSession) {
          cachedSession = null
          cachedSubscriptionStatus = null
          setSession(null)
          setSubscriptionStatus(null)
          return
        }

        cachedSession = newSession
        setSession(newSession)

        if (newSession?.user) {
          const { data: userData } = await supabase
            .from("users")
            .select("subscription_status")
            .eq("id", newSession.user.id)
            .single()

          const status = (userData?.subscription_status as SubscriptionStatus) || "none"
          cachedSubscriptionStatus = status
          setSubscriptionStatus(status)
        } else {
          cachedSubscriptionStatus = null
          setSubscriptionStatus(null)
        }

        if (_event === "PASSWORD_RECOVERY") {
          router.replace("/update-password")
        }

        if (_event === "SIGNED_OUT") {
          cachedSession = null
          cachedSubscriptionStatus = null
          authInitialized = false
        }
      })

      return () => {
        authListener.subscription.unsubscribe()
      }
    }, [router])

    // Handle redirects
    useEffect(() => {
      if (loading) return

      // Redirect to login if not authenticated and not on public path
      if (!session && !isPublicPath) {
        router.replace("/login")
        return
      }

      // Redirect to pricing if no valid subscription (but allow null during initial check)
      if (
        session &&
        !isPublicPath &&
        subscriptionStatus !== "active" &&
        subscriptionStatus !== "trialing" &&
        subscriptionStatus !== "grandfathered" &&
        subscriptionStatus !== null
      ) {
        router.replace("/pricing")
      }
    }, [loading, session, subscriptionStatus, pathname, router, isPublicPath])

    // Only show loading on very first app load
    // Once initialized, never show loading - just render with cached values
    if (loading && !authInitialized) {
      // Return null for minimal flash, or a very subtle indicator
      return null
    }

    // For public paths, always render
    if (isPublicPath) {
      return <WrappedComponent {...props} session={session} subscriptionStatus={subscriptionStatus} />
    }

    // For protected paths, render if we have a session (redirect happens in useEffect)
    // This prevents showing content briefly before redirect
    if (!session) {
      return null
    }

    // Check subscription - render null while redirect happens
    if (
      subscriptionStatus !== "active" &&
      subscriptionStatus !== "trialing" &&
      subscriptionStatus !== "grandfathered" &&
      subscriptionStatus !== null
    ) {
      return null
    }

    return <WrappedComponent {...props} session={session} subscriptionStatus={subscriptionStatus} />
  }

  AuthComponent.displayName = `WithAuth(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`
  return AuthComponent
}

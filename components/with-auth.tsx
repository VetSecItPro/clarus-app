"use client"

import { useEffect, useState, useRef, type ComponentType } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Session } from "@supabase/supabase-js"
import { PrefetchData } from "./prefetch-data"

type SubscriptionStatus = "active" | "trialing" | "grandfathered" | "enterprise" | "canceled" | "none" | null

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

// Export cached session for components that need quick access without re-fetching
export function getCachedSession(): { session: Session | null; initialized: boolean } {
  return { session: cachedSession, initialized: authInitialized }
}

// Reset auth cache - call after successful login to force re-fetch
export function clearAuthCache() {
  authInitialized = false
  cachedSession = null
  cachedSubscriptionStatus = null
}

// Set auth cache with new session - call after successful login
export function setAuthCache(session: Session | null, subscriptionStatus?: SubscriptionStatus) {
  cachedSession = session
  cachedSubscriptionStatus = subscriptionStatus ?? null
  authInitialized = true
}

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
    const publicAuthPaths = ["/login", "/signup", "/forgot-password", "/update-password"]
    const isPublicPath = publicAuthPaths.includes(pathname)

    // Sync with cache on mount (for navigations after initial load)
    // We intentionally only run on pathname change, not session change (would cause infinite loop)
    useEffect(() => {
      if (authInitialized && cachedSession !== session) {
        setSession(cachedSession)
        setSubscriptionStatus(cachedSubscriptionStatus)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
          const attemptGetSession = async (timeoutMs: number) => {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error("Auth timeout")), timeoutMs)
            })
            return Promise.race([supabase.auth.getSession(), timeoutPromise])
          }

          try {
            // First attempt with 10s timeout
            let sessionResult: Awaited<ReturnType<typeof supabase.auth.getSession>>
            try {
              sessionResult = await attemptGetSession(10000)
            } catch {
              // Retry once with a longer timeout (cold start recovery)
              console.warn("Auth first attempt timed out, retrying...")
              sessionResult = await attemptGetSession(10000)
            }

            const { data: { session: initialSession }, error } = sessionResult

            if (error) {
              console.warn("Auth session error:", error.message)
              cachedSession = null
              cachedSubscriptionStatus = null
            } else {
              cachedSession = initialSession

              if (initialSession?.user) {
                // Also add timeout to user data fetch
                try {
                  const userDataPromise = supabase
                    .from("users")
                    .select("subscription_status")
                    .eq("id", initialSession.user.id)
                    .single()

                  const userTimeout = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error("User data timeout")), 5000)
                  })

                  const { data: userData } = await Promise.race([userDataPromise, userTimeout])
                  cachedSubscriptionStatus = (userData?.subscription_status as SubscriptionStatus) || "none"
                } catch (userErr) {
                  console.warn("User data fetch error:", userErr)
                  cachedSubscriptionStatus = "none"
                }
              }
            }

            authInitialized = true
          } catch (err) {
            console.warn("Auth initialization failed after retry:", err)
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
        const returnTo = pathname !== "/home" ? `?returnTo=${encodeURIComponent(pathname)}` : ""
        router.replace(`/login${returnTo}`)
        return
      }
    }, [loading, session, pathname, router, isPublicPath])

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

    return (
      <>
        <WrappedComponent {...props} session={session} subscriptionStatus={subscriptionStatus} />
        <PrefetchData userId={session?.user?.id} />
      </>
    )
  }

  AuthComponent.displayName = `WithAuth(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`
  return AuthComponent
}

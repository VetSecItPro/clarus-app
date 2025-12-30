"use client"

import { useEffect, useState, useRef, type ComponentType } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Session } from "@supabase/supabase-js"
import LoadingSpinner from "./loading-spinner"

interface WithAuthProps {
  [key: string]: any
}

type SubscriptionStatus = "active" | "trialing" | "grandfathered" | "canceled" | "none" | null

// Cache auth state globally to prevent re-checking on every navigation
let cachedSession: Session | null = null
let cachedSubscriptionStatus: SubscriptionStatus = null
let authInitialized = false

export default function withAuth<P extends WithAuthProps>(WrappedComponent: ComponentType<P>) {
  const AuthComponent = (props: P) => {
    const router = useRouter()
    const pathname = usePathname()
    // Use cached values as initial state to prevent flash
    const [session, setSession] = useState<Session | null>(cachedSession)
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(cachedSubscriptionStatus)
    const [loading, setLoading] = useState(!authInitialized)
    const listenerSetupRef = useRef(false)

    useEffect(() => {
      // Only set up listener once globally
      if (listenerSetupRef.current) return
      listenerSetupRef.current = true

      const checkInitialSessionAndSetupListener = async () => {
        // If already initialized, use cached values
        if (authInitialized) {
          setSession(cachedSession)
          setSubscriptionStatus(cachedSubscriptionStatus)
          setLoading(false)
          return
        }

        try {
          const {
            data: { session: initialSession },
            error,
          } = await supabase.auth.getSession()

          // Handle refresh token errors by clearing session
          if (error) {
            console.warn("Auth session error:", error.message)
            cachedSession = null
            cachedSubscriptionStatus = null
            setSession(null)
            setSubscriptionStatus(null)
            authInitialized = true
            setLoading(false)
            return
          }

          // Check "remember me" preference and enforce session expiry
          if (initialSession && typeof window !== "undefined") {
            const rememberSession = localStorage.getItem("vajra-remember-session")
            const sessionExpiry = localStorage.getItem("vajra-session-expiry")
            const sessionActive = sessionStorage.getItem("vajra-session-active")

            // Case 1: User chose NOT to remember - check if this is a new browser session
            // (sessionStorage is cleared when browser closes)
            if (!rememberSession && !sessionActive) {
              // No remember flag and no active session marker = new browser session
              // Sign out the user
              console.log("Session not remembered, signing out...")
              await supabase.auth.signOut()
              cachedSession = null
              cachedSubscriptionStatus = null
              setSession(null)
              setSubscriptionStatus(null)
              authInitialized = true
              setLoading(false)
              return
            }

            // Case 2: Session expiry has passed (for "remember me" sessions)
            if (sessionExpiry && Date.now() > parseInt(sessionExpiry, 10)) {
              console.log("Session expired, signing out...")
              localStorage.removeItem("vajra-remember-session")
              localStorage.removeItem("vajra-session-expiry")
              await supabase.auth.signOut()
              cachedSession = null
              cachedSubscriptionStatus = null
              setSession(null)
              setSubscriptionStatus(null)
              authInitialized = true
              setLoading(false)
              return
            }

            // Mark this browser session as active (for non-remember sessions)
            if (!rememberSession) {
              sessionStorage.setItem("vajra-session-active", "true")
            }
          }

          cachedSession = initialSession
          setSession(initialSession)

          if (initialSession?.user) {
            const { data: userData } = await supabase
              .from("users")
              .select("subscription_status")
              .eq("id", initialSession.user.id)
              .single()

            const status = (userData?.subscription_status as SubscriptionStatus) || "none"
            cachedSubscriptionStatus = status
            setSubscriptionStatus(status)
          }

          authInitialized = true
          setLoading(false)
        } catch (err) {
          // Handle any auth errors (including refresh token issues)
          console.warn("Auth initialization error:", err)
          cachedSession = null
          cachedSubscriptionStatus = null
          setSession(null)
          setSubscriptionStatus(null)
          authInitialized = true
          setLoading(false)

          // Clear invalid tokens from storage
          if (typeof window !== "undefined") {
            // Supabase stores tokens in localStorage with a specific key pattern
            const keys = Object.keys(localStorage).filter(key =>
              key.includes("supabase") && key.includes("auth")
            )
            keys.forEach(key => localStorage.removeItem(key))
          }
        }

        // Set up auth state listener (outside try-catch so it always runs)
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          // Handle token refresh errors
          if (_event === "TOKEN_REFRESHED" && !newSession) {
            // Token refresh failed, clear cache
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

          // Handle password recovery redirect
          if (_event === "PASSWORD_RECOVERY") {
            router.replace("/update-password")
          }

          // Handle sign out - clear cache and remember me preferences
          if (_event === "SIGNED_OUT") {
            cachedSession = null
            cachedSubscriptionStatus = null
            authInitialized = false
            // Clear remember me preferences on sign out
            if (typeof window !== "undefined") {
              localStorage.removeItem("vajra-remember-session")
              localStorage.removeItem("vajra-session-expiry")
              sessionStorage.removeItem("vajra-session-active")
            }
          }
        })
        return () => {
          authListener.subscription.unsubscribe()
        }
      }

      checkInitialSessionAndSetupListener()
    }, [router]) // Removed pathname from dependencies

    if (loading) {
      return <LoadingSpinner message="Checking authentication..." />
    }

    // Public auth paths that don't require authentication
    const publicAuthPaths = ["/login", "/signup", "/forgot-password", "/update-password", "/pricing"]

    if (!session && !publicAuthPaths.includes(pathname)) {
      router.replace("/login")
      return <LoadingSpinner message="Redirecting to login..." />
    }

    // Only check on protected routes (not public auth paths)
    if (
      session &&
      !publicAuthPaths.includes(pathname) &&
      subscriptionStatus !== "active" &&
      subscriptionStatus !== "trialing" &&
      subscriptionStatus !== "grandfathered" &&
      subscriptionStatus !== null // Still loading
    ) {
      router.replace("/pricing")
      return <LoadingSpinner message="Redirecting to pricing..." />
    }

    return <WrappedComponent {...props} session={session} subscriptionStatus={subscriptionStatus} />
  }

  AuthComponent.displayName = `WithAuth(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`
  return AuthComponent
}

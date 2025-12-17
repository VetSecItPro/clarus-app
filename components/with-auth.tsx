"use client"

import { useEffect, useState, type ComponentType } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Session } from "@supabase/supabase-js"
import LoadingSpinner from "./loading-spinner"

interface WithAuthProps {
  [key: string]: any
}

type SubscriptionStatus = "active" | "trialing" | "grandfathered" | "canceled" | "none" | null

export default function withAuth<P extends WithAuthProps>(WrappedComponent: ComponentType<P>) {
  const AuthComponent = (props: P) => {
    const router = useRouter()
    const pathname = usePathname()
    const [session, setSession] = useState<Session | null>(null)
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      const checkInitialSessionAndSetupListener = async () => {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession()

        setSession(initialSession)

        if (initialSession?.user) {
          const { data: userData } = await supabase
            .from("users")
            .select("subscription_status")
            .eq("id", initialSession.user.id)
            .single()

          setSubscriptionStatus(userData?.subscription_status || "none")
        }

        setLoading(false)

        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          setSession(newSession)

          if (newSession?.user) {
            const { data: userData } = await supabase
              .from("users")
              .select("subscription_status")
              .eq("id", newSession.user.id)
              .single()

            setSubscriptionStatus(userData?.subscription_status || "none")
          } else {
            setSubscriptionStatus(null)
          }

          if (_event === "PASSWORD_RECOVERY" && pathname !== "/update-password") {
            router.replace("/update-password")
          }
        })
        return () => {
          authListener.subscription.unsubscribe()
        }
      }

      checkInitialSessionAndSetupListener()
    }, [pathname, router])

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

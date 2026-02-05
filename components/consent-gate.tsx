// FE: FIX-FE-014 — gate analytics behind cookie consent
"use client"

import { useState, useEffect, type ReactNode } from "react"
import { hasAnalyticsConsent } from "@/components/cookie-consent"

/**
 * Only renders children (e.g. <Analytics />) when the user has accepted
 * analytics cookies. Listens for consent changes in real time.
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const [consented, setConsented] = useState(false)

  useEffect(() => {
    // Check initial state
    setConsented(hasAnalyticsConsent())

    // Listen for consent changes from the cookie banner
    const handler = () => setConsented(hasAnalyticsConsent())
    window.addEventListener("cookie-consent-change", handler)
    return () => window.removeEventListener("cookie-consent-change", handler)
  }, [])

  if (!consented) return null
  return <>{children}</>
}

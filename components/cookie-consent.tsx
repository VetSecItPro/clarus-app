"use client"

import { useState, useEffect } from "react"
import { Cookie } from "lucide-react"
import Link from "next/link"

// FE: FIX-FE-013 — added decline option for cookie consent

/** Check if the user has accepted analytics cookies */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false
  try {
    const stored = localStorage.getItem("cookie-consent")
    if (!stored) return false
    const parsed = JSON.parse(stored)
    return parsed.analytics === true
  } catch {
    return false
  }
}

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cookie-consent")
      if (!stored) {
        setShowBanner(true)
      }
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", JSON.stringify({
      essential: true,
      analytics: true,
      timestamp: Date.now()
    }))
    setShowBanner(false)
    // Dispatch event so ConsentGate can react
    window.dispatchEvent(new Event("cookie-consent-change"))
  }

  const handleDecline = () => {
    localStorage.setItem("cookie-consent", JSON.stringify({
      essential: true,
      analytics: false,
      timestamp: Date.now()
    }))
    setShowBanner(false)
    window.dispatchEvent(new Event("cookie-consent-change"))
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[100]">
      <div className="bg-neutral-900/95 backdrop-blur-xl border border-white/[0.1] rounded-full shadow-2xl px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Cookie className="w-4 h-4 text-white/40 flex-shrink-0" />
          <p className="text-white/60 text-xs flex-1">
            Essential cookies + anonymous analytics.{" "}
            <Link href="/privacy" className="text-[#1d9bf0] hover:underline">
              Privacy
            </Link>
          </p>
          <button
            onClick={handleDecline}
            className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-white/60 rounded-full font-medium transition-colors text-xs flex-shrink-0"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-3 py-1.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-full font-medium transition-colors text-xs flex-shrink-0"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

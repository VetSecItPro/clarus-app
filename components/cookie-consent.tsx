"use client"

import { useState, useEffect } from "react"
import { Cookie } from "lucide-react"
import Link from "next/link"

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
      timestamp: Date.now()
    }))
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div role="alert" className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[100]">
      <div className="bg-neutral-900/95 backdrop-blur-xl border border-white/[0.1] rounded-full shadow-2xl px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Cookie className="w-4 h-4 text-white/40 flex-shrink-0" />
          <p className="text-white/60 text-xs flex-1">
            Essential cookies + anonymous analytics.{" "}
            <Link href="/privacy" className="text-brand hover:underline">
              Privacy
            </Link>
          </p>
          <button
            onClick={handleAccept}
            className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-full font-medium transition-colors text-xs flex-shrink-0"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

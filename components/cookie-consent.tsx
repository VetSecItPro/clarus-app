"use client"

import { useState, useEffect } from "react"
import { X, Cookie, Shield, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface CookiePreferences {
  essential: boolean
  analytics: boolean
  marketing: boolean
  timestamp: number
}

const DEFAULT_PREFERENCES: CookiePreferences = {
  essential: true,
  analytics: false,
  marketing: false,
  timestamp: 0,
}

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cookie-consent")
      if (!stored) {
        setShowBanner(true)
      } else {
        try {
          setPreferences(JSON.parse(stored))
        } catch {
          setShowBanner(true)
        }
      }
    }
  }, [])

  const savePreferences = (prefs: CookiePreferences) => {
    const toSave = { ...prefs, timestamp: Date.now() }
    localStorage.setItem("cookie-consent", JSON.stringify(toSave))
    setPreferences(toSave)
    setShowBanner(false)
    setShowPreferences(false)
  }

  const handleAcceptAll = () => {
    savePreferences({
      essential: true,
      analytics: false, // We only use essential - keeping false
      marketing: false, // We don't do marketing - keeping false
      timestamp: Date.now(),
    })
  }

  const handleAcceptEssential = () => {
    savePreferences({
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    })
  }

  const handleSavePreferences = () => {
    savePreferences(preferences)
  }

  if (!showBanner && !showPreferences) return null

  return (
    <>
      {/* Cookie Banner */}
      {showBanner && !showPreferences && (
        <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6">
          <div className="max-w-4xl mx-auto bg-neutral-900/95 backdrop-blur-xl border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#1d9bf0]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Cookie className="w-6 h-6 text-[#1d9bf0]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg mb-2">We Value Your Privacy</h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-4">
                    We use essential cookies to make our site work. We do not use cookies for marketing,
                    advertising, or tracking purposes. By clicking &quot;Accept&quot;, you consent to our use of
                    essential cookies only.{" "}
                    <Link href="/privacy" className="text-[#1d9bf0] hover:underline">
                      Learn more
                    </Link>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleAcceptAll}
                      className="px-5 py-2.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-xl font-medium transition-colors text-sm"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => setShowPreferences(true)}
                      className="px-5 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-xl font-medium transition-colors text-sm flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Manage Preferences
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowPreferences(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-neutral-900 border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1d9bf0]/10 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#1d9bf0]" />
                </div>
                <h2 className="text-white font-semibold text-lg">Cookie Preferences</h2>
              </div>
              <button
                onClick={() => setShowPreferences(false)}
                className="p-2 hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Essential Cookies */}
              <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium">Essential Cookies</h3>
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg font-medium">
                    Always Active
                  </span>
                </div>
                <p className="text-white/50 text-sm">
                  These cookies are necessary for the website to function and cannot be switched off.
                  They include authentication, security, and basic functionality.
                </p>
              </div>

              {/* Analytics Cookies */}
              <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl opacity-50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium">Analytics Cookies</h3>
                  <span className="px-2 py-1 bg-white/[0.08] text-white/40 text-xs rounded-lg font-medium">
                    Not Used
                  </span>
                </div>
                <p className="text-white/50 text-sm">
                  We do not use analytics cookies. Your browsing behavior is not tracked or analyzed.
                </p>
              </div>

              {/* Marketing Cookies */}
              <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl opacity-50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium">Marketing Cookies</h3>
                  <span className="px-2 py-1 bg-white/[0.08] text-white/40 text-xs rounded-lg font-medium">
                    Not Used
                  </span>
                </div>
                <p className="text-white/50 text-sm">
                  We do not use marketing or advertising cookies. You will not see targeted ads based on your activity.
                </p>
              </div>

              {/* Privacy Notice */}
              <div className="p-4 bg-[#1d9bf0]/5 border border-[#1d9bf0]/20 rounded-xl">
                <p className="text-white/70 text-sm">
                  For more information about how we handle your data, please read our{" "}
                  <Link href="/privacy" className="text-[#1d9bf0] hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-white/[0.08]">
              <button
                onClick={handleAcceptEssential}
                className="flex-1 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-xl font-medium transition-colors text-sm"
              >
                Accept Essential Only
              </button>
              <button
                onClick={handleSavePreferences}
                className="flex-1 px-4 py-2.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-xl font-medium transition-colors text-sm"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

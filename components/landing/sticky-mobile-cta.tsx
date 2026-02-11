"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function StickyMobileCTA() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past the hero (~500px)
      setVisible(window.scrollY > 500)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="bg-black/90 backdrop-blur-xl border-t border-white/[0.08] px-4 py-3">
        <Link
          href="/signup"
          className="flex items-center justify-center gap-2 w-full py-3 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white text-sm font-semibold rounded-full transition-colors shadow-lg shadow-[#1d9bf0]/30"
        >
          Analyze your first link free
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function StickyCTA() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past ~600px (past hero)
      setVisible(window.scrollY > 600)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none">
      <div className="p-4 flex justify-center">
        <div className="pointer-events-auto inline-flex items-center gap-4 px-5 py-2.5 rounded-full bg-black/80 backdrop-blur-md border border-white/[0.08] shadow-2xl">
          <span className="text-sm text-white/50 hidden sm:inline">
            Analyze any article in seconds
          </span>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 px-5 py-1.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white text-sm font-semibold rounded-full transition-colors"
          >
            Start free
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { Shield } from "lucide-react"

export default function SiteFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-white/[0.08] bg-black mb-14 sm:mb-0">
      {/* Mobile: Ultra-minimal footer */}
      <div className="sm:hidden px-4 py-2">
        <p className="text-center text-[9px] text-white/25 leading-none">
          <Link href="/terms" className="hover:text-white/40 transition-colors">Terms</Link>
          <span className="text-white/15 mx-1.5">·</span>
          <Link href="/privacy" className="hover:text-white/40 transition-colors">Privacy</Link>
          <span className="text-white/15 mx-1.5">·</span>
          <span>&copy; {currentYear}</span>
        </p>
      </div>

      {/* Desktop: Full footer */}
      <div className="hidden sm:block max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-row items-center justify-between gap-6">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-[#1d9bf0]/10 rounded-lg flex items-center justify-center group-hover:bg-[#1d9bf0]/20 transition-colors">
              <Shield className="w-4 h-4 text-[#1d9bf0]" />
            </div>
            <span className="text-white/80 font-medium group-hover:text-white transition-colors">
              Truth Checker
            </span>
          </Link>

          {/* Links */}
          <nav className="flex items-center gap-6">
            <Link
              href="/terms"
              className="text-white/50 hover:text-white text-sm transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-white/50 hover:text-white text-sm transition-colors"
            >
              Privacy Policy
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-white/40 text-sm">
            &copy; {currentYear} Truth Checker. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

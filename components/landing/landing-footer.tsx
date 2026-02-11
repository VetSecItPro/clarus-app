"use client"

import Link from "next/link"
import Image from "next/image"

export function LandingFooter() {
  return (
    <footer className="py-8 px-4 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        {/* Top row: logo + links */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          {/* Logo and tagline */}
          <div className="flex items-center gap-3">
            <Image
              src="/clarus-logo.webp"
              alt="Clarus"
              width={40}
              height={40}
              sizes="40px"
              className="w-10 h-10"
            />
            <span className="text-white/90 font-bold text-3xl italic tracking-wide" style={{ fontFamily: 'var(--font-cormorant)' }}>
              Clarus
            </span>
          </div>

          {/* Links — wrap on mobile */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-5 gap-y-2 text-sm text-white/50">
            <Link href="/articles" className="hover:text-white/70 transition-colors">
              Articles
            </Link>
            <Link href="/pricing" className="hover:text-white/70 transition-colors">
              Pricing
            </Link>
            <Link href="/contact" className="hover:text-white/70 transition-colors">
              Contact
            </Link>
            <Link href="/install" className="hover:text-white/70 transition-colors">
              Install App
            </Link>
            <Link href="/terms" className="hover:text-white/70 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white/70 transition-colors">
              Privacy
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-6 pt-4 border-t border-white/[0.04] text-center sm:text-left">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Clarus. Veteran-Owned &amp; Operated. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

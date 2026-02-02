"use client"

import Link from "next/link"
import Image from "next/image"

export function LandingFooter() {
  return (
    <footer className="py-6 px-4 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3 text-white/50">
          <Image
            src="/clarus-logo.webp"
            alt="Clarus"
            width={40}
            height={40}
            className="w-10 h-10"
          />
          <span className="text-white/90 font-bold text-3xl italic tracking-wide" style={{ fontFamily: 'var(--font-cormorant)' }}>
            Clarus
          </span>
          <span className="text-white/30">·</span>
          <span>Veteran-Owned Business</span>
        </div>
        <div className="flex items-center gap-4 text-white/40">
          <Link href="/articles" className="hover:text-white/70 transition-colors">
            Articles
          </Link>
          <span className="text-white/20">·</span>
          <Link href="/contact" className="hover:text-white/70 transition-colors">
            Contact
          </Link>
          <span className="text-white/20">·</span>
          <Link href="/pricing" className="hover:text-white/70 transition-colors">
            Pricing
          </Link>
          <span className="text-white/20">·</span>
          <Link href="/terms" className="hover:text-white/70 transition-colors">
            Terms of Service
          </Link>
          <span className="text-white/20">·</span>
          <Link href="/privacy" className="hover:text-white/70 transition-colors">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  )
}

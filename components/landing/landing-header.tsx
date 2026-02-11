"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/[0.06]"
    >
      <div className="max-w-6xl mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <Image
                src="/clarus-logo.webp"
                alt="Clarus"
                width={40}
                height={40}
                sizes="40px"
                priority
                className="w-10 h-10 transition-all duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[#1d9bf0]/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-white/90 font-bold text-3xl italic tracking-wide group-hover:text-white transition-colors duration-200" style={{ fontFamily: 'var(--font-cormorant)' }}>
              Clarus
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-6">
            <Link href="/articles" prefetch={true} className="text-sm text-white/50 hover:text-white transition-colors">
              Articles
            </Link>
            <Link href="/pricing" prefetch={true} className="text-sm text-white/50 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/login" prefetch={true} className="text-sm text-white/50 hover:text-white transition-colors">
              Log In
            </Link>
            <Link href="/signup" prefetch={true} className="px-5 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white text-sm font-semibold rounded-full transition-all duration-200 shadow-md shadow-[#1d9bf0]/25 hover:shadow-lg hover:shadow-[#1d9bf0]/40 hover:-translate-y-0.5">
              Sign Up Free
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="sm:hidden flex items-center justify-center w-10 h-10 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="sm:hidden overflow-hidden border-t border-white/[0.06] bg-black/95 backdrop-blur-2xl"
          >
            <nav className="flex flex-col px-4 py-4 gap-1">
              <Link
                href="/articles"
                prefetch={true}
                onClick={() => setMobileOpen(false)}
                className="text-sm text-white/70 hover:text-white py-3 px-3 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                Articles
              </Link>
              <Link
                href="/pricing"
                prefetch={true}
                onClick={() => setMobileOpen(false)}
                className="text-sm text-white/70 hover:text-white py-3 px-3 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                Pricing
              </Link>
              <div className="pt-2 mt-1 border-t border-white/[0.06] space-y-2">
                <Link
                  href="/login"
                  prefetch={true}
                  onClick={() => setMobileOpen(false)}
                  className="block text-center px-5 py-3 text-white/70 hover:text-white text-sm font-medium rounded-full border border-white/[0.1] hover:border-white/[0.2] transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  prefetch={true}
                  onClick={() => setMobileOpen(false)}
                  className="block text-center px-5 py-3 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white text-sm font-semibold rounded-full transition-colors shadow-md shadow-[#1d9bf0]/25"
                >
                  Sign Up Free
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

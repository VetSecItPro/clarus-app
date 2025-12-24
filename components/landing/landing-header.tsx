"use client"

import Link from "next/link"
import { Shield } from "lucide-react"
import { motion } from "framer-motion"

export function LandingHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/[0.05]"
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-gradient-to-br from-[#1d9bf0] to-[#1a8cd8] rounded-xl flex items-center justify-center shadow-lg shadow-[#1d9bf0]/20 group-hover:shadow-[#1d9bf0]/30 transition-shadow">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-lg">Truth Checker</span>
          </Link>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <Link href="/login">
              <button className="px-4 py-2 text-white/70 hover:text-white font-medium transition-colors">
                Log In
              </button>
            </Link>
            <Link href="/signup">
              <button className="px-5 py-2.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-medium rounded-xl transition-colors">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </div>
    </motion.header>
  )
}

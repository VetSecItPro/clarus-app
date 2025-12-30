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
      className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/[0.06]"
    >
      <div className="max-w-6xl mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo - minimal and elegant */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-[#1d9bf0] via-[#0ea5e9] to-[#06b6d4] rounded-lg flex items-center justify-center shadow-lg shadow-[#1d9bf0]/25 group-hover:shadow-[#1d9bf0]/40 transition-all duration-300 group-hover:scale-105">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div className="absolute inset-0 bg-[#1d9bf0]/20 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-white/90 font-medium text-[15px] tracking-tight group-hover:text-white transition-colors duration-200">
              Truth Checker
            </span>
          </Link>

          {/* Auth button */}
          <Link href="/login">
            <button className="px-5 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white text-sm font-medium rounded-lg transition-all duration-200 border border-white/[0.1]">
              Log In
            </button>
          </Link>
        </div>
      </div>
    </motion.header>
  )
}

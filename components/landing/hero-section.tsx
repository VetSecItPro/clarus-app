"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { AnimatedBackground } from "./animated-background"

export function HeroSection() {
  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 flex items-center justify-center overflow-hidden">
      {/* Animated gradient orbs */}
      <AnimatedBackground />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.05] mb-6"
        >
          Understand{" "}
          <span className="relative inline-block">
            <span className="relative z-10 italic">any</span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 bg-[#1d9bf0]/30 -skew-x-6 rounded origin-left"
              style={{ top: '10%', bottom: '10%' }}
            />
          </span>
          {" "}content
          <br />
          <span className="gradient-text">instantly</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="text-lg sm:text-xl text-white/40 max-w-xl mx-auto leading-relaxed font-light mb-8"
        >
          Drop a YouTube video, article, or document.
          <span className="text-white/60"> Get AI-powered summaries and insights in seconds.</span>
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href="/signup">
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group inline-flex items-center gap-2 px-8 py-3.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-full transition-colors duration-200 shadow-lg shadow-[#1d9bf0]/25"
            >
              Get started free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

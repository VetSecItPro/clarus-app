"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { AnimatedBackground } from "./animated-background"

export const HeroSection = memo(function HeroSection() {
  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 flex items-center justify-center overflow-hidden">
      {/* Animated gradient orbs */}
      <AnimatedBackground />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.05] mb-6"
        >
          Understand anything in{" "}
          <span className="relative inline-block">
            <span className="relative z-10 text-brand">seconds</span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 bg-brand/15 -skew-x-6 rounded origin-left"
              style={{ top: '10%', bottom: '10%' }}
            />
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="text-lg sm:text-xl text-white/60 max-w-xl mx-auto leading-relaxed font-light mb-8"
        >
          Drop any link — video, podcast, article, or PDF — and get an instant verdict:{" "}
          <span className="text-white/70">Skip it, skim the highlights, or dive in. Plus accuracy analysis, speaker breakdowns, and AI chat to go deeper.</span>
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link href="/signup" prefetch={true}>
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group inline-flex items-center gap-2 px-8 py-3.5 bg-brand hover:bg-brand-hover text-white font-semibold rounded-full transition-all duration-200 shadow-[0_0_20px_rgba(29,155,240,0.3),0_0_60px_rgba(29,155,240,0.1)] hover:shadow-[0_0_25px_rgba(29,155,240,0.4),0_0_80px_rgba(29,155,240,0.15)]"
            >
              Analyze your first link free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </Link>
          <a href="#how-it-works">
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-white/80 hover:text-white font-medium rounded-full border border-white/[0.15] hover:border-white/[0.30] transition-all duration-200"
            >
              See how it works
            </motion.button>
          </a>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-4 text-xs text-white/50"
        >
          No credit card required. 5 free analyses per month. Every analysis starts with a verdict: Skip, Skim, Worth It, or Must See.
        </motion.p>

      </div>
    </section>
  )
})

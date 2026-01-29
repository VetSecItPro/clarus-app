"use client"

import { motion } from "framer-motion"
import { Sparkles, ArrowRight } from "lucide-react"
import Link from "next/link"
import { AnimatedBackground } from "./animated-background"

export function HeroSection() {
  return (
    <section className="relative pt-16 pb-8 flex items-center justify-center overflow-hidden">
      {/* Animated gradient orbs */}
      <AnimatedBackground />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] backdrop-blur-sm mb-5"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#1d9bf0]" />
          <span className="text-sm text-white/70 font-medium">Your AI Content Companion</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-5"
        >
          Understand{" "}
          <span className="relative inline-block">
            <span className="relative z-10">Any</span>
            <span className="absolute inset-0 bg-[#1d9bf0]/40 -skew-x-6 -rotate-1 rounded-sm scale-x-115 scale-y-[0.65] translate-y-[15%]" />
          </span>
          {" "}Content <span className="gradient-text">Instantly</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-6 leading-relaxed"
        >
          Drop any YouTube video, article, or X post. Get instant AI summaries,
          key insights, and chat with your content like never before.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center"
        >
          <Link href="/signup">
            <button className="group flex items-center gap-2 px-8 py-3 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-full transition-all duration-200 shadow-lg shadow-[#1d9bf0]/25 hover:shadow-xl hover:shadow-[#1d9bf0]/40 hover:-translate-y-1">
              Get Started Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

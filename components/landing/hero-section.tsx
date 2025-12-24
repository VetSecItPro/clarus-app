"use client"

import { motion } from "framer-motion"
import { Sparkles, ArrowRight, Shield } from "lucide-react"
import Link from "next/link"
import { AnimatedBackground } from "./animated-background"

export function HeroSection() {
  return (
    <section className="relative pt-24 pb-16 flex items-center justify-center overflow-hidden">
      {/* Animated gradient orbs */}
      <AnimatedBackground />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.1] backdrop-blur-sm mb-8"
        >
          <Sparkles className="w-4 h-4 text-[#1d9bf0]" />
          <span className="text-sm text-white/70 font-medium">AI-Powered Fact Checking</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.1] mb-6"
        >
          Separate Fact
          <br />
          from <span className="gradient-text">Fiction</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-xl sm:text-2xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Analyze YouTube videos, articles, and X posts instantly.
          <br className="hidden sm:block" />
          Get AI-powered summaries and truth ratings in seconds.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/signup">
            <button className="group flex items-center gap-2 px-8 py-4 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-2xl transition-all duration-200 shadow-lg shadow-[#1d9bf0]/25 hover:shadow-[#1d9bf0]/40">
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
          <Link href="#features">
            <button className="px-8 py-4 text-white/70 hover:text-white font-medium transition-colors">
              Learn More
            </button>
          </Link>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6 text-white/40 text-sm"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>No credit card required</span>
          </div>
          <div className="hidden sm:block w-1 h-1 rounded-full bg-white/20" />
          <div className="flex items-center gap-2">
            <span>Free forever for basic use</span>
          </div>
          <div className="hidden sm:block w-1 h-1 rounded-full bg-white/20" />
          <div className="flex items-center gap-2">
            <span>Cancel anytime</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

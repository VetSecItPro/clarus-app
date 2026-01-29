"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="py-12 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-md mx-auto"
      >
        <div className="relative px-5 py-8 md:px-6 md:py-10 rounded-2xl overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1d9bf0]/15 via-sky-500/10 to-teal-500/5" />
          <div className="absolute inset-0 border border-white/[0.08] rounded-2xl" />

          {/* Subtle animated glow */}
          <motion.div
            animate={{
              opacity: [0.5, 0.8, 0.5],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#1d9bf0]/20 blur-[100px] pointer-events-none"
          />

          {/* Content */}
          <div className="relative z-10 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Ready to{" "}
              <span className="gradient-text">dive in</span>?
            </h2>
            <p className="text-white/50 text-sm md:text-base mb-6">
              Join thousands using Clarus to understand content faster.
            </p>
            <Link href="/signup">
              <button className="group inline-flex items-center gap-2 px-6 py-3 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-full transition-all duration-200 shadow-lg shadow-[#1d9bf0]/25 hover:shadow-xl hover:shadow-[#1d9bf0]/40 hover:-translate-y-1 text-sm">
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <p className="mt-4 text-white/40 text-xs">
              No credit card required to sign up
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="py-16 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto"
      >
        <div className="relative p-12 md:p-16 rounded-[2.5rem] overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1d9bf0]/20 via-sky-500/10 to-teal-500/10" />
          <div className="absolute inset-0 border border-white/[0.1] rounded-[2.5rem]" />

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
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Ready to find the{" "}
              <span className="gradient-text">truth</span>?
            </h2>
            <p className="text-white/50 text-lg md:text-xl mb-10 max-w-xl mx-auto">
              Join thousands of users who trust Truth Checker to verify content daily.
            </p>
            <Link href="/signup">
              <button className="group inline-flex items-center gap-3 px-10 py-5 bg-white text-black hover:bg-white/90 font-semibold rounded-2xl transition-all duration-200 shadow-xl">
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <p className="mt-6 text-white/40 text-sm">
              No credit card required
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

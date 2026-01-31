"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="py-24 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl mx-auto text-center"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          Stop drowning in content.
        </h2>
        <h2 className="text-3xl sm:text-4xl font-bold text-white/40 mb-6">
          Start understanding it.
        </h2>

        <p className="text-white/40 text-base mb-8 max-w-md mx-auto">
          5 free analyses. No credit card required.
        </p>

        <Link href="/signup">
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-full transition-colors duration-200 shadow-lg shadow-[#1d9bf0]/20"
          >
            Start free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </Link>

        <p className="mt-6 text-sm text-white/25">
          Questions?{" "}
          <a
            href="mailto:hello@clarusapp.io"
            className="text-white/40 hover:text-white/60 underline underline-offset-2 transition-colors"
          >
            hello@clarusapp.io
          </a>
        </p>
      </motion.div>
    </section>
  )
}

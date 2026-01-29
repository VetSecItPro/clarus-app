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
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Start understanding more,
          <br />
          <span className="text-white/40">in less time.</span>
        </h2>

        <p className="text-white/40 text-base mb-8 max-w-md mx-auto">
          Free to start. No credit card required.
        </p>

        <Link href="/signup">
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-full transition-colors duration-200 shadow-lg shadow-[#1d9bf0]/20"
          >
            Get started free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </Link>
      </motion.div>
    </section>
  )
}

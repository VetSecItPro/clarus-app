"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export const CTASection = memo(function CTASection() {
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
          Videos. Podcasts. Articles. PDFs.
        </h2>
        <h2 className="text-3xl sm:text-4xl font-bold text-white/40 mb-6">
          Understood in seconds.
        </h2>

        <p className="text-white/40 text-base mb-8 max-w-md mx-auto">
          6-section analysis with accuracy insights and speaker attribution. 5 free analyses, no credit card.
        </p>

        <Link href="/signup" prefetch={true}>
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-full transition-colors duration-200 shadow-lg shadow-[#1d9bf0]/20"
          >
            Start free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </Link>

      </motion.div>
    </section>
  )
})

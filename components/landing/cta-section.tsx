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
          Stop guessing. Start knowing.
        </h2>
        <p className="text-lg text-white/60 mb-3">
          Skip, Skim, Worth It, or Must See in under 60 seconds.
        </p>

        <p className="text-white/50 text-base mb-8 max-w-md mx-auto">
          Paste any link. Get a verdict, accuracy analysis, and AI chat. 5 free analyses, no credit card.
        </p>

        <Link href="/signup" prefetch={true}>
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-brand hover:bg-brand-hover text-white font-semibold rounded-full transition-all duration-200 shadow-[0_0_20px_rgba(29,155,240,0.3),0_0_60px_rgba(29,155,240,0.1)] hover:shadow-[0_0_25px_rgba(29,155,240,0.4),0_0_80px_rgba(29,155,240,0.15)]"
          >
            Try your first analysis free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </Link>

        <p className="mt-4 text-sm text-white/50">
          Free forever &middot; Pro from{" "}
          <Link href="/pricing" className="text-white/60 hover:text-white underline underline-offset-2 transition-colors">
            $18/mo
          </Link>
        </p>

      </motion.div>
    </section>
  )
})

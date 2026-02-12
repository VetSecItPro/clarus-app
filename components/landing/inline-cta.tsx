"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

interface InlineCTAProps {
  /** "primary" = blue button, "secondary" = outline + pricing link */
  variant?: "primary" | "secondary"
}

export const InlineCTA = memo(function InlineCTA({ variant = "primary" }: InlineCTAProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="py-10 px-6"
    >
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {variant === "primary" ? (
          <Link href="/signup" prefetch={true}>
            <motion.span
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group inline-flex items-center gap-2 px-7 py-3 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-full transition-all duration-200 shadow-[0_0_20px_rgba(29,155,240,0.25)]"
            >
              Analyze your first link free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </motion.span>
          </Link>
        ) : (
          <>
            <Link href="/signup" prefetch={true}>
              <motion.span
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-7 py-3 text-white/80 hover:text-white text-sm font-medium rounded-full border border-white/[0.15] hover:border-white/[0.30] transition-all duration-200"
              >
                Try it free
                <ArrowRight className="w-4 h-4" />
              </motion.span>
            </Link>
            <Link
              href="/pricing"
              prefetch={true}
              className="text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              See pricing
            </Link>
          </>
        )}
      </div>
    </motion.div>
  )
})

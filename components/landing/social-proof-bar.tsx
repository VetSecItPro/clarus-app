"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { ShieldCheck, Lock, Zap, CreditCard } from "lucide-react"

const proofItems = [
  { icon: ShieldCheck, text: "Veteran-Owned & Operated" },
  { icon: Zap, text: "Results in under 60 seconds" },
  { icon: CreditCard, text: "No credit card required" },
  { icon: Lock, text: "Your data never used for training" },
]

export const SocialProofBar = memo(function SocialProofBar() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.6 }}
      className="py-6 px-6 bg-white/[0.02] border-y border-white/[0.04]"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8 max-w-4xl mx-auto">
        {proofItems.map((item) => (
          <div key={item.text} className="flex items-center justify-center gap-2.5 text-white/50">
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{item.text}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
})

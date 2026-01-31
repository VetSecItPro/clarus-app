"use client"

import { motion } from "framer-motion"
import { ShieldCheck, Lock } from "lucide-react"

const proofItems = [
  { icon: ShieldCheck, text: "Veteran-Owned Business" },
  { icon: Lock, text: "Your data never used for training" },
]

export function SocialProofBar() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.6 }}
      className="py-6 px-6 bg-white/[0.02] border-y border-white/[0.04]"
    >
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
        {proofItems.map((item) => (
          <div key={item.text} className="flex items-center gap-2.5 text-white/35">
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">{item.text}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

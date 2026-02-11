"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Headphones, Youtube, Clock } from "lucide-react"

const verdicts = [
  {
    label: "Skip",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    example: "Rehashed takes, no new information",
  },
  {
    label: "Skim",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    example: "A few useful points buried in filler",
  },
  {
    label: "Worth It",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    example: "Solid insights, well-sourced arguments",
  },
  {
    label: "Must See",
    color: "text-[#1d9bf0]",
    bg: "bg-[#1d9bf0]/10",
    border: "border-[#1d9bf0]/20",
    example: "Original research, expert analysis",
  },
]

const useCases = [
  {
    icon: Headphones,
    label: "3-hour podcast",
    time: "Verdict in ~60 seconds",
  },
  {
    icon: Youtube,
    label: "45-min YouTube deep dive",
    time: "Verdict in ~30 seconds",
  },
  {
    icon: Clock,
    label: "Long-form article or PDF",
    time: "Verdict in ~15 seconds",
  },
]

export const BeforeYouPlay = memo(function BeforeYouPlay() {
  return (
    <section className="py-20 px-6 border-t border-white/[0.04] bg-white/[0.015]">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-[#1d9bf0] text-sm font-medium tracking-wide uppercase mb-3">
            Before you hit play
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Know if it&apos;s worth your time
          </h2>
          <p className="text-white/60 text-base max-w-lg mx-auto">
            Every analysis starts with a triage verdict so you can decide where to invest your attention.
          </p>
        </motion.div>

        {/* Verdict labels */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-14"
        >
          {verdicts.map((verdict, index) => (
            <motion.div
              key={verdict.label}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className={`relative p-4 rounded-2xl ${verdict.bg} border ${verdict.border} text-center`}
            >
              <p className={`text-lg font-bold ${verdict.color} mb-1`}>
                {verdict.label}
              </p>
              <p className="text-white/50 text-xs leading-relaxed">
                {verdict.example}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Use cases */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10"
        >
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                <useCase.icon className="w-5 h-5 text-white/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/70">{useCase.label}</p>
                <p className="text-xs text-white/30">{useCase.time}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
})

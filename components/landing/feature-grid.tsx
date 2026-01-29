"use client"

import { motion } from "framer-motion"
import { Youtube, FileText, Brain, FileUp, Clock, Zap, Lock, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

const contentTypes = [
  {
    icon: Youtube,
    title: "YouTube",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  {
    icon: FileText,
    title: "Articles",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: FileUp,
    title: "PDFs",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    icon: Brain,
    title: "X Posts",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
  },
]

const benefits = [
  {
    icon: Clock,
    title: "Save hours",
    description: "Skip the fluff. Get to the point in seconds, not hours.",
  },
  {
    icon: Zap,
    title: "Stay sharp",
    description: "Never miss a key insight. AI highlights what matters.",
  },
  {
    icon: Layers,
    title: "Build knowledge",
    description: "Your personal library of analyzed content, always searchable.",
  },
  {
    icon: Lock,
    title: "Your data, your control",
    description: "We don't store your content long-term or use it for training.",
  },
]

export function FeatureGrid() {
  return (
    <section id="features" className="py-20 px-6 border-t border-white/[0.04]">
      <div className="max-w-3xl mx-auto">
        {/* Content types */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <p className="text-white/30 text-sm font-medium tracking-wide uppercase mb-6">
            Works with
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {contentTypes.map((type, index) => (
              <motion.div
                key={type.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                whileHover={{ y: -2 }}
                className="flex items-center gap-3 px-5 py-3 rounded-full bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", type.bg)}>
                  <type.icon className={cn("w-4 h-4", type.color)} />
                </div>
                <span className="text-white/70 font-medium">{type.title}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Benefits section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Why people love <span className="gradient-text">Clarus</span>
          </h2>
          <p className="text-white/40 text-base max-w-lg mx-auto">
            Built for curious minds who value their time
          </p>
        </motion.div>

        {/* Benefits grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.03] transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#1d9bf0]/10 flex items-center justify-center">
                  <benefit.icon className="w-5 h-5 text-[#1d9bf0]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {benefit.title}
                  </h3>
                  <p className="text-white/40 text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

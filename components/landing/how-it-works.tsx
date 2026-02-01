"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Link2, Sparkles, MessageCircle } from "lucide-react"

const steps = [
  {
    number: "01",
    icon: Link2,
    title: "Paste a link",
    description: "YouTube video, podcast, blog post, news article, PDF, or research paper. Just drop the URL.",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "Get instant analysis",
    description: "Key points, main arguments, claims with sources, and actionable takeaways. Ready in seconds.",
  },
  {
    number: "03",
    icon: MessageCircle,
    title: "Ask anything",
    description: "Chat with your content. Get specific answers. Export to Markdown or PDF.",
  },
]

export const HowItWorks = memo(function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6 scroll-mt-20">
      <div className="max-w-3xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-[#1d9bf0] text-sm font-medium tracking-wide uppercase mb-3">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Three steps to clarity
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="relative text-center md:text-left"
            >
              {/* Connector line (hidden on mobile, shown between items on desktop) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-full h-px bg-gradient-to-r from-white/10 to-transparent" />
              )}

              {/* Step number */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 + 0.2 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-5"
              >
                <step.icon className="w-7 h-7 text-[#1d9bf0]" />
              </motion.div>

              {/* Step content */}
              <div className="space-y-2">
                <span className="text-[#1d9bf0]/60 text-xs font-mono tracking-wider">
                  {step.number}
                </span>
                <h3 className="text-xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto md:mx-0">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
})

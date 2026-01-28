"use client"

import { motion } from "framer-motion"

const stats = [
  { value: "10K+", label: "Content Analyzed" },
  { value: "AI", label: "Advanced Analysis" },
  { value: "Fast", label: "Processing Speed" },
  { value: "24/7", label: "Availability" },
]

export function SocialProof() {
  return (
    <section className="py-16 px-6 border-t border-white/[0.05]">
      <div className="max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2">
                {stat.value}
              </div>
              <div className="text-white/40 text-sm md:text-base">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Testimonial or quote */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-12 text-center"
        >
          <blockquote className="max-w-3xl mx-auto">
            <p className="text-2xl md:text-3xl text-white/80 font-light leading-relaxed italic">
              &ldquo;In an era of information overload, Clarus brings the clarity we all need.&rdquo;
            </p>
            <footer className="mt-6">
              <div className="text-white/60">Built for critical thinkers</div>
            </footer>
          </blockquote>
        </motion.div>
      </div>
    </section>
  )
}

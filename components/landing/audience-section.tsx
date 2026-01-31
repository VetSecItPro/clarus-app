"use client"

import { motion } from "framer-motion"

const personas = [
  {
    emoji: "\uD83D\uDD2C",
    title: "Researchers",
    description: "Track claims across sources. Build evidence libraries. Never lose a citation.",
  },
  {
    emoji: "\uD83C\uDFA4",
    title: "Content creators",
    description: "Consume 10x faster. Extract insights from competitors. Research in minutes, not hours.",
  },
  {
    emoji: "\uD83D\uDCBC",
    title: "Professionals",
    description: "Clear the newsletter backlog. Get through reports. Make decisions faster.",
  },
  {
    emoji: "\uD83D\uDCDA",
    title: "Students",
    description: "Understand lectures and papers. Prep for exams. Learn what matters.",
  },
]

export function AudienceSection() {
  return (
    <section className="py-20 px-6 border-t border-white/[0.04]">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-white/30 text-sm font-medium tracking-wide uppercase mb-4">
            Who it&apos;s for
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Built for people who learn
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {personas.map((persona, index) => (
            <motion.div
              key={persona.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.03] transition-all duration-300 text-center"
            >
              <span className="text-3xl mb-4 block">{persona.emoji}</span>
              <h3 className="text-base font-semibold text-white mb-2">
                {persona.title}
              </h3>
              <p className="text-white/40 text-sm leading-relaxed">
                {persona.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

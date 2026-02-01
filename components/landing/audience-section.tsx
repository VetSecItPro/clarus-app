"use client"

import { memo } from "react"
import { motion } from "framer-motion"

const personas = [
  {
    emoji: "\uD83D\uDD2C",
    title: "Researchers",
    bullets: [
      "Fact-check claims with AI-powered truth analysis",
      "Save analyses to a searchable library",
      "Export to markdown or PDF",
    ],
  },
  {
    emoji: "\uD83C\uDFA4",
    title: "Content creators",
    bullets: [
      "Break down long videos into key points",
      "Build a reference library of analyzed sources",
      "Chat with content to find specific details",
    ],
  },
  {
    emoji: "\uD83D\uDCBC",
    title: "Professionals",
    bullets: [
      "Get key takeaways from articles and reports",
      "Quality scores tell you what\u2019s worth reading",
      "Search your library for past insights",
    ],
  },
  {
    emoji: "\uD83D\uDCDA",
    title: "Students",
    bullets: [
      "Understand lecture videos with detailed breakdowns",
      "Identify the most important points for study",
      "Ask follow-up questions via chat",
    ],
  },
]

export const AudienceSection = memo(function AudienceSection() {
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
              <ul className="text-white/40 text-sm leading-relaxed space-y-1 text-left">
                {persona.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="text-white/20 shrink-0">&bull;</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
})

"use client"

import { memo } from "react"
import { motion } from "framer-motion"

const personas = [
  {
    emoji: "\uD83D\uDD2C",
    title: "Researchers",
    bullets: [
      "Cross-reference claims across your saved library",
      "Accuracy analysis helps separate fact from opinion",
      "Export analyses to markdown or PDF for your work",
    ],
  },
  {
    emoji: "\uD83C\uDFA4",
    title: "Podcast listeners",
    bullets: [
      "Speaker breakdowns show who said what, where identifiable",
      "Get the key arguments without the full 3-hour episode",
      "Chat to find when and where specific claims were made",
    ],
  },
  {
    emoji: "\uD83D\uDCBC",
    title: "Professionals",
    bullets: [
      "Quality scores help surface what\u2019s worth your time",
      "Tone detection highlights promotional vs. substantive content",
      "Weekly digest helps you stay current without the scroll",
    ],
  },
  {
    emoji: "\uD83D\uDCDA",
    title: "Students",
    bullets: [
      "Structured breakdowns help turn lectures into study guides",
      "Action items suggest concrete next steps",
      "Ask follow-up questions like a tutor for any content",
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

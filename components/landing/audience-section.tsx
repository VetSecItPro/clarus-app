"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Microscope, Headphones, Briefcase, GraduationCap } from "lucide-react"

const personas = [
  {
    icon: Microscope,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    title: "Researchers",
    bullets: [
      "Cross-reference claims across your saved library",
      "Accuracy analysis helps separate fact from opinion",
      "Export analyses to markdown or PDF for your work",
    ],
  },
  {
    icon: Headphones,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    title: "Podcast listeners",
    bullets: [
      "Speaker breakdowns show who said what, where identifiable",
      "Get the key arguments without the full 3-hour episode",
      "Chat to find when and where specific claims were made",
    ],
  },
  {
    icon: Briefcase,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    title: "Professionals",
    bullets: [
      "Quality scores help surface what\u2019s worth your time",
      "Tone detection highlights promotional vs. substantive content",
      "Weekly digest helps you stay current without the scroll",
    ],
  },
  {
    icon: GraduationCap,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
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
          <p className="text-white/50 text-sm font-medium tracking-wide uppercase mb-4">
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
              <div className={`w-12 h-12 rounded-xl border ${persona.color} flex items-center justify-center mx-auto mb-4`}>
                <persona.icon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">
                {persona.title}
              </h3>
              <ul className="text-white/60 text-sm leading-relaxed space-y-1 text-left">
                {persona.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="text-white/40 shrink-0">&bull;</span>
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

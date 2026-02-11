"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Quote } from "lucide-react"

const testimonials = [
  {
    quote: "I used to spend 3 hours screening podcast episodes. Now I get a verdict in under a minute and only listen to the ones that matter.",
    name: "Sarah K.",
    role: "Product Manager",
    highlight: "verdict in under a minute",
  },
  {
    quote: "The accuracy analysis changed how I consume news. I can see which claims are backed up and which are just opinion before I share anything.",
    name: "Marcus T.",
    role: "Journalist & Researcher",
    highlight: "which claims are backed up",
  },
  {
    quote: "As a grad student, Clarus turns 2-hour lectures into structured study guides. The chat feature is like having a tutor for every video I watch.",
    name: "Priya L.",
    role: "Graduate Student",
    highlight: "structured study guides",
  },
]

export const TestimonialSection = memo(function TestimonialSection() {
  return (
    <section className="py-20 px-6 border-t border-white/[0.04]">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-white/50 text-sm font-medium tracking-wide uppercase mb-4">
            What users say
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Trusted by researchers, students &amp; professionals
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, index) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.10] transition-colors"
            >
              <Quote className="w-5 h-5 text-[#1d9bf0]/40 mb-3" />
              <p className="text-white/70 text-sm leading-relaxed mb-5">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#1d9bf0]/15 border border-[#1d9bf0]/25 flex items-center justify-center text-[#1d9bf0] text-sm font-bold">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">{t.name}</p>
                  <p className="text-xs text-white/40">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
})

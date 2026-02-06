"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import {
  Zap, CheckCircle, MessageSquare, Library, Download,
  Mic, ScanEye, Share2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Zap,
    title: "6-section deep analysis",
    description: "Overview, assessment, takeaways, accuracy analysis, action items, and deep dive. Not just a summary, but a structured breakdown.",
  },
  {
    icon: CheckCircle,
    title: "Accuracy analysis",
    description: "Claims are surfaced and assessed as fact, opinion, or unsupported. Cross-reference them across your library to spot patterns.",
    badge: "Unique",
  },
  {
    icon: Mic,
    title: "Speaker attribution",
    description: "For podcasts and multi-speaker content, arguments are attributed to individual speakers where identifiable.",
    badge: "New",
  },
  {
    icon: ScanEye,
    title: "Tone detection",
    description: "Clarus identifies content tone (investigative, promotional, academic, conversational) and adjusts its analysis to match.",
  },
  {
    icon: MessageSquare,
    title: "Chat with content",
    description: "Ask follow-up questions about anything you've analyzed. Responses reference the source material directly.",
  },
  {
    icon: Library,
    title: "Personal library",
    description: "Searchable archive with tags, bookmarks, quality scores, and full-text search. Find any insight when you need it.",
  },
  {
    icon: Share2,
    title: "Share & export",
    description: "Share analyses via link. Export to Markdown or PDF. Weekly digest emails help you stay current.",
  },
  {
    icon: Download,
    title: "Works with most content",
    description: "YouTube, podcasts, articles, PDFs, and X posts. Publicly accessible content only. Paste the link and go.",
  },
]

export const FeatureGrid = memo(function FeatureGrid() {
  return (
    <section id="features" className="py-20 px-6 border-t border-white/[0.04]">
      <div className="max-w-4xl mx-auto">
        {/* Features section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-white/30 text-sm font-medium tracking-wide uppercase mb-4">
            What you get
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            More than summaries
          </h2>
        </motion.div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className={cn(
                "group relative p-6 rounded-2xl bg-white/[0.02] border hover:bg-white/[0.03] transition-all duration-300",
                feature.badge
                  ? "border-[#1d9bf0]/20 hover:border-[#1d9bf0]/40"
                  : "border-white/[0.04] hover:border-white/[0.08]"
              )}
            >
              {feature.badge && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#1d9bf0]/15 text-[#1d9bf0]">
                  {feature.badge}
                </span>
              )}
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#1d9bf0]/10 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-[#1d9bf0]" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-white/40 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
})

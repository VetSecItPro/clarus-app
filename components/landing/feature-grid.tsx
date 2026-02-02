"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import {
  Youtube, FileText, FileUp, Headphones,
  Zap, CheckCircle, MessageSquare, Library, Download,
  Mic, ScanEye, Share2,
} from "lucide-react"

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
import { cn } from "@/lib/utils"

const contentTypes = [
  { icon: Youtube, title: "YouTube", color: "text-red-400", bg: "bg-red-500/10" },
  { icon: Headphones, title: "Podcasts", color: "text-purple-400", bg: "bg-purple-500/10" },
  { icon: FileText, title: "Articles & Blogs", color: "text-blue-400", bg: "bg-blue-500/10" },
  { icon: FileUp, title: "PDFs & Documents", color: "text-orange-400", bg: "bg-orange-500/10" },
  { icon: XIcon, title: "X Posts", color: "text-white/70", bg: "bg-white/[0.06]" },
]

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
          <div className="flex flex-wrap justify-center gap-3">
            {contentTypes.map((type, index) => (
              <motion.div
                key={type.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.04 }}
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

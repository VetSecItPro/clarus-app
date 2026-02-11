"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import {
  ShieldCheck, CheckCircle, MessageSquare, Library, Download,
  Mic, ScanEye, Share2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: ShieldCheck,
    title: "Skip, Skim, or Dive In",
    description: "Every analysis starts with a verdict — Skip, Skim, Worth It, or Must See — so you know where to spend your time.",
    badge: "Core",
    span: true,
  },
  {
    icon: CheckCircle,
    title: "Accuracy analysis",
    description: "Claims are surfaced and labeled as fact, opinion, or unsupported. Spot patterns across your library over time.",
    badge: "Unique",
    span: true,
  },
  {
    icon: Mic,
    title: "Speaker attribution",
    description: "For podcasts and multi-speaker content, know who said what. Arguments are attributed to individual speakers.",
    badge: "Podcast",
  },
  {
    icon: ScanEye,
    title: "Tone detection",
    description: "Is it investigative, promotional, academic, or conversational? Clarus detects the tone so you can read accordingly.",
  },
  {
    icon: MessageSquare,
    title: "Chat with your content",
    description: "Ask follow-up questions about anything you've analyzed. Responses reference the source material directly.",
    badge: "Interactive",
  },
  {
    icon: Library,
    title: "Personal library",
    description: "Searchable archive with tags, bookmarks, and quality scores. Full-text search finds any insight when you need it.",
  },
  {
    icon: Share2,
    title: "Share & export",
    description: "Share analyses via link. Export to Markdown or PDF. Weekly digest emails keep you current without the scroll.",
  },
  {
    icon: Download,
    title: "Videos, podcasts & more",
    description: "YouTube, podcast episodes, articles, PDFs, and X posts. If it's publicly accessible, paste the link and go.",
  },
]

export const FeatureGrid = memo(function FeatureGrid() {
  return (
    <section id="features" className="py-20 px-6 border-t border-white/[0.04]">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-white/50 text-sm font-medium tracking-wide uppercase mb-4">
            What you get
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Analysis, not just summaries
          </h2>
        </motion.div>

        {/* Bento grid — featured items span 2 cols on large screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className={cn(
                "group relative rounded-2xl bg-white/[0.02] border hover:bg-white/[0.03] transition-all duration-300",
                feature.badge
                  ? "border-[#1d9bf0]/20 hover:border-[#1d9bf0]/40 p-6 lg:p-8"
                  : "border-white/[0.04] hover:border-white/[0.08] p-6",
                feature.span && "sm:col-span-2"
              )}
            >
              {feature.badge && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#1d9bf0]/15 text-[#1d9bf0]">
                  {feature.badge}
                </span>
              )}
              <div className={cn(
                "flex-shrink-0 rounded-xl bg-[#1d9bf0]/10 flex items-center justify-center mb-4",
                feature.badge ? "w-12 h-12" : "w-10 h-10"
              )}>
                <feature.icon className={cn(
                  "text-[#1d9bf0]",
                  feature.badge ? "w-6 h-6" : "w-5 h-5"
                )} />
              </div>
              <h3 className={cn(
                "font-semibold text-white mb-2",
                feature.badge ? "text-xl" : "text-lg"
              )}>
                {feature.title}
              </h3>
              <p className={cn(
                "text-white/60 leading-relaxed",
                feature.badge ? "text-base max-w-md" : "text-sm"
              )}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
})

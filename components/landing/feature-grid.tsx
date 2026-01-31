"use client"

import { motion } from "framer-motion"
import {
  Youtube, FileText, FileUp, Brain, Headphones,
  GraduationCap,
  Zap, CheckCircle, MessageSquare, Library, Download, MailIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const contentTypes = [
  { icon: Youtube, title: "YouTube", color: "text-red-400", bg: "bg-red-500/10", status: "live" as const },
  { icon: FileText, title: "Articles & Blogs", color: "text-blue-400", bg: "bg-blue-500/10", status: "live" as const },
  { icon: FileUp, title: "PDFs & Documents", color: "text-orange-400", bg: "bg-orange-500/10", status: "live" as const },
  { icon: Brain, title: "X Posts", color: "text-teal-400", bg: "bg-teal-500/10", status: "live" as const },
  { icon: Headphones, title: "Podcasts", color: "text-purple-400", bg: "bg-purple-500/10", status: "coming" as const },
  { icon: GraduationCap, title: "Research Papers", color: "text-amber-400", bg: "bg-amber-500/10", status: "coming" as const },
]

const features = [
  {
    icon: Zap,
    title: "Instant breakdown",
    description: "Key points extracted in seconds. Main arguments identified. No fluff, no filler.",
  },
  {
    icon: CheckCircle,
    title: "Claim tracking",
    description: "See what's fact, opinion, or unsupported. Track claims across everything you save.",
    badge: "Unique",
  },
  {
    icon: MessageSquare,
    title: "Chat with content",
    description: "Ask questions about anything you've saved. Get answers with citations from the source.",
  },
  {
    icon: Library,
    title: "Personal library",
    description: "Searchable archive of everything you've analyzed. Find any insight instantly.",
  },
  {
    icon: MailIcon,
    title: "Weekly digest",
    description: "Email summary of your saved insights. Stay sharp without the scroll.",
  },
  {
    icon: Download,
    title: "Export anywhere",
    description: "Markdown, PDF, or Notion. Your notes, your format. Your data stays yours.",
  },
]

export function FeatureGrid() {
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
                className={cn(
                  "flex items-center gap-3 px-5 py-3 rounded-full bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors",
                  type.status === "coming" && "opacity-50"
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", type.bg)}>
                  <type.icon className={cn("w-4 h-4", type.color)} />
                </div>
                <span className="text-white/70 font-medium">{type.title}</span>
                {type.status === "coming" && (
                  <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Soon</span>
                )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
}

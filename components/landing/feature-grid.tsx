"use client"

import { motion } from "framer-motion"
import { Youtube, FileText, Twitter, Brain, Zap, Clock, Shield, BarChart3, FileUp } from "lucide-react"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Youtube,
    title: "YouTube Videos",
    description: "Drop a video link and instantly get the transcript, key takeaways, and timestamps. Then chat about anything in the video.",
    gradient: "from-red-500/20 to-red-500/5",
    iconBg: "bg-red-500/10",
    iconColor: "text-red-400",
    glowColor: "group-hover:shadow-red-500/20",
  },
  {
    icon: FileText,
    title: "Articles & Blogs",
    description: "Paste any article and get an instant summary with the main points. Ask follow-up questions and dive deeper into any topic.",
    gradient: "from-blue-500/20 to-blue-500/5",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
    glowColor: "group-hover:shadow-blue-500/20",
  },
  {
    icon: FileUp,
    title: "PDF Documents",
    description: "Upload any PDF and chat with it. Research papers, reports, ebooks - ask questions and get answers from your documents.",
    gradient: "from-orange-500/20 to-orange-500/5",
    iconBg: "bg-orange-500/10",
    iconColor: "text-orange-400",
    glowColor: "group-hover:shadow-orange-500/20",
  },
  {
    icon: Brain,
    title: "Chat With Your Content",
    description: "Every piece of content becomes a conversation. Ask questions, get explanations, and explore ideas with AI assistance.",
    gradient: "from-teal-500/20 to-teal-500/5",
    iconBg: "bg-teal-500/10",
    iconColor: "text-teal-400",
    glowColor: "group-hover:shadow-teal-500/20",
  },
]

const secondaryFeatures = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Fast AI-powered analysis",
  },
  {
    icon: Clock,
    title: "24/7 Available",
    description: "Analyze content anytime",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your data stays private",
  },
  {
    icon: BarChart3,
    title: "Detailed Reports",
    description: "Comprehensive analysis",
  },
]

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
}

const iconVariants = {
  initial: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.1,
    rotate: [0, -5, 5, 0],
    transition: { duration: 0.4 }
  },
}

export function FeatureGrid() {
  return (
    <section id="features" className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Everything you need to{" "}
            <span className="gradient-text">understand content</span>
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Powerful AI tools to summarize, analyze, and chat with any content you find online
          </p>
        </motion.div>

        {/* Main Feature Grid - 4 columns on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              custom={index}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={cardVariants}
              whileHover={{
                y: -4,
                transition: { duration: 0.2, ease: "easeOut" }
              }}
              className={cn(
                "feature-card group relative p-5 rounded-2xl border border-white/[0.06]",
                "bg-gradient-to-br backdrop-blur-xl cursor-pointer",
                feature.gradient,
                "hover:border-white/[0.15] transition-all duration-300"
              )}
            >
              <motion.div
                variants={iconVariants}
                initial="initial"
                whileHover="hover"
                className={cn(
                  "relative w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                  feature.iconBg
                )}
              >
                <feature.icon className={cn("w-5 h-5", feature.iconColor)} />
              </motion.div>
              <h3 className="relative text-base font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="relative text-white/50 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Secondary features row - more compact */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-10">
          {secondaryFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{
                delay: 0.4 + index * 0.1,
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="flex items-center gap-2 text-white/50 hover:text-white/70 transition-colors"
            >
              <feature.icon className="w-4 h-4 text-[#1d9bf0]" />
              <span className="text-sm font-medium">{feature.title}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

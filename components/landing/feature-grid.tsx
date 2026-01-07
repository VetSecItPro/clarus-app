"use client"

import { motion } from "framer-motion"
import { Youtube, FileText, Twitter, Brain, Zap, Clock, Shield, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Youtube,
    title: "YouTube Analysis",
    description: "Drop a video link and we'll pull the transcript, check claims for accuracy with timestamps, and tell you what's actually worth remembering.",
    gradient: "from-red-500/20 to-red-500/5",
    iconBg: "bg-red-500/10",
    iconColor: "text-red-400",
    glowColor: "group-hover:shadow-red-500/20",
  },
  {
    icon: FileText,
    title: "Article Scanner",
    description: "Paste any article URL and we'll break it down for you: what's true, what's spin, and whether it's worth your time.",
    gradient: "from-blue-500/20 to-blue-500/5",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
    glowColor: "group-hover:shadow-blue-500/20",
  },
  {
    icon: Twitter,
    title: "X Post Verification",
    description: "See a tweet that seems off? We'll analyze the claims and give you the full picture before you hit repost.",
    gradient: "from-white/10 to-white/5",
    iconBg: "bg-white/10",
    iconColor: "text-white",
    glowColor: "group-hover:shadow-white/10",
  },
  {
    icon: Brain,
    title: "Worth Your Time?",
    description: "Every piece of content gets a signal-to-noise score. Basically, is this actually useful or just filler? We'll tell you upfront.",
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
            <span className="gradient-text">verify content</span>
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Powerful tools designed to help you cut through misinformation and find the truth
          </p>
        </motion.div>

        {/* Main Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              custom={index}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={cardVariants}
              whileHover={{
                y: -8,
                transition: { duration: 0.3, ease: "easeOut" }
              }}
              className={cn(
                "feature-card group relative p-8 rounded-3xl border border-white/[0.08]",
                "bg-gradient-to-br backdrop-blur-xl cursor-pointer",
                feature.gradient,
                "hover:border-white/[0.2] transition-all duration-300",
                "shadow-lg shadow-transparent",
                feature.glowColor,
                "group-hover:shadow-2xl"
              )}
            >
              {/* Animated glow effect on hover */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <motion.div
                variants={iconVariants}
                initial="initial"
                whileHover="hover"
                className={cn(
                  "relative w-14 h-14 rounded-2xl flex items-center justify-center mb-6",
                  feature.iconBg,
                  "transition-shadow duration-300"
                )}
              >
                <feature.icon className={cn("w-7 h-7", feature.iconColor)} />
              </motion.div>
              <h3 className="relative text-2xl font-semibold text-white mb-3 group-hover:text-white transition-colors">
                {feature.title}
              </h3>
              <p className="relative text-white/50 text-lg leading-relaxed group-hover:text-white/60 transition-colors">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Secondary features row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {secondaryFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{
                delay: 0.4 + index * 0.1,
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1]
              }}
              whileHover={{
                y: -4,
                scale: 1.02,
                transition: { duration: 0.2 }
              }}
              className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#1d9bf0]/30 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group"
            >
              <motion.div
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <feature.icon className="w-6 h-6 text-[#1d9bf0] mb-3 group-hover:text-[#1d9bf0] transition-colors" />
              </motion.div>
              <h4 className="text-white font-medium mb-1 group-hover:text-white transition-colors">{feature.title}</h4>
              <p className="text-white/40 text-sm group-hover:text-white/50 transition-colors">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

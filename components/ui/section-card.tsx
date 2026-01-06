"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { ReactNode } from "react"

interface SectionCardProps {
  title: string
  children: ReactNode
  isLoading?: boolean
  delay?: number
  icon?: ReactNode
  headerColor?: "blue" | "amber" | "emerald" | "yellow" | "orange" | "violet" | "cyan"
  minContentHeight?: string // Ensures consistent card height during loading
}

const headerColorStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  blue: {
    bg: "bg-blue-500/15",
    border: "border-blue-500/20",
    text: "text-blue-300",
    icon: "text-blue-400",
  },
  amber: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/20",
    text: "text-amber-300",
    icon: "text-amber-400",
  },
  emerald: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/20",
    text: "text-emerald-300",
    icon: "text-emerald-400",
  },
  yellow: {
    bg: "bg-yellow-500/15",
    border: "border-yellow-500/20",
    text: "text-yellow-300",
    icon: "text-yellow-400",
  },
  orange: {
    bg: "bg-orange-500/15",
    border: "border-orange-500/20",
    text: "text-orange-300",
    icon: "text-orange-400",
  },
  violet: {
    bg: "bg-violet-500/15",
    border: "border-violet-500/20",
    text: "text-violet-300",
    icon: "text-violet-400",
  },
  cyan: {
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/20",
    text: "text-cyan-300",
    icon: "text-cyan-400",
  },
}

export function SectionCard({ title, children, isLoading, delay = 0, icon, headerColor, minContentHeight }: SectionCardProps) {
  const colors = headerColor ? headerColorStyles[headerColor] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden"
    >
      <div className={`px-4 sm:px-5 py-3 sm:py-4 border-b flex items-center justify-between ${colors ? `${colors.bg} ${colors.border}` : "border-white/[0.08]"}`}>
        <h3 className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-2 ${colors ? colors.text : "text-white/70"}`}>
          {icon && <span className={colors ? colors.icon : "text-white/50"}>{icon}</span>}
          {title}
        </h3>
        {isLoading && (
          <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
        )}
      </div>
      <div
        className="px-4 sm:px-5 py-4 sm:py-5"
        style={minContentHeight ? { minHeight: minContentHeight, display: 'flex', flexDirection: 'column' } : undefined}
      >
        <div className="flex-1">
          {children}
        </div>
      </div>
    </motion.div>
  )
}

export function SectionSkeleton({ lines = 3, minHeight }: { lines?: number; minHeight?: string }) {
  return (
    <div className="space-y-3 animate-pulse" style={{ minHeight }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-white/[0.08] rounded-lg"
          style={{ width: `${100 - (i % 3) * 10}%` }}
        />
      ))}
    </div>
  )
}

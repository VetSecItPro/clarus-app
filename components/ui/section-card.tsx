"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { ReactNode } from "react"

type HeaderColor = "blue" | "amber" | "emerald" | "yellow" | "violet" | "orange" | "default"

interface SectionCardProps {
  title: string
  children: ReactNode
  isLoading?: boolean
  delay?: number
  icon?: ReactNode
  headerColor?: HeaderColor
}

const headerColorStyles: Record<HeaderColor, { bg: string; border: string; text: string }> = {
  blue: {
    bg: "bg-blue-500/15",
    border: "border-blue-500/20",
    text: "text-blue-300",
  },
  amber: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/20",
    text: "text-amber-300",
  },
  emerald: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/20",
    text: "text-emerald-300",
  },
  yellow: {
    bg: "bg-yellow-500/15",
    border: "border-yellow-500/20",
    text: "text-yellow-300",
  },
  violet: {
    bg: "bg-violet-500/15",
    border: "border-violet-500/20",
    text: "text-violet-300",
  },
  orange: {
    bg: "bg-orange-500/15",
    border: "border-orange-500/20",
    text: "text-orange-300",
  },
  default: {
    bg: "",
    border: "border-white/[0.06]",
    text: "text-white/80",
  },
}

export function SectionCard({ title, children, isLoading, delay = 0, icon, headerColor = "default" }: SectionCardProps) {
  const colorStyle = headerColorStyles[headerColor]

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden"
    >
      <div className={`px-4 sm:px-5 py-3 sm:py-4 border-b ${colorStyle.border} ${colorStyle.bg} flex items-center justify-between`}>
        <h3 className={`text-sm font-semibold ${colorStyle.text} uppercase tracking-wider flex items-center gap-2`}>
          {icon}
          {title}
        </h3>
        {isLoading && (
          <Loader2 className="w-4 h-4 text-[#1d9bf0] animate-spin" />
        )}
      </div>
      <div className="px-4 sm:px-5 py-4 sm:py-5">
        {children}
      </div>
    </motion.div>
  )
}

export function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-white/[0.08] rounded-lg"
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
    </div>
  )
}

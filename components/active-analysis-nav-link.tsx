"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useActiveAnalysis } from "@/lib/contexts/active-analysis-context"

interface ActiveAnalysisNavLinkProps {
  variant: "desktop" | "mobile"
}

export function ActiveAnalysisNavLink({ variant }: ActiveAnalysisNavLinkProps) {
  const { activeAnalysis, isComplete } = useActiveAnalysis()
  const pathname = usePathname()

  if (!activeAnalysis) return null

  const href = `/item/${activeAnalysis.contentId}`
  const isActive = pathname === href

  if (variant === "mobile") {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <Link
            href={href}
            prefetch={true}
            className="relative flex flex-col items-center justify-center flex-1 h-full group"
          >
            <div
              className={cn(
                "flex flex-col items-center transition-all duration-200",
                isActive
                  ? "text-brand"
                  : isComplete
                    ? "text-white/50 group-active:text-white/70"
                    : "text-brand"
              )}
            >
              {isComplete ? (
                <Sparkles className={cn("w-6 h-6 transition-transform duration-200", isActive && "scale-110")} />
              ) : (
                <Loader2 className="w-6 h-6 animate-spin" />
              )}
              <span className={cn(
                "text-[0.6875rem] mt-1 font-medium transition-opacity duration-200",
                isActive ? "opacity-100" : "opacity-70"
              )}>
                {isComplete ? "Current" : "Analyzing"}
              </span>
            </div>
            {/* Active indicator dot */}
            {isActive && (
              <div
                className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand"
              />
            )}
          </Link>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Desktop variant
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, width: 0 }}
        animate={{ opacity: 1, width: "auto" }}
        exit={{ opacity: 0, width: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex items-stretch"
      >
        <Link
          href={href}
          prefetch={true}
          className="relative px-4 py-2 group flex items-center"
        >
          <div
            className={cn(
              "flex items-center gap-2 transition-all duration-200",
              isActive
                ? "text-white"
                : isComplete
                  ? "text-white/50 group-hover:text-white/90"
                  : "text-brand"
            )}
          >
            {isComplete ? (
              <Sparkles className={cn(
                "w-4 h-4 transition-colors duration-200",
                isActive ? "text-brand" : "group-hover:text-brand/70"
              )} />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin text-brand" />
            )}
            <span className="text-sm font-medium whitespace-nowrap">
              {isComplete ? "Current" : "Analyzing..."}
            </span>
          </div>
          {/* Animated underline — match active state behavior of sibling nav links */}
          <div
            className={cn(
              "absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-gradient-to-r from-brand to-[#06b6d4] rounded-full transition-all duration-300",
              isActive
                ? "w-8 opacity-100"
                : isComplete
                  ? "w-0 opacity-0 group-hover:w-6 group-hover:opacity-60"
                  : "w-8 opacity-100 animate-pulse"
            )}
          />
        </Link>
      </motion.div>
    </AnimatePresence>
  )
}

"use client"

import Link from "next/link"
import { Loader2, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useActiveAnalysis } from "@/lib/contexts/active-analysis-context"

interface ActiveAnalysisNavLinkProps {
  variant: "desktop" | "mobile"
}

export function ActiveAnalysisNavLink({ variant }: ActiveAnalysisNavLinkProps) {
  const { activeAnalysis, isComplete } = useActiveAnalysis()

  if (!activeAnalysis) return null

  const href = `/item/${activeAnalysis.contentId}`

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
                isComplete
                  ? "text-white"
                  : "text-brand"
              )}
            >
              {isComplete ? (
                <Sparkles className="w-6 h-6" />
              ) : (
                <Loader2 className="w-6 h-6 animate-spin" />
              )}
              <span className="text-[0.6875rem] mt-1 font-medium opacity-100">
                {isComplete ? "Current" : "Analyzing"}
              </span>
            </div>
            {/* Active indicator dot */}
            <div
              className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand"
            />
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
      >
        <Link
          href={href}
          prefetch={true}
          className="relative px-4 py-2 group"
        >
          <div
            className={cn(
              "flex items-center gap-2 transition-all duration-200",
              isComplete
                ? "text-white"
                : "text-brand"
            )}
          >
            {isComplete ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            <span className="text-sm font-medium whitespace-nowrap">
              {isComplete ? "Current" : "Analyzing..."}
            </span>
          </div>
          {/* Animated underline */}
          <div
            className={cn(
              "absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full w-8 opacity-100 transition-colors duration-300",
              isComplete
                ? "bg-gradient-to-r from-brand to-[#06b6d4]"
                : "bg-gradient-to-r from-brand to-[#06b6d4] animate-pulse"
            )}
          />
        </Link>
      </motion.div>
    </AnimatePresence>
  )
}

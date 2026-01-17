"use client"

import { motion } from "framer-motion"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface AnalysisErrorProps {
  message: string
  onRetry?: () => void
  isRetrying?: boolean
}

export function AnalysisError({ message, onRetry, isRetrying = false }: AnalysisErrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex gap-3 max-w-xl mx-auto"
    >
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center">
        <AlertTriangle className="w-4 h-4 text-red-400" />
      </div>
      <div className="flex-1 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20">
        <p className="text-sm text-red-300 mb-2">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Retrying..." : "Try Again"}
          </button>
        )}
      </div>
    </motion.div>
  )
}

"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Check } from "lucide-react"
import { MODE_OPTIONS, type AnalysisMode } from "@/lib/analysis-modes"

interface AnalysisModeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMode: AnalysisMode
  onModeChange: (mode: AnalysisMode) => void
}

export function AnalysisModeSheet({ open, onOpenChange, selectedMode, onModeChange }: AnalysisModeSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={() => onOpenChange(false)}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label="Select analysis mode"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[#111] border-t border-white/[0.1] pb-safe"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="px-5 pb-6">
              <h3 className="text-sm font-semibold text-white mb-4">Analysis Mode</h3>

              <div className="space-y-1">
                {MODE_OPTIONS.map((mode) => {
                  const Icon = mode.icon
                  const isActive = mode.id === selectedMode
                  return (
                    <button
                      key={mode.id}
                      onClick={() => onModeChange(mode.id)}
                      className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/[0.06] transition-colors text-left"
                    >
                      <div className={`p-2 rounded-lg ${isActive ? "bg-brand/15" : "bg-white/[0.06]"}`}>
                        <Icon className={`w-4 h-4 ${isActive ? "text-brand" : "text-white/50"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${isActive ? "text-brand" : "text-white/90"}`}>
                          {mode.label}
                        </div>
                        <div className="text-xs text-white/50">{mode.description}</div>
                      </div>
                      {isActive && (
                        <Check className="w-4 h-4 text-brand shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

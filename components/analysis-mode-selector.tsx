"use client"

import { useState } from "react"
import { Lock, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { MODE_OPTIONS, getModeOption, type AnalysisMode } from "@/lib/analysis-modes"
import { AnalysisModeSheet } from "@/components/analysis-mode-sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface AnalysisModeSelectorProps {
  selectedMode: AnalysisMode
  onModeChange: (mode: AnalysisMode) => void
  isLocked?: boolean
}

export function AnalysisModeSelector({ selectedMode, onModeChange, isLocked }: AnalysisModeSelectorProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const activeOption = getModeOption(selectedMode)

  return (
    <>
      {/* Desktop/Tablet: Horizontal pill row with tooltips */}
      <TooltipProvider delayDuration={200}>
        <div className="hidden sm:flex items-center gap-1.5">
          {MODE_OPTIONS.map((mode) => {
            const Icon = mode.icon
            const isActive = mode.id === selectedMode
            return (
              <Tooltip key={mode.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => !isLocked && onModeChange(mode.id)}
                    disabled={isLocked}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all",
                      "border",
                      isActive
                        ? "bg-brand/10 border-brand/30 text-brand"
                        : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/70 hover:bg-white/[0.06]",
                      isLocked && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {isLocked ? (
                      <Lock className="w-3 h-3" />
                    ) : (
                      <Icon className="w-3 h-3" />
                    )}
                    <span>{mode.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {isLocked ? "Upgrade to Starter to customize" : mode.description}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>

      {/* Mobile: Single compact chip */}
      <button
        onClick={() => !isLocked ? setSheetOpen(true) : undefined}
        disabled={isLocked}
        className={cn(
          "sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
          "border",
          "bg-brand/10 border-brand/30 text-brand",
          isLocked && "opacity-40 cursor-not-allowed"
        )}
      >
        {isLocked ? (
          <Lock className="w-3 h-3" />
        ) : (
          <activeOption.icon className="w-3 h-3" />
        )}
        <span>{activeOption.label}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {/* Mobile bottom sheet */}
      <AnalysisModeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedMode={selectedMode}
        onModeChange={(mode) => {
          onModeChange(mode)
          setSheetOpen(false)
        }}
      />
    </>
  )
}

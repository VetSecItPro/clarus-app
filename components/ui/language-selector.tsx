"use client"

import { useState, useRef, useEffect } from "react"
import { Languages, Lock, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SUPPORTED_LANGUAGES,
  type AnalysisLanguage,
  type LanguageConfig,
  getLanguageConfig,
} from "@/lib/languages"

interface LanguageSelectorProps {
  value: AnalysisLanguage
  onValueChange: (language: AnalysisLanguage) => void
  /** Whether non-English languages are unlocked (paid tier) */
  multiLanguageEnabled: boolean
  disabled?: boolean
  /** Compact mode for inline use in input bar */
  compact?: boolean
  /** Direction the dropdown opens. Default "up" for chat bar, "down" for nav bar. */
  dropdownDirection?: "up" | "down"
}

export function LanguageSelector({
  value,
  onValueChange,
  multiLanguageEnabled,
  disabled = false,
  compact = false,
  dropdownDirection = "up",
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const current = getLanguageConfig(value)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  const handleSelect = (lang: LanguageConfig) => {
    if (lang.code !== "en" && !multiLanguageEnabled) return
    onValueChange(lang.code)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      {/* Trigger — pill-shaped button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 rounded-full transition-all",
          compact
            ? "h-8 px-2.5 text-white/60 hover:text-white/90 hover:bg-white/[0.06]"
            : "h-9 px-3 bg-white/[0.06] border border-white/[0.1] text-white/70 hover:text-white hover:border-white/20",
          isOpen && !compact && "border-white/20 text-white",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        aria-label={`Translate analysis. Current language: ${current.name}. Click to change.`}
        aria-expanded={isOpen}
      >
        <Languages className={cn("shrink-0", compact ? "w-3.5 h-3.5" : "w-3.5 h-3.5")} />
        <span className={cn("font-medium whitespace-nowrap", compact ? "text-[0.625rem]" : "text-xs")}>
          {current.flag} {compact ? current.name : `Translate`}
        </span>
        {!compact && (
          <ChevronDown className={cn(
            "w-3 h-3 shrink-0 transition-transform",
            isOpen && "rotate-180"
          )} />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={cn(
          "absolute right-0 z-50 w-52 rounded-xl bg-zinc-900 border border-white/[0.1] shadow-xl overflow-hidden",
          dropdownDirection === "up" ? "bottom-full mb-2" : "top-full mt-2"
        )}>
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <p className="text-[0.6875rem] font-medium text-white/40 uppercase tracking-wider">
              Translate Analysis
            </p>
          </div>
          <div className="max-h-[280px] overflow-y-auto py-1">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isLocked = lang.code !== "en" && !multiLanguageEnabled
              const isSelected = lang.code === value
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang)}
                  disabled={isLocked}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                    isSelected
                      ? "bg-brand/10 text-white"
                      : isLocked
                        ? "text-white/25 cursor-not-allowed"
                        : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <span className="text-base leading-none">{lang.flag}</span>
                  <span className="flex-1 text-sm">{lang.nativeName}</span>
                  {isLocked && (
                    <Lock className="w-3 h-3 text-white/20" />
                  )}
                  {isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                  )}
                </button>
              )
            })}
          </div>
          {!multiLanguageEnabled && (
            <div className="px-3 py-2 border-t border-white/[0.06] bg-white/[0.02]">
              <p className="text-[0.625rem] text-white/30">
                Multi-language requires Starter plan or higher.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

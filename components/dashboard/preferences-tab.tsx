"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
  BookOpen, Zap, Microscope, Sparkles, Film,
  Lock, Loader2, Check, Power,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type AnalysisMode = "learn" | "apply" | "evaluate" | "discover" | "create"
type ExpertiseLevel = "beginner" | "intermediate" | "expert"
type FocusArea = "accuracy" | "takeaways" | "efficiency" | "depth" | "bias" | "novelty"

interface Preferences {
  analysis_mode: AnalysisMode
  expertise_level: ExpertiseLevel
  focus_areas: FocusArea[]
  is_active: boolean
}

const MODE_OPTIONS: { id: AnalysisMode; label: string; description: string; icon: typeof BookOpen }[] = [
  { id: "learn", label: "Learn", description: "Help me understand this", icon: BookOpen },
  { id: "apply", label: "Apply", description: "Help me use this", icon: Zap },
  { id: "evaluate", label: "Evaluate", description: "Help me assess this critically", icon: Microscope },
  { id: "discover", label: "Discover", description: "Give me the highlights", icon: Sparkles },
  { id: "create", label: "Create", description: "Help me learn as a creator", icon: Film },
]

const EXPERTISE_OPTIONS: { id: ExpertiseLevel; label: string; description: string }[] = [
  { id: "beginner", label: "Beginner", description: "I'm new to most topics" },
  { id: "intermediate", label: "Intermediate", description: "I know the basics" },
  { id: "expert", label: "Expert", description: "I have deep domain knowledge" },
]

const FOCUS_OPTIONS: { id: FocusArea; label: string; description: string }[] = [
  { id: "accuracy", label: "Accuracy", description: "Are the claims true?" },
  { id: "takeaways", label: "Takeaways", description: "What should I remember?" },
  { id: "efficiency", label: "Efficiency", description: "Keep it concise" },
  { id: "depth", label: "Depth", description: "Go deep, full picture" },
  { id: "bias", label: "Bias", description: "What's the angle?" },
  { id: "novelty", label: "Novelty", description: "What's actually new?" },
]

const DEFAULT_PREFS: Preferences = {
  analysis_mode: "apply",
  expertise_level: "intermediate",
  focus_areas: ["takeaways", "accuracy"],
  is_active: true,
}

interface PreferencesTabProps {
  hasAccess: boolean
}

export function PreferencesTab({ hasAccess }: PreferencesTabProps) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch("/api/preferences")
      const data = await res.json()
      if (res.ok && data.preferences) {
        setPrefs({
          analysis_mode: data.preferences.analysis_mode ?? "apply",
          expertise_level: data.preferences.expertise_level ?? "intermediate",
          focus_areas: data.preferences.focus_areas ?? ["takeaways", "accuracy"],
          is_active: data.preferences.is_active ?? true,
        })
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasAccess) fetchPreferences()
    else setLoading(false)
  }, [hasAccess, fetchPreferences])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
      if (res.ok) {
        toast.success("Preferences saved — your next analysis will reflect these.")
        setDirty(false)
      } else {
        const data = await res.json()
        toast.error(data.error ?? "Failed to save preferences")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const updatePref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const toggleFocus = (area: FocusArea) => {
    setPrefs((prev) => {
      const current = prev.focus_areas
      if (current.includes(area)) {
        return { ...prev, focus_areas: current.filter((a) => a !== area) }
      }
      if (current.length >= 3) return prev // Max 3
      return { ...prev, focus_areas: [...current, area] }
    })
    setDirty(true)
  }

  // Locked state for free users
  if (!hasAccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16 px-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-white/30" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">
          Personalize Your Analysis
        </h2>
        <p className="text-white/50 text-sm max-w-md mx-auto mb-6">
          Choose your analysis mode — Learn, Apply, Evaluate, Discover, or
          Create — and Clarus adapts every analysis to how you consume content.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          Upgrade to Starter
        </Link>
      </motion.div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Enable/Disable toggle */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
      >
        <div className="flex items-center gap-3">
          <Power className="w-5 h-5 text-white/40" />
          <div>
            <p className="text-sm font-medium text-white">Use custom preferences</p>
            <p className="text-xs text-white/40">When off, analysis uses default settings</p>
          </div>
        </div>
        <button
          onClick={() => updatePref("is_active", !prefs.is_active)}
          className={cn(
            "relative w-11 h-6 rounded-full transition-colors",
            prefs.is_active ? "bg-[#1d9bf0]" : "bg-white/10"
          )}
        >
          <div
            className={cn(
              "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
              prefs.is_active ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>
      </motion.div>

      <div className={cn(prefs.is_active ? "" : "opacity-40 pointer-events-none")}>
        {/* Analysis Mode */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
            Analysis Mode
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MODE_OPTIONS.map((mode) => {
              const Icon = mode.icon
              const isSelected = prefs.analysis_mode === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => updatePref("analysis_mode", mode.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                    isSelected
                      ? "border-[#1d9bf0]/40 bg-[#1d9bf0]/[0.06] ring-1 ring-[#1d9bf0]/20"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 mt-0.5 shrink-0",
                      isSelected ? "text-[#1d9bf0]" : "text-white/30"
                    )}
                  />
                  <div>
                    <p className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-white" : "text-white/70"
                    )}>
                      {mode.label}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">{mode.description}</p>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-[#1d9bf0] ml-auto mt-0.5 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Expertise Level */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8"
        >
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
            Expertise Level
          </h3>
          <div className="flex flex-wrap gap-2">
            {EXPERTISE_OPTIONS.map((opt) => {
              const isSelected = prefs.expertise_level === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => updatePref("expertise_level", opt.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all",
                    isSelected
                      ? "border-[#1d9bf0]/40 bg-[#1d9bf0]/[0.06] text-white"
                      : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/[0.04]"
                  )}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#1d9bf0]" />}
                  <div className="text-left">
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-white/30 ml-1.5 hidden sm:inline">— {opt.description}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Focus Areas */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
              What Matters Most
            </h3>
            <span className="text-xs text-white/30">
              {prefs.focus_areas.length}/3 selected
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((opt) => {
              const isSelected = prefs.focus_areas.includes(opt.id)
              const isDisabled = !isSelected && prefs.focus_areas.length >= 3
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleFocus(opt.id)}
                  disabled={isDisabled}
                  className={cn(
                    "px-4 py-2 rounded-full border text-sm font-medium transition-all",
                    isSelected
                      ? "border-[#1d9bf0]/40 bg-[#1d9bf0]/10 text-[#1d9bf0]"
                      : isDisabled
                      ? "border-white/[0.04] bg-white/[0.01] text-white/20 cursor-not-allowed"
                      : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:bg-white/[0.04]"
                  )}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* Save button */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="pt-4 border-t border-white/[0.06]"
      >
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={cn(
            "w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-medium transition-all",
            dirty
              ? "bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white"
              : "bg-white/[0.06] text-white/30 cursor-not-allowed"
          )}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          ) : (
            "Save Preferences"
          )}
        </button>
        {!dirty && (
          <p className="text-xs text-white/30 mt-2">
            Make changes above, then save.
          </p>
        )}
      </motion.div>
    </div>
  )
}

/**
 * @module lib/analysis-modes
 * @description Shared analysis mode definitions used by the home page selector,
 * the preferences tab, and the item detail badge.
 *
 * Extracted from preferences-tab.tsx to avoid duplication between the
 * dashboard preferences and the home page mode selector.
 */

import { BookOpen, Zap, Microscope, Sparkles, Film, type LucideIcon } from "lucide-react"

export type AnalysisMode = "learn" | "apply" | "evaluate" | "discover" | "create"

export interface ModeOption {
  id: AnalysisMode
  label: string
  description: string
  icon: LucideIcon
}

export const MODE_OPTIONS: ModeOption[] = [
  { id: "learn", label: "Learn", description: "Help me understand this", icon: BookOpen },
  { id: "apply", label: "Apply", description: "Help me use this", icon: Zap },
  { id: "evaluate", label: "Evaluate", description: "Help me assess this critically", icon: Microscope },
  { id: "discover", label: "Discover", description: "Give me the highlights", icon: Sparkles },
  { id: "create", label: "Create", description: "Help me learn as a creator", icon: Film },
]

/** Look up a mode option by its ID. Falls back to "apply" if not found. */
export function getModeOption(id: AnalysisMode): ModeOption {
  return MODE_OPTIONS.find(m => m.id === id) ?? MODE_OPTIONS[1] // default: apply
}

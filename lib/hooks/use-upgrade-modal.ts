/**
 * @module use-upgrade-modal
 * @description State management hook for the upgrade prompt modal.
 *
 * Provides a simple open/close API for the upgrade modal that appears
 * when a user hits a tier limit. The modal receives context about which
 * feature was blocked and what tier is required, so the UI can show a
 * targeted upgrade message.
 *
 * @see {@link lib/tier-limits.ts} for limit definitions that trigger upgrades
 */

"use client"

import { useState, useCallback } from "react"
import type { UserTier } from "@/types/database.types"

/** The state passed to the upgrade modal UI component. */
export interface UpgradeModalState {
  isOpen: boolean
  feature: string
  currentTier: UserTier
  requiredTier?: "starter" | "pro"
  currentCount?: number
  limit?: number
}

const INITIAL_STATE: UpgradeModalState = {
  isOpen: false,
  feature: "",
  currentTier: "free",
}

/**
 * Manages the open/close state and context for the upgrade modal.
 *
 * @returns The current modal state plus `showUpgrade` and `close` callbacks
 *
 * @example
 * ```tsx
 * const { isOpen, feature, showUpgrade, close } = useUpgradeModal()
 * // Trigger from a limit check:
 * showUpgrade({ feature: "analyses", currentTier: "free", limit: 5, currentCount: 5 })
 * ```
 */
export function useUpgradeModal() {
  const [state, setState] = useState<UpgradeModalState>(INITIAL_STATE)

  const showUpgrade = useCallback((opts: Omit<UpgradeModalState, "isOpen">) => {
    setState({ ...opts, isOpen: true })
  }, [])

  const close = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return { ...state, showUpgrade, close }
}

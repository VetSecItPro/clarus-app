"use client"

import { useState, useCallback } from "react"
import type { UserTier } from "@/types/database.types"

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

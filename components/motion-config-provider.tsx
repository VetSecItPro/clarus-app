"use client"

import { MotionConfig } from "framer-motion"
import type { ReactNode } from "react"

export function MotionConfigProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

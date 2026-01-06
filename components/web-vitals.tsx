"use client"

import { useReportWebVitals } from "next/web-vitals"

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Log metrics to console in development only
    // Production analytics can be enabled by integrating with:
    // - Vercel Analytics (@vercel/analytics)
    // - Google Analytics
    // - Custom analytics endpoint
    if (process.env.NODE_ENV === "development") {
      console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}ms`)
    }
  })

  return null
}

"use client"

import { useReportWebVitals } from "next/web-vitals"

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Log metrics to console in development
    if (process.env.NODE_ENV === "development") {
      console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}ms`)
    }

    // Send to analytics in production
    // You can integrate with services like:
    // - Vercel Analytics (automatic with Next.js on Vercel)
    // - Google Analytics
    // - Custom analytics endpoint
    if (process.env.NODE_ENV === "production") {
      // Example: Send to custom analytics endpoint
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating, // 'good', 'needs-improvement', or 'poor'
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      })

      // Use sendBeacon for reliability on page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics/vitals", body)
      } else {
        fetch("/api/analytics/vitals", {
          body,
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        })
      }
    }
  })

  return null
}

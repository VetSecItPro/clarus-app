import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring: sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  integrations: [
    Sentry.browserTracingIntegration(),
  ],

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    // Network errors users can't control
    "Failed to fetch",
    "Load failed",
    "NetworkError",
    // React hydration (non-critical)
    "Hydration failed",
    "Text content does not match",
  ],
})

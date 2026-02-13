import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.ytimg.com' },
      { protocol: 'https', hostname: '*.youtube.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    // PERF: FIX-PERF-006 — enable tree-shaking for large packages
    optimizePackageImports: [
      // UI libraries
      'lucide-react',
      'framer-motion',
      'recharts',
      'sonner',
      'react-markdown',
      'remark-gfm',
      'cmdk',
      'class-variance-authority',
      'embla-carousel-react',
      // Radix UI primitives
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-scroll-area',
      // Data/utility libraries
      'date-fns',
      '@supabase/supabase-js',
      'react-hook-form',
      '@hookform/resolvers',
      // AI SDK
      '@ai-sdk/react',
    ],
    // PERF: increased staleTimes for faster page transitions on back/forward navigation
    staleTimes: {
      dynamic: 60,  // Cache dynamic pages for 60 seconds (was 30s — reduces redundant fetches on back nav)
      static: 300,  // Cache static pages for 5 minutes (was 3min — pricing/terms/privacy rarely change)
    },
    // Enable View Transitions API for smooth page transitions
    viewTransition: true,
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
}

export default withSentryConfig(nextConfig, {
  // Suppress source map upload warnings when SENTRY_AUTH_TOKEN is not set
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Tree-shake Sentry debug statements for smaller bundles
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },

  // Hide source maps from users
  hideSourceMaps: true,

  // Tunnel Sentry events to avoid ad blockers
  tunnelRoute: "/monitoring",
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns', 'recharts'],
    // Cache client-side navigations for faster page transitions
    staleTimes: {
      dynamic: 30,  // Cache dynamic pages for 30 seconds
      static: 180,  // Cache static pages for 3 minutes
    },
    // Enable View Transitions API for smooth page transitions
    viewTransition: true,
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
}

export default nextConfig

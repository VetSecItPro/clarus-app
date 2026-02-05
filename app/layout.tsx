import type React from "react"
import type { Metadata } from "next"
import { Inter, Cormorant_Garamond } from "next/font/google"
import { Analytics } from "@vercel/analytics/react"
import { Toaster } from "sonner"
import CookieConsent from "@/components/cookie-consent"
import { ConsentGate } from "@/components/consent-gate"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import { SWRProvider } from "@/components/swr-provider"
import { ActiveAnalysisProvider } from "@/lib/contexts/active-analysis-context"
import { WebVitals } from "@/components/web-vitals"
import "./globals.css"

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
})

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["700"],
  style: ["italic"],
  variable: "--font-cormorant",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Clarus — Get the point of any video or article in seconds",
  description: "Paste a link, get instant analysis. Key points, claims, takeaways. Chat with your content. Build a searchable library of everything you learn.",
  keywords: [
    "youtube summarizer",
    "article summarizer",
    "ai summary tool",
    "content analysis",
    "research tool",
    "claim tracking",
    "video summary",
    "podcast summary",
  ],
  metadataBase: new URL("https://clarusapp.io"),
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Clarus — Get the point of any video or article in seconds",
    description: "Paste a link, get instant analysis. Key points, claims, takeaways. Chat with your content. Build a searchable library of everything you learn.",
    siteName: "Clarus",
    type: "website",
    url: "https://clarusapp.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clarus — Get the point of any video or article in seconds",
    description: "Paste a link, get instant analysis. Key points, claims, takeaways.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Clarus",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true, // Allow zoom for accessibility
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} dark bg-[#0a0e1a]`}>
      <head>
        {/* Preconnect to critical external domains for faster resource loading */}
        <link rel="preconnect" href="https://srqmutgamvktxqmylied.supabase.co" />
        <link rel="dns-prefetch" href="https://srqmutgamvktxqmylied.supabase.co" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://openrouter.ai" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "name": "Clarus",
                  "url": "https://clarusapp.io",
                  "logo": "https://clarusapp.io/clarus-logo.webp",
                  "description": "AI-powered content analysis for videos, podcasts, articles, and PDFs. Fact-checking, summaries, and key takeaways in seconds.",
                  "foundingDate": "2025",
                  "sameAs": [],
                },
                {
                  "@type": "SoftwareApplication",
                  "name": "Clarus",
                  "url": "https://clarusapp.io",
                  "applicationCategory": "UtilitiesApplication",
                  "operatingSystem": "Web",
                  "description": "AI-powered YouTube video summarizer, podcast analyzer, article summarizer, and PDF analyzer with fact-checking, key takeaways, and a chat interface.",
                  "offers": [
                    {
                      "@type": "Offer",
                      "name": "Free",
                      "price": "0",
                      "priceCurrency": "USD",
                      "description": "5 analyses per month, all 6 analysis sections, 25 library items",
                    },
                    {
                      "@type": "Offer",
                      "name": "Starter",
                      "price": "18",
                      "priceCurrency": "USD",
                      "billingIncrement": 1,
                      "description": "50 analyses per month, 10 podcast analyses, exports, sharing, weekly digest",
                    },
                    {
                      "@type": "Offer",
                      "name": "Pro",
                      "price": "29",
                      "priceCurrency": "USD",
                      "billingIncrement": 1,
                      "description": "150 analyses per month, 30 podcast analyses, claim tracking, priority processing",
                    },
                  ],
                  "featureList": [
                    "YouTube video summarizer with timestamps",
                    "Podcast transcription and analysis",
                    "Article and blog post analysis",
                    "PDF document analysis",
                    "AI fact-checking and truth analysis",
                    "Chat with any analyzed content",
                    "Searchable content library",
                    "Export as Markdown or PDF",
                  ],
                },
              ],
            }),
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <SWRProvider>
          <ActiveAnalysisProvider>
            {children}
          </ActiveAnalysisProvider>
        </SWRProvider>
        {/* A11Y: FIX-FE-011 — Sonner Toaster has built-in aria-live="polite" and role="status" by default */}
        <Toaster position="top-center" />
        <CookieConsent />
        <ServiceWorkerRegister />
        <WebVitals />
        {/* FE: FIX-FE-014 — analytics gated behind cookie consent */}
        <ConsentGate>
          <Analytics />
        </ConsentGate>
      </body>
    </html>
  )
}

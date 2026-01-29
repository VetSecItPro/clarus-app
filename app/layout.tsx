import type React from "react"
import type { Metadata } from "next"
import { Inter, Cormorant_Garamond } from "next/font/google"
import { Analytics } from "@vercel/analytics/react"
import { Toaster } from "sonner"
import CookieConsent from "@/components/cookie-consent"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import { SWRProvider } from "@/components/swr-provider"
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
  title: "Clarus",
  description: "AI-powered content analysis for clarity and understanding",
  generator: "v0.dev",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
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
      </head>
      <body className="font-sans antialiased">
        <SWRProvider>
          {children}
        </SWRProvider>
        <Toaster position="top-center" />
        <CookieConsent />
        <ServiceWorkerRegister />
        <WebVitals />
        <Analytics />
      </body>
    </html>
  )
}

import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
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

export const metadata: Metadata = {
  title: "Truth Checker",
  description: "Check and verify content truth",
  generator: "v0.dev",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: [
      { url: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { url: "/icon-192x192.svg", sizes: "192x192", type: "image/svg+xml" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vajra",
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
    <html lang="en" className={`${inter.variable} dark bg-[#0a0e1a]`}>
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

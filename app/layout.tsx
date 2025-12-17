import type React from "react"
import type { Metadata } from "next"
import { Toaster } from "sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "Truth Checker",
  description: "Check and verify content truth",
  generator: "v0.dev",
  icons: {
    icon: "/favicon.svg",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-[#0a0e1a]">
      <body className="antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}

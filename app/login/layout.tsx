import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In — Clarus",
  description:
    "Sign in to your Clarus account. AI-powered content analysis for videos, podcasts, articles, and PDFs.",
  robots: { index: false, follow: false },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

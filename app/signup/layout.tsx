import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign Up — Clarus",
  description:
    "Create your free Clarus account. AI-powered content analysis for videos, podcasts, articles, and PDFs.",
  robots: { index: false, follow: false },
}

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Account — Clarus",
  description: "Manage your Clarus account settings, export data, and more.",
  robots: { index: false, follow: false },
}

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Feeds | Clarus",
  description:
    "Manage your podcast and YouTube subscriptions. Get notified when new episodes drop and analyze them instantly.",
}

export default function FeedsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

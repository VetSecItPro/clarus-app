// ISR: revalidate every hour — install instructions rarely change
export const revalidate = 3600

import type { Metadata } from "next"
import InstallPageClient from "./install-page-client"

export const metadata: Metadata = {
  title: "Install Clarus | Clarus",
  description: "Install Clarus as an app on your phone, tablet, or computer. Get faster access, offline support, and a native app experience.",
}

export default function InstallPage() {
  return <InstallPageClient />
}

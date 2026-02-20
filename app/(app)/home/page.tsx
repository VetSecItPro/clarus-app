"use client"

import dynamic from "next/dynamic"
import withAuth, { type WithAuthInjectedProps } from "@/components/with-auth"

const HomeContent = dynamic(() => import("@/app/home-content"), { ssr: false })

function HomePage({ session }: WithAuthInjectedProps) {
  if (!session) return null
  return <HomeContent session={session} />
}

export default withAuth(HomePage)

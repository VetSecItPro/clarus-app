"use client"

import dynamic from "next/dynamic"

const UsersPage = dynamic(() => import("./users-client"), {
  ssr: false,
  loading: () => <div className="animate-pulse space-y-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-white/[0.03] border border-white/[0.06] rounded-xl" />)}</div><div className="h-56 bg-white/[0.03] border border-white/[0.06] rounded-xl" /></div>,
})

export default function Page() {
  return <UsersPage />
}

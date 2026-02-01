"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface AdminContextValue {
  userId: string
  isAdmin: true
}

const AdminContext = createContext<AdminContextValue | null>(null)

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider")
  return ctx
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<{ status: "loading" | "ready" | "denied"; userId?: string }>({
    status: "loading",
  })

  useEffect(() => {
    async function checkAdmin() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.replace("/login")
          return
        }

        const { data: userData } = await supabase
          .from("users")
          .select("is_admin")
          .eq("id", session.user.id)
          .single()

        if (!userData?.is_admin) {
          router.replace("/")
          return
        }

        setState({ status: "ready", userId: session.user.id })
      } catch {
        router.replace("/")
      }
    }

    checkAdmin()
  }, [router])

  if (state.status === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1d9bf0] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (state.status === "denied" || !state.userId) {
    return null
  }

  return (
    <AdminContext.Provider value={{ userId: state.userId, isAdmin: true }}>
      {children}
    </AdminContext.Provider>
  )
}

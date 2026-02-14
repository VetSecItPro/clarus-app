"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserIcon, LogOut, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function UserProfileButton() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    fetchUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setLoading(false) // Ensure loading stops if user logs out
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    setLoading(true)
    try {
      // Clear cached auth state before signing out
      if (typeof window !== "undefined") {
        localStorage.removeItem("clarus-remember-session")
        localStorage.removeItem("clarus-session-expiry")
        sessionStorage.removeItem("clarus-session-active")
      }
      await supabase.auth.signOut()
      // Force a hard navigation to clear all cached state
      window.location.href = "/login"
    } catch (error) {
      console.error("Logout error:", error)
      setLoading(false)
    }
  }

  const getInitials = (email?: string | null) => {
    if (!email) return "?"
    const parts = email.split("@")[0]
    return parts.substring(0, 2).toUpperCase()
  }

  if (loading && !user) {
    // Show loader only if user is not yet determined
    return (
      <Button variant="ghost" size="icon" className="rounded-full p-2 hover:bg-gray-800" disabled aria-label="Loading user profile">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </Button>
    )
  }

  if (!user) {
    // Should ideally not be reached if withAuth HOC is working correctly on parent page,
    // but good as a fallback or if used in a public context.
    return (
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full p-2 hover:bg-gray-800"
        onClick={() => router.push("/login")}
        aria-label="Login"
      >
        <UserIcon className="w-5 h-5 text-gray-400" />
      </Button>
    )
  }

  return (
    <>
      {" "}
      {/* Use a fragment if DropdownMenu is the only root element */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="User profile menu"
            className="rounded-full p-0 hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            <Avatar className="h-8 w-8">
              {/* Placeholder for actual avatar image if you add it later */}
              {/* <AvatarImage src={user.user_metadata?.avatar_url || "/placeholder.svg"} alt={user.email} /> */}
              <AvatarFallback className="bg-gray-700 text-gray-300 text-xs">{getInitials(user.email)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-[#1a1a1a] border-gray-700 text-gray-200" align="end">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">Signed in as</p>
              <p className="text-xs leading-none text-gray-400 truncate">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-gray-700" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300"
            disabled={loading}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
            {loading && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

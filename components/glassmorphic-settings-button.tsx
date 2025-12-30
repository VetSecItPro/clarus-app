"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Settings, LogOut, Loader2, Sparkles, UserIcon, Check, X, Pencil, CreditCard, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EditAIPromptsModal } from "@/components/edit-ai-prompts-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

interface GlasmorphicSettingsButtonProps {
  variant?: "default" | "mobile"
}

export default function GlasmorphicSettingsButton({ variant = "default" }: GlasmorphicSettingsButtonProps) {
  const [isEditPromptModalOpen, setIsEditPromptModalOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()

  const [isEditingName, setIsEditingName] = useState(false)
  const [currentName, setCurrentName] = useState("")
  const [newName, setNewName] = useState("")
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "saving">(
    "idle",
  )
  const [nameError, setNameError] = useState("")
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [managingSubscription, setManagingSubscription] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)

      if (session?.user) {
        const { data } = await supabase
          .from("users")
          .select("name, subscription_status")
          .eq("id", session.user.id)
          .single()
        if (data?.name) {
          setCurrentName(data.name)
          setNewName(data.name)
        }
        if (data?.subscription_status) {
          setSubscriptionStatus(data.subscription_status)
        }
      }

      setLoading(false)
    }

    fetchUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setLoading(false)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const checkNameAvailability = useCallback(
    async (name: string) => {
      if (!user) return

      // Validate format first
      const nameRegex = /^[a-zA-Z0-9_]{3,20}$/
      if (!nameRegex.test(name)) {
        setNameStatus("invalid")
        setNameError("3-20 chars, letters, numbers, underscores only")
        return
      }

      // If same as current, no need to check
      if (name === currentName) {
        setNameStatus("idle")
        setNameError("")
        return
      }

      setNameStatus("checking")
      try {
        const res = await fetch(`/api/user/check-name?name=${encodeURIComponent(name)}&userId=${user.id}`)
        const data = await res.json()

        if (data.available) {
          setNameStatus("available")
          setNameError("")
        } else {
          setNameStatus("taken")
          setNameError("Name is already taken")
        }
      } catch {
        setNameStatus("idle")
      }
    },
    [user, currentName],
  )

  useEffect(() => {
    if (!isEditingName || !newName) return

    const timer = setTimeout(() => {
      checkNameAvailability(newName)
    }, 500)

    return () => clearTimeout(timer)
  }, [newName, isEditingName, checkNameAvailability])

  const handleSaveName = async () => {
    if (!user || nameStatus !== "available") return

    setNameStatus("saving")
    try {
      const res = await fetch("/api/user/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, name: newName }),
      })

      const data = await res.json()

      if (data.success) {
        setCurrentName(newName)
        setIsEditingName(false)
        setNameStatus("idle")
      } else {
        setNameError(data.error)
        setNameStatus("taken")
      }
    } catch {
      setNameError("Failed to save")
      setNameStatus("idle")
    }
  }

  const handleCancelEdit = () => {
    setNewName(currentName)
    setIsEditingName(false)
    setNameStatus("idle")
    setNameError("")
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
    setLoggingOut(false)
  }

  const handleLogin = () => {
    router.push("/login")
  }

  // Added function to manage subscription via Stripe portal
  const handleManageSubscription = async () => {
    if (!user) return

    setManagingSubscription(true)
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        console.error("Failed to create portal session:", data.error)
      }
    } catch (error) {
      console.error("Error managing subscription:", error)
    } finally {
      setManagingSubscription(false)
    }
  }

  return (
    <>
      <DropdownMenu onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          {variant === "mobile" ? (
            <button
              className={`flex flex-col items-center justify-center transition-colors ${
                isDropdownOpen ? "text-[#1d9bf0]" : "text-white/50"
              }`}
              aria-label="Settings and Profile"
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-medium">Settings</span>
            </button>
          ) : (
            <button
              className="relative p-2 rounded-lg text-white/50 hover:text-white/90 transition-all duration-200 group"
              aria-label="Settings and Profile"
            >
              <Settings className="h-5 w-5 transition-transform duration-200 group-hover:rotate-45" />
              {/* Subtle hover background */}
              <div className="absolute inset-0 rounded-lg bg-white/[0.06] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={variant === "mobile" ? "end" : "end"}
          side={variant === "mobile" ? "top" : "bottom"}
          sideOffset={variant === "mobile" ? 12 : 8}
          className="w-72 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/50 rounded-2xl p-2 shadow-2xl"
        >
          {/* User section */}
          {loading ? (
            <div className="flex items-center gap-3 px-3 py-3">
              <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />
              <span className="text-sm text-neutral-400">Loading...</span>
            </div>
          ) : user ? (
            <div className="px-3 py-3 mb-1">
              <p className="text-xs text-neutral-500 mb-1">Signed in as</p>
              <p className="text-sm text-neutral-200 truncate mb-3">{user.email}</p>

              <div className="mt-2">
                <p className="text-xs text-neutral-500 mb-2">Username</p>
                {isEditingName ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="bg-neutral-800/50 border-neutral-700 text-sm text-neutral-200 pr-8 rounded-xl"
                        placeholder="Enter username"
                        maxLength={20}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation()
                          if (e.key === "Enter" && nameStatus === "available") {
                            handleSaveName()
                          } else if (e.key === "Escape") {
                            handleCancelEdit()
                          }
                        }}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {nameStatus === "checking" && <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />}
                        {nameStatus === "available" && <Check className="h-4 w-4 text-green-500" />}
                        {(nameStatus === "taken" || nameStatus === "invalid") && <X className="h-4 w-4 text-red-500" />}
                      </div>
                    </div>
                    {nameError && <p className="text-xs text-red-400">{nameError}</p>}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCancelEdit()
                        }}
                        className="flex-1 h-8 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSaveName()
                        }}
                        disabled={nameStatus !== "available"}
                        className="flex-1 h-8 text-xs bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-lg disabled:opacity-50"
                      >
                        {nameStatus === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between bg-neutral-800/30 rounded-xl px-3 py-2 cursor-pointer hover:bg-neutral-800/50 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsEditingName(true)
                    }}
                  >
                    <span className="text-sm text-neutral-200">{currentName || "Set username"}</span>
                    <Pencil className="h-3.5 w-3.5 text-neutral-500" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <DropdownMenuItem
              onClick={handleLogin}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-200"
            >
              <UserIcon className="h-4 w-4 text-neutral-400" />
              <span>Sign In</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="bg-neutral-700/50 my-1" />

          {/* Bookmarks */}
          {user && (
            <DropdownMenuItem
              onClick={() => router.push("/library?bookmarks=true")}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-200"
            >
              <Bookmark className="h-4 w-4 text-amber-400" />
              <span>My Bookmarks</span>
            </DropdownMenuItem>
          )}

          {/* Edit AI Prompts */}
          <DropdownMenuItem
            onClick={() => setIsEditPromptModalOpen(true)}
            className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-200"
          >
            <Sparkles className="h-4 w-4 text-neutral-400" />
            <span>Edit AI Prompts</span>
          </DropdownMenuItem>

          {user && subscriptionStatus && ["active", "trialing"].includes(subscriptionStatus) && (
            <DropdownMenuItem
              onClick={handleManageSubscription}
              disabled={managingSubscription}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-neutral-200"
            >
              <CreditCard className="h-4 w-4 text-neutral-400" />
              <span>Manage Subscription</span>
              {managingSubscription && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
            </DropdownMenuItem>
          )}

          {/* Logout - only show when logged in */}
          {user && (
            <>
              <DropdownMenuSeparator className="bg-neutral-700/50 my-1" />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-500/10 cursor-pointer text-red-400 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
                {loggingOut && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <EditAIPromptsModal isOpen={isEditPromptModalOpen} onOpenChange={setIsEditPromptModalOpen} />
    </>
  )
}

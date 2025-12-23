"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { ArrowRight, Loader2, Link2, Youtube, FileText, Twitter } from "lucide-react"
import withAuth from "@/components/with-auth"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import TopNavigation from "@/components/top-navigation"
import GlasmorphicSettingsButton from "@/components/glassmorphic-settings-button"
import { AddUrlModal } from "@/components/add-url-modal"
import { supabase } from "@/lib/supabase"
import { getYouTubeVideoId, isXUrl } from "@/lib/utils"
import { validateUrl } from "@/lib/validation"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

interface HomePageProps {
  session: Session | null
}

const rotatingPrompts = [
  "What do you want to analyze?",
  "What should we fact-check today?",
  "Got something to verify?",
  "What claims need checking?",
  "Ready to separate fact from fiction?",
  "What content should we examine?",
  "Time to find the truth?",
  "What needs a reality check?",
  "Let's validate something together",
  "What story should we investigate?",
  "Ready to cut through the noise?",
  "What deserves a closer look?",
]

function HomePageContent({ session }: HomePageProps) {
  const [isAddUrlModalOpen, setIsAddUrlModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Fetch username from users table
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const fetchUsername = async () => {
      if (!session?.user) return
      const { data } = await supabase
        .from("users")
        .select("name")
        .eq("id", session.user.id)
        .single()
      if (data?.name) {
        setUsername(data.name)
      }
    }
    fetchUsername()
  }, [session])

  // Pick a random prompt on mount (stable for the session)
  const randomPrompt = useMemo(() => {
    return rotatingPrompts[Math.floor(Math.random() * rotatingPrompts.length)]
  }, [])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (urlToProcess?: string) => {
    const url = urlToProcess || inputValue.trim()

    if (!url) {
      toast.error("Please enter a URL")
      return
    }

    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      // Validate URL with security checks
      const urlValidation = validateUrl(url)
      if (!urlValidation.isValid) {
        toast.error(urlValidation.error || "Please enter a valid URL")
        setIsSubmitting(false)
        return
      }

      // Detect content type
      const validUrl = urlValidation.sanitized!
      let type: "youtube" | "article" | "x_post" = "article"
      if (getYouTubeVideoId(validUrl)) {
        type = "youtube"
      } else if (isXUrl(validUrl)) {
        type = "x_post"
      }

      // Verify user is authenticated
      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser()
      if (sessionError || !user) {
        toast.error("Please sign in to continue")
        setIsSubmitting(false)
        return
      }

      // Insert content record
      const placeholderTitle = `Analyzing: ${validUrl.substring(0, 50)}${validUrl.length > 50 ? "..." : ""}`
      const { data: newContent, error: insertError } = await supabase
        .from("content")
        .insert([{ url: validUrl, type, user_id: user.id, title: placeholderTitle, full_text: null }])
        .select("id")
        .single()

      if (insertError || !newContent) {
        toast.error("Failed to add URL")
        setIsSubmitting(false)
        return
      }

      // Clear input and redirect
      setInputValue("")
      window.dispatchEvent(new CustomEvent("contentAdded"))
      toast.success("Analyzing content...")
      router.push(`/item/${newContent.id}`)

      // Fire API in background
      fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: newContent.id }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
            console.error("Background processing error:", errorData.error)
          } else {
            window.dispatchEvent(new CustomEvent("contentAdded"))
          }
        })
        .catch((error) => {
          console.error("Background processing failed:", error)
        })
    } catch (error: any) {
      toast.error("Something went wrong")
      setIsSubmitting(false)
    }
  }

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      toast.error("Clipboard not available")
      setIsAddUrlModalOpen(true)
      return
    }

    try {
      const clipboardText = await navigator.clipboard.readText()
      if (clipboardText.trim()) {
        setInputValue(clipboardText.trim())
        // Auto-submit if it's a valid URL
        const urlCheck = validateUrl(clipboardText.trim())
        if (urlCheck.isValid) {
          handleSubmit(clipboardText.trim())
        }
      } else {
        toast.error("Clipboard is empty")
      }
    } catch (error) {
      toast.error("Couldn't access clipboard")
      setIsAddUrlModalOpen(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const exampleChips = [
    { icon: Youtube, label: "YouTube", color: "text-red-400" },
    { icon: FileText, label: "Articles", color: "text-blue-400" },
    { icon: Twitter, label: "X Posts", color: "text-white" },
    { icon: Link2, label: "Any Link", color: "text-emerald-400" },
  ]

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="flex items-center justify-between p-4 shrink-0">
        <TopNavigation />
        <GlasmorphicSettingsButton />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          {username && (
            <p className="text-white/40 text-base mb-6">
              Welcome back, <span className="text-white/70">{username}</span>
            </p>
          )}
          <h1 className="text-3xl sm:text-4xl font-semibold text-white mb-4">
            {randomPrompt}
          </h1>
          <p className="text-white/50 text-base">
            Paste a URL and get an instant truth check
          </p>
        </motion.div>

        {/* Input Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-2xl"
        >
          <div
            className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all duration-200 ${
              isFocused
                ? "border-[#1d9bf0]/50 bg-white/[0.03] shadow-[0_0_30px_rgba(29,155,240,0.15)]"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            <Link2 className={`w-5 h-5 shrink-0 transition-colors ${isFocused ? "text-[#1d9bf0]" : "text-white/40"}`} />

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="Paste any URL here..."
              disabled={isSubmitting}
              className="flex-1 bg-transparent text-white placeholder-white/30 text-base outline-none disabled:opacity-50"
            />

            {inputValue ? (
              <button
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
                className="shrink-0 w-10 h-10 rounded-xl bg-[#1d9bf0] hover:bg-[#1a8cd8] disabled:opacity-50 flex items-center justify-center transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5 text-white" />
                )}
              </button>
            ) : (
              <button
                onClick={handlePasteFromClipboard}
                disabled={isSubmitting}
                className="shrink-0 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/70 text-sm font-medium transition-all disabled:opacity-50"
              >
                Paste
              </button>
            )}
          </div>

          {/* Keyboard hint */}
          <p className="text-center text-white/30 text-xs mt-3">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono">Enter</kbd> to analyze
          </p>
        </motion.div>

        {/* Example Chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-2 mt-8"
        >
          {exampleChips.map((chip) => {
            const Icon = chip.icon
            return (
              <div
                key={chip.label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]"
              >
                <Icon className={`w-3.5 h-3.5 ${chip.color}`} />
                <span className="text-xs text-white/60">{chip.label}</span>
              </div>
            )
          })}
        </motion.div>
      </main>

      <AddUrlModal isOpen={isAddUrlModalOpen} onOpenChange={setIsAddUrlModalOpen} />
    </div>
  )
}

export default withAuth(HomePageContent)

"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Loader2, Link2, Youtube, FileText, Twitter, CheckCircle2, X, Shield } from "lucide-react"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { AddUrlModal } from "@/components/add-url-modal"
import { supabase } from "@/lib/supabase"
import { getYouTubeVideoId, isXUrl, getDomainFromUrl } from "@/lib/utils"
import { validateUrl } from "@/lib/validation"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { LandingPage } from "@/components/landing/landing-page"
import Image from "next/image"

interface UrlPreview {
  url: string
  domain: string
  type: "youtube" | "article" | "x_post"
  favicon: string
}

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
  const [urlPreview, setUrlPreview] = useState<UrlPreview | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Detect and validate URL as user types
  const detectUrl = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setUrlPreview(null)
      return
    }

    const validation = validateUrl(trimmed)
    if (!validation.isValid || !validation.sanitized) {
      setUrlPreview(null)
      return
    }

    const validUrl = validation.sanitized
    const domain = getDomainFromUrl(validUrl)

    // Detect content type
    let type: "youtube" | "article" | "x_post" = "article"
    if (getYouTubeVideoId(validUrl)) {
      type = "youtube"
    } else if (isXUrl(validUrl)) {
      type = "x_post"
    }

    // Get favicon using Google's service
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

    setUrlPreview({ url: validUrl, domain, type, favicon })
  }, [])

  // Debounce URL detection
  useEffect(() => {
    const timer = setTimeout(() => {
      detectUrl(inputValue)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue, detectUrl])

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
        // Don't auto-submit - let user verify with preview first
        inputRef.current?.focus()
      } else {
        toast.error("Clipboard is empty")
      }
    } catch (error) {
      toast.error("Couldn't access clipboard")
      setIsAddUrlModalOpen(true)
    }
  }

  const clearInput = () => {
    setInputValue("")
    setUrlPreview(null)
    inputRef.current?.focus()
  }

  const getTypeIcon = (type: "youtube" | "article" | "x_post") => {
    switch (type) {
      case "youtube":
        return <Youtube className="w-4 h-4 text-red-400" />
      case "x_post":
        return <Twitter className="w-4 h-4 text-white" />
      default:
        return <FileText className="w-4 h-4 text-blue-400" />
    }
  }

  const getTypeLabel = (type: "youtube" | "article" | "x_post") => {
    switch (type) {
      case "youtube":
        return "YouTube Video"
      case "x_post":
        return "X Post"
      default:
        return "Article"
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
      <SiteHeader />

      <main className="flex-1 flex flex-col items-center px-3 sm:px-6 pt-12 sm:pt-20 lg:pt-24">
        {/* Mobile Logo - only visible on mobile */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="sm:hidden flex items-center gap-2 mb-4"
        >
          <div className="w-9 h-9 bg-gradient-to-br from-[#1d9bf0] to-[#06b6d4] rounded-lg flex items-center justify-center shadow-lg shadow-[#1d9bf0]/25">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-white/90 font-medium text-base tracking-tight">Truth Checker</span>
        </motion.div>

        {/* Welcome Message - more compact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-5 sm:mb-8"
        >
          {username && (
            <p className="text-white/40 text-xs sm:text-sm mb-3 sm:mb-4">
              Welcome back, <span className="text-white/60">{username}</span>
            </p>
          )}
          <h1 className="text-xl sm:text-3xl lg:text-4xl font-semibold text-white mb-1.5 sm:mb-3">
            {randomPrompt}
          </h1>
          <p className="text-white/40 text-sm hidden sm:block">
            Paste a URL and get an instant truth check
          </p>
        </motion.div>

        {/* Input Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto"
          style={{ maxWidth: '34rem', width: '100%' }}
        >
          <div
            className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all duration-200 ${
              urlPreview
                ? "border-emerald-500/50 bg-emerald-500/[0.03] shadow-[0_0_30px_rgba(16,185,129,0.1)]"
                : isFocused
                ? "border-[#1d9bf0]/50 bg-white/[0.03] shadow-[0_0_30px_rgba(29,155,240,0.15)]"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            {urlPreview ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <Link2 className={`w-5 h-5 shrink-0 transition-colors ${isFocused ? "text-[#1d9bf0]" : "text-white/40"}`} />
            )}

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
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="flex-1 bg-transparent text-white placeholder-white/30 text-base outline-none disabled:opacity-50"
              style={{
                // iOS Safari specific resets to remove gray bar/styling
                WebkitAppearance: 'none',
                appearance: 'none',
                borderRadius: 0,
                boxShadow: 'none',
              }}
            />

            {inputValue && (
              <button
                onClick={clearInput}
                disabled={isSubmitting}
                className="hidden sm:block shrink-0 p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all disabled:opacity-50"
                aria-label="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {inputValue ? (
              <button
                onClick={() => handleSubmit()}
                disabled={isSubmitting || !urlPreview}
                className={`shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all disabled:opacity-50 ${
                  urlPreview
                    ? "bg-[#1d9bf0] hover:bg-[#1a8cd8] active:bg-[#0d7bc5] active:scale-95 text-white shadow-lg shadow-[#1d9bf0]/25"
                    : "bg-white/[0.06] text-white/40 cursor-not-allowed"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Analyzing...</span>
                  </>
                ) : (
                  <span>Go</span>
                )}
              </button>
            ) : (
              <button
                onClick={handlePasteFromClipboard}
                disabled={isSubmitting}
                className="shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/70 text-xs sm:text-sm font-medium transition-all disabled:opacity-50"
              >
                Paste
              </button>
            )}
          </div>

          {/* URL Preview Card */}
          <AnimatePresence>
            {urlPreview && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  {/* Favicon */}
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center overflow-hidden">
                    <Image
                      src={urlPreview.favicon}
                      alt=""
                      width={20}
                      height={20}
                      className="w-5 h-5"
                      unoptimized
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                  </div>

                  {/* Domain and type */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm truncate">
                        {urlPreview.domain}
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {getTypeIcon(urlPreview.type)}
                      <span className="text-white/50 text-xs">
                        {getTypeLabel(urlPreview.type)}
                      </span>
                    </div>
                  </div>

                  {/* Ready indicator */}
                  <div className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                    <span className="text-emerald-400 text-xs font-medium">Ready</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Keyboard hint - hidden on mobile */}
          <p className="hidden sm:block text-center text-white/30 text-xs mt-3">
            {urlPreview ? (
              <>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono">Enter</kbd> or click Analyze</>
            ) : (
              <>Paste a URL to get started</>
            )}
          </p>
        </motion.div>

        {/* Example Chips - compact */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-4 sm:mt-6"
        >
          {exampleChips.map((chip) => {
            const Icon = chip.icon
            return (
              <div
                key={chip.label}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]"
              >
                <Icon className={`w-3 h-3 ${chip.color} opacity-70`} />
                <span className="text-[10px] text-white/50">{chip.label}</span>
              </div>
            )
          })}
        </motion.div>
      </main>

      <SiteFooter />
      <MobileBottomNav />

      <AddUrlModal isOpen={isAddUrlModalOpen} onOpenChange={setIsAddUrlModalOpen} />
    </div>
  )
}

// Main page component that shows landing page for unauthenticated users
export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Show loading state briefly
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
      </div>
    )
  }

  // Show landing page for unauthenticated users
  if (!session) {
    return <LandingPage />
  }

  // Show authenticated home page
  return <HomePageContent session={session} />
}

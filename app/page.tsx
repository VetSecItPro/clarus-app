"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Loader2, MessageSquare, Youtube, FileText, FileUp, Twitter } from "lucide-react"
import type { Session } from "@supabase/supabase-js"
import { motion } from "framer-motion"
import SiteHeader from "@/components/site-header"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { supabase } from "@/lib/supabase"
import { getCachedSession, setAuthCache } from "@/components/with-auth"
import { LandingPage } from "@/components/landing/landing-page"
import {
  ChatMessagesArea,
  ChatInputBar,
  SuggestionButtons,
  AnalysisError,
  type SuggestionAction,
} from "@/components/chat"
import { useChatSession } from "@/lib/hooks/use-chat-session"

const rotatingPrompts = [
  "What do you want to explore today?",
  "Drop a link and let's dive in.",
  "What are we learning about today?",
  "Ready to break down some content?",
  "What caught your attention?",
  "Let's unpack something together.",
  "What would you like to understand?",
  "Share a link, start a conversation.",
  "What's on your mind?",
  "Paste a video or article to get started.",
  "What should we dig into?",
  "Got something interesting to analyze?",
  "What are you curious about?",
  "Let's make sense of something.",
  "Found something worth exploring?",
  "What do you want to learn more about?",
  "Ready when you are.",
  "What can I help you understand?",
  "Let's turn content into clarity.",
  "What's next on your reading list?",
]

interface HomePageProps {
  session: Session | null
}

function HomePageContent({ session }: HomePageProps) {
  const userId = session?.user?.id || null

  // Username state
  const [username, setUsername] = useState<string | null>(null)

  // Track when we're navigating to /item/[id] to prevent chat view flash
  const [isNavigating, setIsNavigating] = useState(false)

  // Chat session hook
  const {
    state,
    messages,
    contentStatus,
    showSuggestions,
    analysisError,
    isProcessing,
    isAiLoading,
    submitUrl,
    submitPdf,
    sendChatMessage,
    handleSuggestion,
    retryAnalysis,
  } = useChatSession({
    userId,
    onContentCreated: (id) => {
      // Navigate to the split-screen card layout page
      window.location.href = `/item/${id}`
    },
  })

  // Fetch username - try DB name first, fall back to auth metadata
  useEffect(() => {
    const fetchUsername = async () => {
      if (!session?.user) return

      // 1. Check the users table for a custom display name
      const { data } = await supabase
        .from("users")
        .select("name")
        .eq("id", session.user.id)
        .single()

      if (data?.name) {
        setUsername(data.name)
        return
      }

      // 2. Fall back to auth metadata (Google OAuth provides full_name)
      const meta = session.user.user_metadata
      const authName = meta?.full_name || meta?.name || null
      if (authName && typeof authName === "string") {
        // Use first name only for a friendlier greeting
        const firstName = authName.split(" ")[0]
        setUsername(firstName)
        return
      }

      // 3. Last resort: use the part before @ in the email
      const email = session.user.email
      if (email) {
        const localPart = email.split("@")[0]
        setUsername(localPart)
      }
    }
    fetchUsername()
  }, [session])

  // Random prompt
  const randomPrompt = useMemo(() => {
    return rotatingPrompts[Math.floor(Math.random() * rotatingPrompts.length)]
  }, [])

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }, [])

  // Handle suggestion selection
  const onSuggestionSelect = (action: SuggestionAction) => {
    handleSuggestion(action)
  }

  // Handle URL submission — set navigating flag to prevent chat view flash
  const onSubmitUrl = (
    url: string,
    urlMeta: { url: string; domain: string; type: "youtube" | "article" | "x_post"; favicon: string }
  ) => {
    setIsNavigating(true)
    submitUrl(url, urlMeta)
  }

  // Handle chat message
  const onSubmitMessage = (message: string) => {
    sendChatMessage(message)
  }

  // Determine input mode
  const inputMode = state === "idle" ? "url-only" : "auto"
  const isLoading = isProcessing || isAiLoading

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <SiteHeader />

      {/* App Name - mobile only */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="lg:hidden flex items-center justify-center gap-2.5 py-4 sm:py-5 border-b border-white/[0.04]"
      >
        <Image
          src="/clarus-logo.png"
          alt="Clarus"
          width={36}
          height={36}
          className="w-8 h-8 sm:w-9 sm:h-9"
        />
        <span className="text-white font-bold text-lg sm:text-xl italic tracking-wide" style={{ fontFamily: 'var(--font-cormorant)' }}>
          Clarus
        </span>
      </motion.div>

      <main className="flex-1 flex flex-col pb-20 sm:pb-4">
        {/* Chat area or welcome state — stay in welcome view while navigating to /item */}
        {state === "idle" || isNavigating ? (
          // Welcome state - centered
          <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-8"
            >
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white mb-3 sm:mb-4">
                {greeting}
                {username && (
                  <>, <span className="text-[#1d9bf0]">{username}</span></>
                )}
              </h1>
              <p className="text-white/50 text-base sm:text-lg">
                {randomPrompt}
              </p>
            </motion.div>

            {/* Input at center when idle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full"
            >
              <ChatInputBar
                onSubmitUrl={onSubmitUrl}
                onSubmitMessage={onSubmitMessage}
                onSubmitFile={(file: File) => { setIsNavigating(true); submitPdf(file) }}
                mode="url-only"
                placeholder="Paste any URL or upload a PDF..."
                disabled={!userId}
                isProcessing={isLoading}
              />
            </motion.div>

            {/* Content type hints */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex items-center justify-center gap-5 sm:gap-6 mt-5"
            >
              {[
                { icon: Youtube, label: "YouTube" },
                { icon: FileText, label: "Articles" },
                { icon: FileUp, label: "PDF" },
                { icon: Twitter, label: "X Posts" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-white/25">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs">{label}</span>
                </div>
              ))}
            </motion.div>

          </div>
        ) : (
          // Chat mode - messages + input at bottom
          <div className="flex-1 flex flex-col w-full mx-auto" style={{ maxWidth: "720px" }}>
            <ChatMessagesArea
              messages={messages}
              isLoading={isLoading}
              loadingText={
                isProcessing ? "Analyzing content..." : "Thinking..."
              }
              className="flex-1"
              emptyState={
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 pt-16">
                  <MessageSquare className="w-12 h-12 mb-3 text-gray-600" />
                  <p className="text-sm">Paste a URL to get started</p>
                </div>
              }
            />

            {/* Error message */}
            {analysisError && (
              <div className="px-4 py-3" style={{ maxWidth: "600px" }}>
                <AnalysisError
                  message={analysisError}
                  onRetry={retryAnalysis}
                  isRetrying={isProcessing}
                />
              </div>
            )}

            {/* Suggestion buttons */}
            {showSuggestions && !analysisError && (
              <div className="px-4 py-3 border-t border-white/[0.06]" style={{ maxWidth: "600px" }}>
                <div className="text-xs text-white/40 mb-2 ml-9">
                  What would you like to explore?
                </div>
                <SuggestionButtons
                  onSelect={onSuggestionSelect}
                  onCustomPrompt={sendChatMessage}
                  contentCategory={contentStatus?.triage?.content_category}
                  contentType={contentStatus?.type}
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Input bar at bottom */}
            <ChatInputBar
              onSubmitUrl={onSubmitUrl}
              onSubmitMessage={onSubmitMessage}
              onSubmitFile={submitPdf}
              mode={inputMode}
              placeholder={
                state === "initial_complete"
                  ? "Ask a question about this content..."
                  : "Paste a URL or ask a question..."
              }
              disabled={!userId}
              isProcessing={isLoading}
              showFileUpload={false}
            />
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  )
}

// Main page component
export default function HomePage() {
  const cached = getCachedSession()
  const [session, setSession] = useState<Session | null>(cached.session)
  const [loading, setLoading] = useState(!cached.initialized)

  useEffect(() => {
    if (cached.initialized) {
      setSession(cached.session)
      setLoading(false)
      return
    }

    let isMounted = true

    const getSessionWithTimeout = async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Session timeout")), 5000)
        })

        const {
          data: { session },
        } = await Promise.race([supabase.auth.getSession(), timeoutPromise])

        if (isMounted) {
          setSession(session)

          // Also fetch subscription status for auth cache
          type SubscriptionStatus = "active" | "trialing" | "grandfathered" | "enterprise" | "canceled" | "none" | null
          let subscriptionStatus: SubscriptionStatus = null
          if (session?.user) {
            const { data: userData } = await supabase
              .from("users")
              .select("subscription_status")
              .eq("id", session.user.id)
              .single()
            subscriptionStatus = (userData?.subscription_status as SubscriptionStatus) || "none"
          }

          setAuthCache(session, subscriptionStatus) // Update global cache so Library/Community pages work
          setLoading(false)
        }
      } catch {
        if (isMounted) {
          setSession(null)
          setAuthCache(null)
          setLoading(false)
        }
      }
    }

    getSessionWithTimeout()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isMounted) {
        setSession(session)

        // Fetch subscription status before updating cache
        type SubStatus = "active" | "trialing" | "grandfathered" | "enterprise" | "canceled" | "none" | null
        let subStatus: SubStatus = null
        if (session?.user) {
          const { data: userData } = await supabase
            .from("users")
            .select("subscription_status")
            .eq("id", session.user.id)
            .single()
          subStatus = (userData?.subscription_status as SubStatus) || "none"
        }

        setAuthCache(session, subStatus) // Keep global cache in sync with subscription
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [cached.initialized, cached.session])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <LandingPage />
  }

  return <HomePageContent session={session} />
}

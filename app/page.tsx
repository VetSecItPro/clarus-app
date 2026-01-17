"use client"

import { useState, useEffect, useMemo } from "react"
import { Loader2, Shield, MessageSquare } from "lucide-react"
import type { Session } from "@supabase/supabase-js"
import { motion } from "framer-motion"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { supabase } from "@/lib/supabase"
import { getCachedSession, setAuthCache } from "@/components/with-auth"
import { LandingPage } from "@/components/landing/landing-page"
import { useRouter } from "next/navigation"
import {
  ChatMessagesArea,
  ChatInputBar,
  SuggestionButtons,
  AnalysisError,
  type SuggestionAction,
} from "@/components/chat"
import { useChatSession } from "@/lib/hooks/use-chat-session"

const rotatingPrompts = [
  "What do you want to explore?",
  "Drop a link and let's dive in",
  "What are we learning about today?",
  "Ready to break down some content?",
  "What caught your attention?",
  "Let's unpack something together",
  "What would you like to understand?",
  "Share a link, start a conversation",
  "What's on your mind?",
  "Let's chat about something interesting",
  "Paste a video or article to get started",
  "What should we dig into?",
]

interface HomePageProps {
  session: Session | null
}

function HomePageContent({ session }: HomePageProps) {
  const router = useRouter()
  const userId = session?.user?.id || null

  // Username state
  const [username, setUsername] = useState<string | null>(null)

  // Chat session hook
  const {
    state,
    contentId,
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
      // Update URL without full navigation (for back button support)
      window.history.replaceState({}, "", `/chat/${id}`)
    },
  })

  // Fetch username
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

  // Random prompt
  const randomPrompt = useMemo(() => {
    return rotatingPrompts[Math.floor(Math.random() * rotatingPrompts.length)]
  }, [])

  // Handle suggestion selection
  const onSuggestionSelect = (action: SuggestionAction) => {
    handleSuggestion(action)
  }

  // Handle URL submission
  const onSubmitUrl = (
    url: string,
    urlMeta: { url: string; domain: string; type: "youtube" | "article" | "x_post"; favicon: string }
  ) => {
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
        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-[#1d9bf0] via-[#0ea5e9] to-[#06b6d4] rounded-xl flex items-center justify-center shadow-lg shadow-[#1d9bf0]/25">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <span className="text-white font-semibold text-base sm:text-lg tracking-tight">
          Vajra
        </span>
      </motion.div>

      <main className="flex-1 flex flex-col pb-20 sm:pb-4">
        {/* Chat area or welcome state */}
        {state === "idle" ? (
          // Welcome state - centered
          <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-8"
            >
              {username ? (
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-medium text-white mb-2 sm:mb-3">
                  Welcome back,{" "}
                  <span className="text-[#1d9bf0]">{username}</span>
                </h1>
              ) : (
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-medium text-white mb-2 sm:mb-3">
                  Welcome back
                </h1>
              )}
              <p className="text-white/70 text-base sm:text-lg font-medium">
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
                onSubmitPdf={submitPdf}
                mode="url-only"
                placeholder="Paste any URL or upload a PDF..."
                disabled={!userId}
                isProcessing={isLoading}
              />
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
              onSubmitPdf={submitPdf}
              mode={inputMode}
              placeholder={
                state === "initial_complete"
                  ? "Ask a question about this content..."
                  : "Paste a URL or ask a question..."
              }
              disabled={!userId}
              isProcessing={isLoading}
              showPdfUpload={false}
            />
          </div>
        )}
      </main>

      <SiteFooter />
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

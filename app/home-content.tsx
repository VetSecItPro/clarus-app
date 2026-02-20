"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Image from "next/image"
import { MessageSquare, Youtube, FileText, FileUp, Twitter, Headphones } from "lucide-react"
import type { Session } from "@supabase/supabase-js"
import { motion } from "framer-motion"
import { ChatInputBar, type SuggestionAction } from "@/components/chat"
import { useChatSession } from "@/lib/hooks/use-chat-session"
import { type AnalysisLanguage, LANGUAGE_STORAGE_KEY } from "@/lib/languages"
import { useActiveAnalysis } from "@/lib/contexts/active-analysis-context"
import { useUserTier } from "@/lib/hooks/use-user-tier"
import { hasCompletedOnboarding, WelcomeOnboarding } from "@/components/welcome-onboarding"
import type { AnalysisMode } from "@/lib/analysis-modes"

// PERF: Dynamic imports for components only used in chat mode (authenticated + active chat)
const ChatMessagesArea = dynamic(() => import("@/components/chat/chat-messages-area").then(m => ({ default: m.ChatMessagesArea })), { ssr: false })
const SuggestionButtons = dynamic(() => import("@/components/chat/suggestion-buttons").then(m => ({ default: m.SuggestionButtons })), { ssr: false })
const AnalysisError = dynamic(() => import("@/components/chat/analysis-error").then(m => ({ default: m.AnalysisError })), { ssr: false })
const AnalysisModeSelector = dynamic(() => import("@/components/analysis-mode-selector").then(m => ({ default: m.AnalysisModeSelector })), { ssr: false })

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

interface HomeContentProps {
  session: Session
}

export default function HomeContent({ session }: HomeContentProps) {
  const router = useRouter()
  const userId = session.user.id

  // PERF: shared SWR hook eliminates duplicate query for tier + name (was independent useEffect+fetch)
  const { name: dbName, features } = useUserTier(userId)

  // Username — prefer DB name, then auth metadata, then email prefix
  const username = useMemo(() => {
    if (dbName) return dbName
    const meta = session.user.user_metadata
    const authName = meta?.full_name || meta?.name || null
    if (authName && typeof authName === "string") return authName.split(" ")[0]
    if (session.user.email) return session.user.email.split("@")[0]
    return null
  }, [dbName, session])

  // Language selector state — persisted to localStorage
  const [analysisLanguage, setAnalysisLanguage] = useState<AnalysisLanguage>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (saved === "ar" || saved === "es" || saved === "fr" || saved === "de" || saved === "pt" || saved === "ja" || saved === "ko" || saved === "zh" || saved === "it" || saved === "nl") {
        return saved
      }
    }
    return "en"
  })

  // User tier for gating multi-language
  const multiLanguageEnabled = features.multiLanguageAnalysis

  // Analysis mode selector state
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>("apply")
  const modeSelectionEnabled = features.analysisPreferences

  // Fetch saved preference on mount
  useEffect(() => {
    let cancelled = false
    fetch("/api/preferences")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data?.preferences?.analysis_mode) {
          setSelectedMode(data.preferences.analysis_mode as AnalysisMode)
        }
      })
      .catch(() => { /* silently use default */ })
    return () => { cancelled = true }
  }, [])

  // Save preference on mode change (Starter+ only)
  const handleModeChange = useCallback((mode: AnalysisMode) => {
    setSelectedMode(mode)
    if (modeSelectionEnabled) {
      fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis_mode: mode }),
      }).catch(() => { /* toast handled by the UI, local state already updated */ })
    }
  }, [modeSelectionEnabled])

  // Onboarding — show welcome modal for first-time users
  const [showOnboarding, setShowOnboarding] = useState(() => !hasCompletedOnboarding())

  // Track when we're navigating to /item/[id] to prevent chat view flash
  const [isNavigating, setIsNavigating] = useState(false)

  const { startTracking } = useActiveAnalysis()

  // Stable callback for content navigation
  const onContentCreated = useCallback((id: string) => {
    startTracking(id, "Processing...", null)
    router.push(`/item/${id}`)
  }, [router, startTracking])

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
    onContentCreated,
    analysisLanguage,
  })

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

  // Handle language change
  const onLanguageChange = (lang: AnalysisLanguage) => {
    setAnalysisLanguage(lang)
    if (typeof window !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    }
  }

  // Handle suggestion selection
  const onSuggestionSelect = (action: SuggestionAction) => {
    handleSuggestion(action)
  }

  // Handle URL submission — set navigating flag to prevent chat view flash
  const onSubmitUrl = (
    url: string,
    urlMeta: { url: string; domain: string; type: "youtube" | "article" | "x_post" | "podcast"; favicon: string }
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

      {/* First-time user onboarding */}
      {showOnboarding && (
        <WelcomeOnboarding
          username={username}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      {/* App Name - mobile only */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="lg:hidden flex items-center justify-center gap-2.5 py-4 sm:py-5 border-b border-white/[0.04]"
      >
        <Image
          src="/clarus-logo.webp"
          alt="Clarus"
          width={36}
          height={36}
          sizes="36px"
          priority
          className="w-8 h-8 sm:w-9 sm:h-9"
        />
        <span className="text-white font-bold text-lg sm:text-xl italic tracking-wide" style={{ fontFamily: 'var(--font-cormorant)' }}>
          Clarus
        </span>
      </motion.div>

      <main id="main-content" className="flex-1 flex flex-col pb-20 sm:pb-4">
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
                  <>, <span className="text-brand">{username}</span></>
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
                disabled={false}
                isProcessing={isLoading}
                analysisLanguage={analysisLanguage}
                onLanguageChange={onLanguageChange}
                multiLanguageEnabled={multiLanguageEnabled}
              />
            </motion.div>

            {/* Analysis mode selector */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex justify-center mt-4"
            >
              <AnalysisModeSelector
                selectedMode={selectedMode}
                onModeChange={handleModeChange}
                isLocked={!modeSelectionEnabled}
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
                { icon: Headphones, label: "Podcasts" },
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
                <div className="text-xs text-white/50 mb-2 ml-9">
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
              disabled={false}
              isProcessing={isLoading}
              showFileUpload={false}
            />
          </div>
        )}
      </main>

    </div>
  )
}

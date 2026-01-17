"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ArrowLeft, Share2, MoreVertical, Trash2 } from "lucide-react"
import type { Session } from "@supabase/supabase-js"
import { motion } from "framer-motion"
import { toast } from "sonner"
import SiteHeader from "@/components/site-header"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { supabase } from "@/lib/supabase"
import { getCachedSession } from "@/components/with-auth"
import {
  ChatMessagesArea,
  ChatInputBar,
  SuggestionButtons,
  AnalysisError,
  type SuggestionAction,
} from "@/components/chat"
import { ContentSummaryCard } from "@/components/chat/content-summary-card"
import { useChatSession } from "@/lib/hooks/use-chat-session"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ChatPageProps {
  params: Promise<{ id: string }>
}

function ChatPageContent({
  session,
  contentId,
}: {
  session: Session
  contentId: string
}) {
  const router = useRouter()
  const userId = session.user.id

  const {
    state,
    messages,
    contentStatus,
    showSuggestions,
    analysisError,
    isProcessing,
    isAiLoading,
    sendChatMessage,
    handleSuggestion,
    loadContent,
    retryAnalysis,
  } = useChatSession({
    userId,
    initialContentId: contentId,
  })

  // Load content on mount
  useEffect(() => {
    loadContent(contentId)
  }, [contentId, loadContent])

  const isLoading = isProcessing || isAiLoading

  const onSuggestionSelect = (action: SuggestionAction) => {
    handleSuggestion(action)
  }

  const onSubmitMessage = (message: string) => {
    sendChatMessage(message)
  }

  const handleShare = async () => {
    if (!contentStatus?.url) return

    try {
      if (navigator.share) {
        await navigator.share({
          title: contentStatus.title || "Check this out",
          url: contentStatus.url,
        })
      } else {
        await navigator.clipboard.writeText(contentStatus.url)
        toast.success("Link copied to clipboard")
      }
    } catch {
      // User cancelled share
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this analysis?")) {
      return
    }

    const { error } = await supabase
      .from("content")
      .delete()
      .eq("id", contentId)
      .eq("user_id", userId)

    if (error) {
      toast.error("Failed to delete")
      return
    }

    toast.success("Deleted")
    router.push("/library")
  }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      <SiteHeader />

      {/* Chat header - fixed below site header */}
      <div className="border-b border-white/[0.06] bg-black shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="shrink-0 w-9 h-9 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-medium text-white truncate">
              {contentStatus?.title || "Loading..."}
            </h1>
            {contentStatus?.url && (
              <p className="text-xs text-white/40 truncate">
                {new URL(contentStatus.url).hostname.replace("www.", "")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              className="shrink-0 w-9 h-9 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="shrink-0 w-9 h-9 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-red-400 focus:text-red-400"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-h-0 w-full mx-auto" style={{ maxWidth: "720px" }}>
        {/* Scrollable content area - hide scrollbar */}
        <div className="flex-1 overflow-y-auto min-h-0 no-scrollbar">
          {/* Content summary card */}
          {contentStatus && (
            <div className="px-4 pt-4" style={{ maxWidth: "600px" }}>
              <ContentSummaryCard
                title={contentStatus.title || ""}
                url={contentStatus.url}
                type={contentStatus.type}
                thumbnail_url={contentStatus.thumbnail_url}
                author={contentStatus.author}
                duration={contentStatus.duration}
                triage={contentStatus.triage}
                brief_overview={contentStatus.brief_overview}
              />
            </div>
          )}

          {/* Chat messages */}
          <ChatMessagesArea
            messages={messages}
            isLoading={isLoading}
            loadingText={isProcessing ? "Analyzing..." : "Thinking..."}
            className=""
          />
        </div>

        {/* Fixed bottom section */}
        <div className="shrink-0 pb-20 sm:pb-4">
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

          {/* Input bar */}
          <div className="w-full">
            <ChatInputBar
              onSubmitUrl={() => {}}
              onSubmitMessage={onSubmitMessage}
              mode="chat-only"
              placeholder="Ask a question about this content..."
              disabled={false}
              isProcessing={isLoading}
            />
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  )
}

export default function ChatPage({ params }: ChatPageProps) {
  const { id: contentId } = use(params)
  const cached = getCachedSession()
  const [session, setSession] = useState<Session | null>(cached.session)
  const [loading, setLoading] = useState(!cached.initialized)
  const router = useRouter()

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
          setLoading(false)
        }
      } catch {
        if (isMounted) {
          setSession(null)
          setLoading(false)
        }
      }
    }

    getSessionWithTimeout()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSession(session)
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
    router.push("/login")
    return null
  }

  return <ChatPageContent session={session} contentId={contentId} />
}

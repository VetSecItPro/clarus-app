/**
 * @module use-chat-session
 * @description Primary React hook orchestrating the chat-based content analysis flow.
 *
 * Manages the full lifecycle of a content analysis session:
 *   1. **URL submission** -- create a content record and trigger background processing
 *   2. **Status polling** -- poll `/api/content-status` until initial analysis is ready
 *   3. **Suggestion handling** -- display post-analysis actions (executive summary, full analysis, truth check)
 *   4. **AI chat** -- follow-up questions via the Vercel AI SDK streaming endpoint
 *   5. **PDF upload** -- submit a PDF file for OCR + analysis
 *
 * URL deduplication uses {@link normalizeUrl} to avoid re-scraping content the
 * user has already analyzed. Existing content with a completed summary in the
 * requested language navigates directly to the item page.
 *
 * @see {@link lib/utils.ts} normalizeUrl for URL normalization
 * @see {@link lib/languages.ts} AnalysisLanguage for multi-language support
 */

"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { ChatMessageData, ChatMessageType } from "@/components/chat"
import type { AnalysisLanguage } from "@/lib/languages"
import { normalizeUrl } from "@/lib/utils"
import { useStatusPolling, type ContentStatus } from "./use-status-polling"
import { usePdfUpload } from "./use-pdf-upload"

/**
 * The progression of states during a content analysis session.
 *
 * - `idle` -- waiting for the user to submit a URL or PDF
 * - `processing` -- content submitted, background analysis in progress
 * - `initial_complete` -- initial analysis ready (Quality + TL;DR), showing suggestion buttons
 * - `chatting` -- user has started asking follow-up questions
 */
export type ChatSessionState =
  | "idle" // No content loaded, waiting for URL
  | "processing" // URL submitted, analysis in progress
  | "initial_complete" // Initial analysis (Quality + TL;DR) done, showing suggestions
  | "chatting" // User is in active chat mode

interface UseChatSessionOptions {
  userId: string | null
  initialContentId?: string
  onContentCreated?: (contentId: string) => void
  /** Analysis language for content processing */
  analysisLanguage?: AnalysisLanguage
}

interface UrlMeta {
  url: string
  domain: string
  type: "youtube" | "article" | "x_post" | "podcast"
  favicon: string
}

/**
 * Orchestrates a complete content analysis chat session.
 *
 * Provides state, actions, and computed values for the chat UI. Handles
 * URL submission with deduplication, PDF upload, status polling with
 * timeout/error handling, suggestion-driven analysis display, and AI
 * streaming chat for follow-up questions.
 *
 * @param options - Session configuration including user ID, optional initial content, and language
 * @returns An object with session state, action callbacks, and a reset function
 *
 * @example
 * ```tsx
 * const session = useChatSession({
 *   userId: user.id,
 *   analysisLanguage: "en",
 *   onContentCreated: (id) => router.push(`/item/${id}`),
 * })
 * // session.submitUrl(url, urlMeta) -- start analysis
 * // session.sendChatMessage(text) -- ask follow-up
 * // session.reset() -- clear session
 * ```
 */
export function useChatSession({
  userId,
  initialContentId,
  onContentCreated,
  analysisLanguage = "en",
}: UseChatSessionOptions) {
  const [state, setState] = useState<ChatSessionState>(
    initialContentId ? "processing" : "idle"
  )
  const [contentId, setContentId] = useState<string | null>(initialContentId || null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [contentStatus, setContentStatus] = useState<ContentStatus | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const threadIdRef = useRef<string | null>(null)

  // Keep threadId ref in sync
  useEffect(() => {
    threadIdRef.current = threadId
  }, [threadId])

  // Helper to add a message
  const addMessage = useCallback((message: ChatMessageData) => {
    setMessages((prev) => [...prev, message])
  }, [])

  // --- Status Polling (extracted hook) ---

  const { startPolling, stopPolling, retryAnalysis: retryPolling, analysisError } = useStatusPolling({
    analysisLanguage,
    onStatusUpdate: useCallback((data: ContentStatus) => {
      setContentStatus(data)
    }, []),
    onInitialReady: useCallback((data: ContentStatus) => {
      setMessages((prev) => {
        const hasInitial = prev.some((m) => m.type === "analysis-initial")
        if (hasInitial) return prev

        return [
          ...prev,
          {
            id: `analysis-initial-${Date.now()}`,
            type: "analysis-initial" as ChatMessageType,
            content: data.brief_overview || "",
            triage: data.triage || undefined,
            timestamp: new Date(),
          },
        ]
      })
      setState("initial_complete")
      setShowSuggestions(true)
    }, []),
    onError: useCallback((error: string) => {
      setState("initial_complete")
      void error // error state managed by the polling hook
    }, []),
  })

  const retryAnalysis = useCallback(async () => {
    if (!contentId) return
    setState("processing")
    await retryPolling(contentId)
  }, [contentId, retryPolling])

  // --- PDF Upload (extracted hook) ---

  const { submitPdf } = usePdfUpload({
    userId,
    analysisLanguage,
    addMessage,
    onContentCreated,
    startPolling,
    setContentId: useCallback((id: string) => setContentId(id), []),
    setState: useCallback((s: "idle" | "processing") => setState(s), []),
  })

  // --- AI SDK chat hook for follow-up questions ---

  const {
    messages: aiMessages,
    status: aiStatus,
    sendMessage,
  } = useChat({
    id: contentId || "new",
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { contentId },
    }),
    onFinish: async ({ message }) => {
      const currentThreadId = threadIdRef.current
      if (!currentThreadId) return

      const parts = (message as { parts?: Array<{ type: string; text?: string }> }).parts
      const content =
        parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("") || ""

      // Save assistant message to DB
      await supabase.from("chat_messages").insert({
        thread_id: currentThreadId,
        role: "assistant",
        content,
      })

      addMessage({
        id: `ai-${Date.now()}`,
        type: "assistant",
        content,
        timestamp: new Date(),
      })
    },
    onError: (error) => {
      toast.error("Chat error", { description: error.message })
    },
  })

  const isAiLoading = aiStatus === "streaming" || aiStatus === "submitted"

  // --- URL Submission ---

  const submitUrl = useCallback(
    async (url: string, urlMeta: UrlMeta) => {
      if (!userId) {
        toast.error("Please sign in to continue")
        return
      }

      setState("processing")

      addMessage({
        id: `user-url-${Date.now()}`,
        type: "user-url",
        content: url,
        url,
        urlMeta,
        timestamp: new Date(),
      })

      try {
        const normalizedUrlValue = normalizeUrl(url)

        // Check if user already has this URL analyzed
        const { data: existingContent } = await supabase
          .from("content")
          .select("id, full_text, title")
          .eq("url", normalizedUrlValue)
          .eq("user_id", userId)
          .order("date_added", { ascending: false })
          .limit(1)
          .maybeSingle()

        // If existing content has full_text, check if a summary in this language already exists
        if (existingContent?.full_text) {
          const { data: existingSummary } = await supabase
            .from("summaries")
            .select("processing_status")
            .eq("content_id", existingContent.id)
            .eq("language", analysisLanguage)
            .maybeSingle()

          if (existingSummary?.processing_status === "complete") {
            setContentId(existingContent.id)
            onContentCreated?.(existingContent.id)
            setState("idle")
            return
          }

          // Content exists with full_text but no summary in this language — reuse it
          await supabase
            .from("content")
            .update({ analysis_language: analysisLanguage })
            .eq("id", existingContent.id)

          setContentId(existingContent.id)
          onContentCreated?.(existingContent.id)

          fetch("/api/process-content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content_id: existingContent.id, language: analysisLanguage }),
          }).then(async (res) => {
            if (res.status === 403) {
              const data = await res.json().catch(() => ({}))
              if (data.upgrade_required) {
                toast.error("Analysis limit reached", {
                  description: data.error || "Upgrade your plan for more analyses.",
                  action: { label: "View Plans", onClick: () => window.open("/pricing", "_blank") },
                })
              }
            }
          }).catch(console.error)

          startPolling(existingContent.id)
          return
        }

        // No existing content — fetch title and create new record
        let contentTitle: string | null = null
        try {
          const titleResponse = await fetch("/api/fetch-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, type: urlMeta.type }),
          })
          if (titleResponse.ok) {
            const titleData = await titleResponse.json()
            contentTitle = titleData.title
          }
        } catch {
          console.warn("Title fetch failed, using placeholder")
        }

        const title =
          contentTitle ||
          `Analyzing: ${url.substring(0, 50)}${url.length > 50 ? "..." : ""}`

        const { data: newContent, error: insertError } = await supabase
          .from("content")
          .insert([
            { url: normalizedUrlValue, type: urlMeta.type, user_id: userId, title, full_text: null, analysis_language: analysisLanguage },
          ])
          .select("id")
          .single()

        if (insertError || !newContent) {
          toast.error("Failed to start analysis")
          setState("idle")
          return
        }

        setContentId(newContent.id)
        onContentCreated?.(newContent.id)

        fetch("/api/process-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content_id: newContent.id, language: analysisLanguage }),
        }).then(async (res) => {
          if (res.status === 403) {
            const data = await res.json().catch(() => ({}))
            if (data.upgrade_required) {
              toast.error("Analysis limit reached", {
                description: data.error || "Upgrade your plan for more analyses.",
                action: { label: "View Plans", onClick: () => window.open("/pricing", "_blank") },
              })
            }
          }
        }).catch(console.error)

        startPolling(newContent.id)
      } catch {
        toast.error("Something went wrong")
        setState("idle")
      }
    },
    [userId, addMessage, onContentCreated, startPolling, analysisLanguage]
  )

  // --- Suggestion Handling ---

  const handleSuggestion = useCallback(
    async (action: string) => {
      if (!contentStatus) return

      setShowSuggestions(false)
      setState("chatting")

      switch (action) {
        case "executive_summary":
          if (contentStatus.brief_overview) {
            addMessage({
              id: `analysis-exec-${Date.now()}`,
              type: "analysis-executive",
              content: contentStatus.brief_overview,
              timestamp: new Date(),
            })
          }
          break

        case "full_analysis":
          if (contentStatus.detailed_summary) {
            addMessage({
              id: `analysis-full-${Date.now()}`,
              type: "analysis-full",
              content: contentStatus.detailed_summary,
              timestamp: new Date(),
            })
          } else {
            try {
              const langParam = analysisLanguage !== "en" ? `?language=${analysisLanguage}` : ""
              const response = await fetch(`/api/content-status/${contentId}${langParam}`)
              if (response.ok) {
                const data: ContentStatus = await response.json()
                if (data.detailed_summary) {
                  addMessage({
                    id: `analysis-full-${Date.now()}`,
                    type: "analysis-full",
                    content: data.detailed_summary,
                    timestamp: new Date(),
                  })
                  setContentStatus(data)
                }
              }
            } catch {
              toast.error("Failed to load full analysis")
            }
          }
          break

        case "truth_check":
          if (contentStatus.truth_check) {
            const tc = contentStatus.truth_check
            let content = `**Overall Rating:** ${tc.overall_rating}\n\n`

            if (tc.issues && tc.issues.length > 0) {
              content += `**Issues Found:**\n`
              tc.issues.forEach((issue) => {
                const emoji =
                  issue.severity === "high"
                    ? "\u{1F534}"
                    : issue.severity === "medium"
                    ? "\u26A0\uFE0F"
                    : "\u2139\uFE0F"
                content += `${emoji} **${issue.type}**: ${issue.claim_or_issue}\n- ${issue.assessment}\n\n`
              })
            }

            if (tc.strengths && tc.strengths.length > 0) {
              content += `**Strengths:**\n`
              tc.strengths.forEach((s) => {
                content += `\u2713 ${s}\n`
              })
            }

            if (tc.sources_quality) {
              content += `\n**Sources Quality:** ${tc.sources_quality}`
            }

            addMessage({
              id: `analysis-truth-${Date.now()}`,
              type: "analysis-executive",
              content,
              timestamp: new Date(),
            })
          }
          break

        case "ask_questions":
          break
      }
    },
    [contentStatus, contentId, addMessage, analysisLanguage]
  )

  // --- Chat Messaging ---

  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!userId || !contentId) return

      setState("chatting")
      setShowSuggestions(false)

      addMessage({
        id: `user-${Date.now()}`,
        type: "user",
        content: text,
        timestamp: new Date(),
      })

      // Ensure thread exists
      let currentThreadId = threadId
      if (!currentThreadId) {
        const { data: existingThread } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("user_id", userId)
          .eq("content_id", contentId)
          .single()

        if (existingThread) {
          currentThreadId = existingThread.id
        } else {
          const { data: newThread, error: threadError } = await supabase
            .from("chat_threads")
            .insert({ user_id: userId, content_id: contentId })
            .select("id")
            .single()

          if (threadError || !newThread) {
            toast.error("Failed to create chat session")
            return
          }
          currentThreadId = newThread.id
        }
        setThreadId(currentThreadId)
      }

      await supabase.from("chat_messages").insert({
        thread_id: currentThreadId,
        role: "user",
        content: text,
      })

      sendMessage({ text })
    },
    [userId, contentId, threadId, addMessage, sendMessage]
  )

  // --- Content Loading ---

  const loadContent = useCallback(
    async (id: string) => {
      if (!userId) return

      setContentId(id)
      setState("processing")

      try {
        const langParam = analysisLanguage !== "en" ? `?language=${analysisLanguage}` : ""
        const response = await fetch(`/api/content-status/${id}${langParam}`)
        if (!response.ok) {
          toast.error("Content not found")
          setState("idle")
          return
        }

        const data: ContentStatus = await response.json()
        setContentStatus(data)

        // Load chat history
        const { data: threadData } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("user_id", userId)
          .eq("content_id", id)
          .single()

        if (threadData) {
          setThreadId(threadData.id)

          const { data: messagesData } = await supabase
            .from("chat_messages")
            .select("id, role, content, created_at")
            .eq("thread_id", threadData.id)
            .order("created_at", { ascending: true })
            .limit(50)

          if (messagesData && messagesData.length > 0) {
            const chatMessages: ChatMessageData[] = messagesData.map((m) => ({
              id: m.id,
              type: m.role === "user" ? "user" : "assistant",
              content: m.content,
              timestamp: new Date(m.created_at),
            }))
            setMessages(chatMessages)
            setState("chatting")
            return
          }
        }

        // No chat history - show initial analysis if available
        if (data.triage && data.brief_overview) {
          setMessages([
            {
              id: `analysis-initial-${Date.now()}`,
              type: "analysis-initial",
              content: data.brief_overview,
              triage: data.triage,
              timestamp: new Date(),
            },
          ])
          setState("initial_complete")
          setShowSuggestions(true)
        } else if (data.processing_status !== "complete") {
          startPolling(id)
        } else {
          setState("chatting")
        }
      } catch (error) {
        console.error("Load content error:", error)
        toast.error("Failed to load content")
        setState("idle")
      }
    },
    [userId, startPolling, analysisLanguage]
  )

  // Load initial content if provided
  useEffect(() => {
    if (initialContentId && userId) {
      loadContent(initialContentId)
    }
  }, [initialContentId, userId, loadContent])

  // --- Streaming Message ---

  const streamingMessage: ChatMessageData | null = (() => {
    if (aiStatus !== "streaming") return null

    const lastAiMessage = aiMessages[aiMessages.length - 1]
    if (!lastAiMessage || lastAiMessage.role !== "assistant") return null

    const msgWithParts = lastAiMessage as { parts?: Array<{ type: string; text?: string }>; content?: string }
    const parts = msgWithParts.parts
    const content = parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") || (typeof msgWithParts.content === "string" ? msgWithParts.content : "")

    if (!content) return null

    return {
      id: `streaming-${lastAiMessage.id}`,
      type: "assistant" as ChatMessageType,
      content,
      timestamp: new Date(),
      isStreaming: true,
    }
  })()

  const allMessages = streamingMessage
    ? [...messages, streamingMessage]
    : messages

  return {
    // State
    state,
    contentId,
    messages: allMessages,
    contentStatus,
    showSuggestions,
    analysisError,
    isProcessing: state === "processing",
    isAiLoading,

    // Actions
    submitUrl,
    submitPdf,
    sendChatMessage,
    handleSuggestion,
    loadContent,
    retryAnalysis,

    // Reset
    reset: useCallback(() => {
      setState("idle")
      setContentId(null)
      setThreadId(null)
      setMessages([])
      setContentStatus(null)
      setShowSuggestions(false)
      stopPolling()
    }, [stopPolling]),
  }
}

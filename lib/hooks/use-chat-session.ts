"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { ChatMessageData, ChatMessageType } from "@/components/chat"
import type { TriageData, TruthCheckData } from "@/types/database.types"
import type { AnalysisLanguage } from "@/lib/languages"

export type ChatSessionState =
  | "idle" // No content loaded, waiting for URL
  | "processing" // URL submitted, analysis in progress
  | "initial_complete" // Initial analysis (Quality + TL;DR) done, showing suggestions
  | "chatting" // User is in active chat mode

interface ContentStatus {
  id: string
  title: string | null
  url: string
  type: "youtube" | "article" | "x_post" | "podcast"
  thumbnail_url?: string | null
  author?: string | null
  duration?: number | null
  processing_status: string | null
  triage: TriageData | null
  brief_overview: string | null
  detailed_summary: string | null
  truth_check: TruthCheckData | null
  hasError?: boolean
  errorMessage?: string
}

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
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const pollCountRef = useRef<number>(0)
  const threadIdRef = useRef<string | null>(null)

  // Keep threadId ref in sync
  useEffect(() => {
    threadIdRef.current = threadId
  }, [threadId])

  // AI SDK chat hook for follow-up questions
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

      // Add to our messages
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

  // Helper to add a message
  const addMessage = useCallback((message: ChatMessageData) => {
    setMessages((prev) => [...prev, message])
  }, [])

  // Poll for content status
  const startPolling = useCallback((id: string) => {
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }
    pollCountRef.current = 0
    setAnalysisError(null)

    const MAX_POLL_COUNT = 150 // 5 minutes at 2s intervals

    const poll = async () => {
      pollCountRef.current++

      try {
        const langParam = analysisLanguage !== "en" ? `?language=${analysisLanguage}` : ""
        const response = await fetch(`/api/content-status/${id}${langParam}`)
        if (!response.ok) {
          // Check for specific errors
          if (response.status === 404) {
            setAnalysisError("Content not found. Please try again.")
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
          }
          return
        }

        const data: ContentStatus = await response.json()
        setContentStatus(data)

        // Check for error status
        if (data.processing_status === "error") {
          setAnalysisError("Analysis failed. Please try again.")
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setState("initial_complete")
          return
        }

        // Check for timeout (no progress after many polls)
        if (pollCountRef.current > MAX_POLL_COUNT && !data.brief_overview) {
          setAnalysisError("Analysis is taking too long. Please try again later.")
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setState("initial_complete")
          return
        }

        // Check if initial analysis is ready
        if (data.triage && data.brief_overview) {
          // Add initial analysis message
          setMessages((prev) => {
            // Check if we already have this message
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

          // Stop polling when complete
          if (data.processing_status === "complete") {
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
          }
        }
      } catch (error) {
        console.error("Polling error:", error)
        // Don't set error on transient network issues
      }
    }

    // Poll immediately, then every 2 seconds
    poll()
    pollingRef.current = setInterval(poll, 2000)
  }, [analysisLanguage])

  // Submit a URL for analysis
  const submitUrl = useCallback(
    async (url: string, urlMeta: UrlMeta) => {
      if (!userId) {
        toast.error("Please sign in to continue")
        return
      }

      setState("processing")

      // Add user message showing the URL
      addMessage({
        id: `user-url-${Date.now()}`,
        type: "user-url",
        content: url,
        url,
        urlMeta,
        timestamp: new Date(),
      })

      try {
        // Check if user already has this URL analyzed (reuse content record to skip re-scraping)
        const { data: existingContent } = await supabase
          .from("content")
          .select("id, full_text, title")
          .eq("url", url)
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
            // Already analyzed in this language — navigate directly
            setContentId(existingContent.id)
            onContentCreated?.(existingContent.id)
            setState("idle")
            return
          }

          // Content exists with full_text but no summary in this language — reuse it
          // Update analysis_language on the content record
          await supabase
            .from("content")
            .update({ analysis_language: analysisLanguage })
            .eq("id", existingContent.id)

          setContentId(existingContent.id)
          onContentCreated?.(existingContent.id)

          // Trigger analysis in the new language (will skip scraping since full_text exists)
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

        // Create content record
        const { data: newContent, error: insertError } = await supabase
          .from("content")
          .insert([
            { url, type: urlMeta.type, user_id: userId, title, full_text: null, analysis_language: analysisLanguage },
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

        // Start background processing (non-blocking)
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

        // Start polling for status
        startPolling(newContent.id)
      } catch {
        toast.error("Something went wrong")
        setState("idle")
      }
    },
    [userId, addMessage, onContentCreated, startPolling, analysisLanguage]
  )

  // Handle suggestion button clicks
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
            // Fetch if not loaded yet
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
            // Format truth check as markdown
            const tc = contentStatus.truth_check
            let content = `**Overall Rating:** ${tc.overall_rating}\n\n`

            if (tc.issues && tc.issues.length > 0) {
              content += `**Issues Found:**\n`
              tc.issues.forEach((issue) => {
                const emoji =
                  issue.severity === "high"
                    ? "🔴"
                    : issue.severity === "medium"
                    ? "⚠️"
                    : "ℹ️"
                content += `${emoji} **${issue.type}**: ${issue.claim_or_issue}\n- ${issue.assessment}\n\n`
              })
            }

            if (tc.strengths && tc.strengths.length > 0) {
              content += `**Strengths:**\n`
              tc.strengths.forEach((s) => {
                content += `✓ ${s}\n`
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
          // Just hide suggestions and enable chat mode
          break
      }
    },
    [contentStatus, contentId, addMessage, analysisLanguage]
  )

  // Send a chat message
  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!userId || !contentId) return

      setState("chatting")
      setShowSuggestions(false)

      // Add user message to our list
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

      // Save user message to DB
      await supabase.from("chat_messages").insert({
        thread_id: currentThreadId,
        role: "user",
        content: text,
      })

      // Send to AI
      sendMessage({ text })
    },
    [userId, contentId, threadId, addMessage, sendMessage]
  )

  // Load existing content and chat history
  const loadContent = useCallback(
    async (id: string) => {
      if (!userId) return

      setContentId(id)
      setState("processing")

      try {
        // Fetch content status
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
            .select("*")
            .eq("thread_id", threadData.id)
            .order("created_at", { ascending: true })
            .limit(50)

          if (messagesData && messagesData.length > 0) {
            // Convert to our format
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
          // Still processing
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  // Load initial content if provided
  useEffect(() => {
    if (initialContentId && userId) {
      loadContent(initialContentId)
    }
  }, [initialContentId, userId, loadContent])

  // Retry analysis after error
  const retryAnalysis = useCallback(async () => {
    if (!contentId) return

    setAnalysisError(null)
    setState("processing")

    try {
      // Re-trigger processing
      await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: contentId, force_regenerate: true, language: analysisLanguage }),
      })

      // Start polling again
      startPolling(contentId)
    } catch (error) {
      console.error("Retry error:", error)
      setAnalysisError("Failed to retry analysis. Please try again.")
    }
  }, [contentId, startPolling, analysisLanguage])

  // Submit a PDF for analysis
  const submitPdf = useCallback(
    async (file: File) => {
      if (!userId) {
        toast.error("Please sign in to continue")
        return
      }

      setState("processing")

      // Add user message showing the PDF
      addMessage({
        id: `user-pdf-${Date.now()}`,
        type: "user-url",
        content: `📄 ${file.name}`,
        url: `pdf://${file.name}`,
        urlMeta: {
          domain: "PDF Upload",
          type: "article" as const,
          favicon: "",
        },
        timestamp: new Date(),
      })

      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("userId", userId)
        if (analysisLanguage !== "en") {
          formData.append("language", analysisLanguage)
        }

        const response = await fetch("/api/process-pdf", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          toast.error(data.error || "Failed to upload PDF")
          setState("idle")
          return
        }

        const data = await response.json()
        setContentId(data.contentId)
        onContentCreated?.(data.contentId)

        // Start polling for status
        startPolling(data.contentId)
      } catch (error) {
        console.error("PDF upload error:", error)
        toast.error("Failed to upload PDF")
        setState("idle")
      }
    },
    [userId, addMessage, onContentCreated, startPolling, analysisLanguage]
  )

  // Get streaming message from AI SDK
  const streamingMessage: ChatMessageData | null = (() => {
    if (aiStatus !== "streaming") return null

    const lastAiMessage = aiMessages[aiMessages.length - 1]
    if (!lastAiMessage || lastAiMessage.role !== "assistant") return null

    // Extract text content from the message parts
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

  // Combine regular messages with streaming message
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
      setAnalysisError(null)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }, []),
  }
}

"use client"

import { useState, useEffect, useCallback, useRef, type FormEvent, type ChangeEvent } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { supabase } from "@/lib/supabase"
import type { Session } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { Send, MessageSquare, Loader2, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "./markdown-renderer"

interface ChatPanelProps {
  contentId: string
  session: Session | null
}

export function ChatPanel({ contentId, session }: ChatPanelProps) {
  const storageKey = `chat-panel-open-${contentId}`

  const [isPanelOpen, setIsPanelOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false
    }
    try {
      const item = window.localStorage.getItem(storageKey)
      return item ? JSON.parse(item) : false
    } catch (error) {
      console.error("Error reading from localStorage", error)
      return false
    }
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(isPanelOpen))
      } catch (error) {
        console.error("Error writing to localStorage", error)
      }
    }
  }, [isPanelOpen, storageKey])

  const [threadId, setThreadId] = useState<string | null>(null)
  const threadIdRef = useRef<string | null>(threadId)
  useEffect(() => {
    threadIdRef.current = threadId
  }, [threadId])

  const [localInput, setLocalInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevThreadId = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const userId = session?.user?.id

  const { messages, setMessages, status, sendMessage } = useChat({
    id: contentId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { contentId },
    }),
    onFinish: async (message) => {
      const currentThreadId = threadIdRef.current
      if (!currentThreadId) {
        console.error("onFinish: Could not find threadId to save assistant message.")
        toast.error("Failed to save assistant's response: Chat session not found.")
        return
      }
      const content =
        message.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("") || ""

      await supabase.from("chat_messages").insert({
        thread_id: currentThreadId,
        role: "assistant",
        content,
      })
      inputRef.current?.focus()
    },
    onError: (error) => {
      toast.error("Chat error", { description: error.message })
    },
  })

  const isLoading = status === "in_progress"

  const handleLocalInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalInput(e.target.value)
  }

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    const isNewThreadLoaded = threadId !== prevThreadId.current && threadId !== null
    if (isNewThreadLoaded && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView()
      prevThreadId.current = threadId
      return
    }
    if (lastMessage?.role === "user") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, threadId])

  const fetchThreadAndMessages = useCallback(async () => {
    if (!userId) return

    setThreadId(null)
    setMessages([])

    const { data: threadData, error: threadError } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("user_id", userId)
      .eq("content_id", contentId)
      .single()

    if (threadError && threadError.code !== "PGRST116") {
      toast.error("Failed to load chat session", { description: threadError.message })
      return
    }

    if (threadData) {
      setThreadId(threadData.id)
      const { data: messagesData, error: messagesError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", threadData.id)
        .order("created_at", { ascending: true })

      if (messagesError) {
        toast.error("Failed to load messages", { description: messagesError.message })
      } else {
        setMessages(
          messagesData.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: m.content }],
          })),
        )
      }
    } else {
      prevThreadId.current = null
    }
  }, [userId, contentId, setMessages])

  useEffect(() => {
    if (userId && isPanelOpen) {
      fetchThreadAndMessages()
    }
  }, [userId, contentId, isPanelOpen, fetchThreadAndMessages])

  useEffect(() => {
    if (isPanelOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isPanelOpen])

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!localInput.trim() || !userId) return

    const currentInputValue = localInput
    setLocalInput("")
    inputRef.current?.focus()

    try {
      let currentThreadId = threadId
      if (!currentThreadId) {
        const { data: newThread, error: threadError } = await supabase
          .from("chat_threads")
          .insert({ user_id: userId, content_id: contentId })
          .select("id")
          .single()

        if (threadError || !newThread) {
          throw new Error(threadError?.message || "Failed to create new chat session.")
        }
        currentThreadId = newThread.id
        setThreadId(currentThreadId)
      }

      await supabase.from("chat_messages").insert({
        thread_id: currentThreadId,
        role: "user",
        content: currentInputValue,
      })

      sendMessage({ text: currentInputValue })
    } catch (error: any) {
      console.error("Error during form submission process:", error)
      toast.error("Error sending message", { description: error.message })
      setLocalInput(currentInputValue)
    }
  }

  const handleClearChat = async () => {
    if (!threadId || !window.confirm("Are you sure you want to clear this chat history? This cannot be undone.")) return

    const { error: messagesError } = await supabase.from("chat_messages").delete().eq("thread_id", threadId)

    if (messagesError) {
      toast.error("Failed to clear chat messages", { description: messagesError.message })
      return
    }

    const { error: threadError } = await supabase.from("chat_threads").delete().eq("id", threadId)

    if (threadError) {
      toast.error("Failed to delete chat session", { description: threadError.message })
      return
    }

    setMessages([])
    setThreadId(null)
    toast.success("Chat history cleared")
    inputRef.current?.focus()
  }

  const getMessageContent = (message: (typeof messages)[0]): string => {
    if ("parts" in message && Array.isArray(message.parts)) {
      return message.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("")
    }
    // Fallback for old format
    if ("content" in message) {
      return (message as any).content || ""
    }
    return ""
  }

  if (!userId) return null

  return (
    <div className="fixed bottom-16 sm:bottom-4 right-0 sm:right-4 w-full sm:w-[420px] z-30">
      <div className="bg-black/80 backdrop-blur-xl border border-white/[0.08] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="w-full p-4 flex justify-between items-center cursor-pointer hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#1d9bf0]" />
            <h3 className="font-semibold text-white">Chat with Content</h3>
          </div>
          <div className="flex items-center gap-2">
            {isPanelOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearChat()
                }}
                disabled={!threadId || messages.length === 0}
                className="h-8 px-3 text-xs text-gray-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:hover:bg-transparent rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clear
              </Button>
            )}
            {isPanelOpen ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Chat area */}
        {isPanelOpen && (
          <div className="flex flex-col h-[60vh] border-t border-white/[0.08]">
            <ScrollArea className="flex-grow">
              <div className="p-4 space-y-3">
                {messages.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 pt-16">
                    <MessageSquare className="w-12 h-12 mb-3 text-gray-600" />
                    <p className="text-sm">Ask anything about this content.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "p-3 rounded-2xl max-w-[85%] backdrop-blur-xl",
                        m.role === "user"
                          ? "bg-[#1d9bf0] text-white shadow-lg shadow-blue-500/20"
                          : "bg-white/[0.06] text-white border border-white/[0.08]",
                      )}
                    >
                      <div className="text-sm">
                        <MarkdownRenderer>{getMessageContent(m)}</MarkdownRenderer>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 p-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-[#1d9bf0]" />
                      <span className="text-xs text-gray-400">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <form
              onSubmit={handleFormSubmit}
              className="p-3 border-t border-white/[0.08] flex items-center gap-2 bg-white/[0.02]"
            >
              <Input
                ref={inputRef}
                value={localInput}
                onChange={handleLocalInputChange}
                placeholder="Ask anything..."
                className="flex-grow bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-500 focus:ring-2 focus:ring-[#1d9bf0] focus:border-[#1d9bf0] rounded-xl h-11 backdrop-blur-xl"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 rounded-xl bg-[#1d9bf0] hover:bg-[#1a8cd8] disabled:opacity-50 shadow-lg shadow-blue-500/20"
                disabled={isLoading || !localInput.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

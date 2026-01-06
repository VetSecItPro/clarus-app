"use client"

import { useState, useEffect, useCallback, useRef, memo, type FormEvent, type ChangeEvent } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { supabase } from "@/lib/supabase"
import type { Session } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { Send, MessageSquare, Loader2, X, Trash2, Shield, User, Mic, Square, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "./markdown-renderer"
import { useSpeechToText, useTextToSpeech } from "@/lib/hooks/use-speech"

// Types for messages
interface ChatMessage {
  id?: string
  role: "user" | "assistant"
  parts?: Array<{ type: string; text?: string }>
  content?: string
}

// Helper function to extract message content
const getMessageContentFromParts = (message: ChatMessage): string => {
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("")
  }
  return message.content || ""
}

// Memoized message component to prevent re-renders
interface ChatMessageBubbleProps {
  message: ChatMessage
  index: number
  isSpeaking: boolean
  speakingMessageIndex: number | null
  ttsSupported: boolean
  onSpeak: (text: string, index: number) => void
  onStopSpeaking: () => void
}

const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  index,
  isSpeaking,
  speakingMessageIndex,
  ttsSupported,
  onSpeak,
  onStopSpeaking,
}: ChatMessageBubbleProps) {
  const content = getMessageContentFromParts(message)

  return (
    <div className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}>
      {/* Assistant avatar */}
      {message.role === "assistant" && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1d9bf0] flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Shield className="w-4 h-4 text-white" />
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl max-w-[80%] backdrop-blur-xl overflow-hidden",
          message.role === "user"
            ? "bg-[#1d9bf0] text-white shadow-lg shadow-blue-500/20 px-4 py-2.5"
            : "bg-white/[0.04] border border-white/[0.08]",
        )}
      >
        {message.role === "user" ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="p-3 chat-assistant-message group relative">
            <MarkdownRenderer className="text-sm [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-white/90 [&_h3]:mt-2 [&_h3]:mb-1 [&_li]:text-sm [&_strong]:text-white [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-white/10 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_a]:text-blue-400 [&_a]:underline">
              {content}
            </MarkdownRenderer>
            {/* Per-message speaker icon - always visible on mobile, hover on desktop */}
            {ttsSupported && (
              <button
                onClick={() => {
                  if (speakingMessageIndex === index && isSpeaking) {
                    onStopSpeaking()
                  } else {
                    onSpeak(content, index)
                  }
                }}
                className={cn(
                  "absolute top-2 right-2 w-6 h-6 flex items-center justify-center transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                  speakingMessageIndex === index && isSpeaking
                    ? "text-[#1d9bf0] opacity-100"
                    : "text-gray-500 hover:text-gray-300"
                )}
                aria-label={speakingMessageIndex === index && isSpeaking ? "Stop" : "Listen"}
              >
                {speakingMessageIndex === index && isSpeaking ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {message.role === "user" && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1d9bf0] flex items-center justify-center shadow-lg">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  )
})

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
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevThreadId = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const userId = session?.user?.id

  // Speech hooks - continuous mode keeps listening until user clicks stop
  const {
    isListening,
    isSupported: sttSupported,
    startListening,
    stopListening,
    transcript,
  } = useSpeechToText({
    // No onResult needed - we use the transcript directly via useEffect below
    onError: (error) => {
      toast.error("Speech recognition error", { description: error })
    },
    continuous: true, // Keep listening until user explicitly stops
  })

  const {
    isSpeaking,
    isSupported: ttsSupported,
    speak,
    stop: stopSpeaking,
  } = useTextToSpeech({
    rate: 0.9,  // Slightly slower for more natural sound
    pitch: 1.05,
    volume: 1,
  })

  // Update input with transcript while listening (and keep it when done)
  useEffect(() => {
    if (transcript) {
      setLocalInput(transcript)
    }
  }, [transcript])

  // Reset speaking message index when speech ends
  useEffect(() => {
    if (!isSpeaking) {
      setSpeakingMessageIndex(null)
    }
  }, [isSpeaking])

  const { messages, setMessages, status, sendMessage } = useChat({
    id: contentId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { contentId },
    }),
    onFinish: async ({ message }) => {
      const currentThreadId = threadIdRef.current
      if (!currentThreadId) {
        console.error("onFinish: Could not find threadId to save assistant message.")
        toast.error("Failed to save assistant's response: Chat session not found.")
        return
      }
      const parts = (message as { parts?: Array<{ type: string; text?: string }> }).parts
      const content =
        parts
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

  const isLoading = status === "streaming" || status === "submitted"

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
        .order("created_at", { ascending: false })
        .limit(50) // Limit to last 50 messages for performance
        .then(res => ({
          ...res,
          data: res.data?.reverse() // Reverse to show oldest first
        }))

      if (messagesError) {
        toast.error("Failed to load messages", { description: messagesError.message })
      } else if (messagesData) {
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

  const getMessageContent = useCallback((message: (typeof messages)[0]): string => {
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
  }, [])

  // Callback for speaking a message
  const handleSpeak = useCallback((text: string, index: number) => {
    if (isSpeaking) stopSpeaking()
    setSpeakingMessageIndex(index)
    speak(text)
  }, [isSpeaking, stopSpeaking, speak])

  // Callback for stopping speaking
  const handleStopSpeaking = useCallback(() => {
    stopSpeaking()
    setSpeakingMessageIndex(null)
  }, [stopSpeaking])

  if (!userId) return null

  // Floating icon when collapsed
  if (!isPanelOpen) {
    return (
      <button
        onClick={() => setIsPanelOpen(true)}
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-30 w-14 h-14 rounded-full bg-[#1d9bf0] hover:bg-[#1a8cd8] shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label="Open chat"
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>
    )
  }

  return (
    <>
      {/* Backdrop - click to close */}
      <div
        className="fixed inset-0 z-20 bg-black/20 sm:bg-transparent"
        onClick={() => setIsPanelOpen(false)}
        aria-hidden="true"
      />
      <div className="fixed bottom-16 sm:bottom-4 right-0 sm:right-4 w-full sm:w-[420px] z-30">
        <div className="bg-black/80 backdrop-blur-xl border border-white/[0.08] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="w-full p-4 flex justify-between items-center border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#1d9bf0]" />
            <h3 className="font-semibold text-white">Chat with Content</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Text-to-speech button - reads last assistant message */}
            {ttsSupported && messages.some(m => m.role === "assistant") && (
              <button
                onClick={() => {
                  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant")
                  if (lastAssistantMsg) {
                    if (isSpeaking) {
                      stopSpeaking()
                    } else {
                      speak(getMessageContent(lastAssistantMsg))
                    }
                  }
                }}
                className={cn(
                  "h-8 px-2 flex items-center gap-1.5 text-xs transition-colors",
                  isSpeaking
                    ? "text-[#1d9bf0]"
                    : "text-gray-400 hover:text-gray-200"
                )}
                aria-label={isSpeaking ? "Stop speaking" : "Listen to response"}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Listen</span>
                  </>
                )}
              </button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              disabled={!threadId || messages.length === 0}
              className="h-8 px-3 text-xs text-gray-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:hover:bg-transparent rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear
            </Button>
            <button
              onClick={() => setIsPanelOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex flex-col h-[60vh]">
            <ScrollArea className="flex-grow">
              <div className="p-4 space-y-3">
                {messages.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 pt-16">
                    <MessageSquare className="w-12 h-12 mb-3 text-gray-600" />
                    <p className="text-sm">Ask anything about this content.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <ChatMessageBubble
                    key={m.id || i}
                    message={m as ChatMessage}
                    index={i}
                    isSpeaking={isSpeaking}
                    speakingMessageIndex={speakingMessageIndex}
                    ttsSupported={ttsSupported}
                    onSpeak={handleSpeak}
                    onStopSpeaking={handleStopSpeaking}
                  />
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-2 justify-start">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1d9bf0] flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl">
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
              {/* Microphone button */}
              {sttSupported && (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={cn(
                    "h-11 w-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 relative",
                    isListening
                      ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30"
                      : "bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.08]"
                  )}
                  aria-label={isListening ? "Stop recording" : "Start voice input"}
                  disabled={isLoading}
                >
                  {isListening ? (
                    <>
                      {/* Pulsing ring animation */}
                      <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-30" />
                      <Square className="w-4 h-4 relative z-10 fill-white" />
                    </>
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
              )}
              {/* Input wrapper with listening indicator */}
              <div className="flex-grow relative">
                <Input
                  ref={inputRef}
                  value={localInput}
                  onChange={handleLocalInputChange}
                  placeholder={isListening ? "" : "Ask anything..."}
                  className={cn(
                    "w-full bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-500 focus:ring-2 focus:ring-[#1d9bf0] focus:border-[#1d9bf0] rounded-xl h-11 backdrop-blur-xl transition-all",
                    isListening && "border-red-500/50 ring-1 ring-red-500/30",
                    isListening && !localInput && "pl-[155px]", // Extra padding for "Listening... speak now"
                    isListening && localInput && "pr-[90px]"   // Extra padding for "Recording" on right
                  )}
                  disabled={isLoading}
                />
                {/* Listening status indicator - shows when no transcript yet */}
                {isListening && !localInput && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {/* Animated sound bars */}
                    <div className="flex items-center gap-0.5 h-4">
                      <span className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]" style={{ height: '40%', animationDelay: '0ms' }} />
                      <span className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]" style={{ height: '70%', animationDelay: '150ms' }} />
                      <span className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]" style={{ height: '100%', animationDelay: '300ms' }} />
                      <span className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]" style={{ height: '60%', animationDelay: '450ms' }} />
                    </div>
                    <span className="text-xs text-red-400 font-medium">Listening... speak now</span>
                  </div>
                )}
                {/* Recording indicator - shows when transcribing */}
                {isListening && localInput && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs text-red-400 font-medium">Recording</span>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 rounded-xl bg-[#1d9bf0] hover:bg-[#1a8cd8] disabled:opacity-50 shadow-lg shadow-blue-500/20 flex-shrink-0"
                disabled={isLoading || !localInput.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

"use client"

import { useState, useEffect, useCallback, useRef, memo, type FormEvent, type ChangeEvent } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { supabase } from "@/lib/supabase"
import type { Session } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Send, MessageSquare, Loader2, Trash2, Shield, User, Mic, Square, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "./markdown-renderer"
import { useSpeechToText, useTextToSpeech } from "@/lib/hooks/use-speech"
import { SuggestionChips } from "@/components/chat/suggestion-buttons"
import type { ContentCategory } from "@/types/database.types"

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

// Memoized message component
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
      {message.role === "assistant" && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1d9bf0] flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Shield className="w-3 h-3 text-white" />
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl max-w-[85%] backdrop-blur-xl overflow-hidden",
          message.role === "user"
            ? "bg-[#1d9bf0] text-white shadow-lg shadow-blue-500/20 px-3 py-2"
            : "bg-white/[0.04] border border-white/[0.08]",
        )}
      >
        {message.role === "user" ? (
          <p className="text-xs whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="p-2.5 chat-assistant-message group relative">
            <MarkdownRenderer className="text-xs [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-medium [&_h3]:text-white/90 [&_h3]:mt-1.5 [&_h3]:mb-0.5 [&_li]:text-xs [&_strong]:text-white [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px] [&_pre]:bg-white/10 [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_a]:text-blue-400 [&_a]:underline">
              {content}
            </MarkdownRenderer>
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
                  "absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                  speakingMessageIndex === index && isSpeaking
                    ? "text-[#1d9bf0] opacity-100"
                    : "text-gray-500 hover:text-gray-300"
                )}
                aria-label={speakingMessageIndex === index && isSpeaking ? "Stop" : "Listen"}
              >
                {speakingMessageIndex === index && isSpeaking ? (
                  <VolumeX className="w-3 h-3" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {message.role === "user" && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1d9bf0] flex items-center justify-center shadow-lg">
          <User className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  )
})

// Context-aware suggestion chip generator
function getSuggestionChips(contentType?: string | null, contentCategory?: ContentCategory | null): string[] {
  const baseChips = [
    "What's the signal-to-noise ratio?",
    "Summarize the key claims",
    "Are the sources reliable?",
  ]

  if (contentCategory === "news" || contentCategory === "opinion") {
    return [
      "What's the signal-to-noise ratio?",
      "Are the sources reliable?",
      "What's the bias assessment?",
      "What are the counter-arguments?",
    ]
  }

  if (contentCategory === "educational" || contentCategory === "tech") {
    return [
      "What are the key concepts?",
      "Summarize the main takeaways",
      "What should I learn next?",
      "Are the claims accurate?",
    ]
  }

  if (contentCategory === "podcast") {
    return [
      "What are the key takeaways?",
      "Who is the guest?",
      "What actionable advice was given?",
      "What's the signal-to-noise ratio?",
    ]
  }

  if (contentType === "youtube") {
    return [
      ...baseChips,
      "What should I do with this info?",
    ]
  }

  return [
    ...baseChips,
    "What should I do with this info?",
  ]
}

interface InlineChatProps {
  contentId: string
  session: Session
  contentType?: string | null
  contentCategory?: ContentCategory | null
}

export function InlineChat({ contentId, session, contentType, contentCategory }: InlineChatProps) {
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
  const userId = session.user.id

  // Speech hooks
  const {
    isListening,
    isSupported: sttSupported,
    startListening,
    stopListening,
    transcript,
  } = useSpeechToText({
    onError: (error) => {
      toast.error("Speech recognition error", { description: error })
    },
    continuous: true,
  })

  const {
    isSpeaking,
    isSupported: ttsSupported,
    speak,
    stop: stopSpeaking,
  } = useTextToSpeech({
    rate: 0.9,
    pitch: 1.05,
    volume: 1,
  })

  // Update input with transcript
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
    id: `inline-${contentId}`,
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

      await supabase.from("chat_messages").insert({
        thread_id: currentThreadId,
        role: "assistant",
        content,
      })
      inputRef.current?.focus()
    },
    onError: (error) => {
      const msg = error.message ?? ""
      if (msg.includes("limit reached") || msg.includes("Upgrade")) {
        toast.error("Chat limit reached", {
          description: "Upgrade your plan for unlimited chat messages.",
          action: { label: "View Plans", onClick: () => window.open("/pricing", "_blank") },
        })
      } else {
        toast.error("Chat error", { description: msg })
      }
    },
  })

  const isLoading = status === "streaming" || status === "submitted"

  const handleLocalInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalInput(e.target.value)
  }

  // Auto-scroll on new messages
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

  // Load existing thread
  const fetchThreadAndMessages = useCallback(async () => {
    if (!userId) return

    setThreadId(null)
    setMessages([])

    const { data: threadData, error: threadError } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("user_id", userId)
      .eq("content_id", contentId)
      .maybeSingle()

    if (threadError) {
      return
    }

    if (threadData) {
      setThreadId(threadData.id)
      const { data: messagesData } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", threadData.id)
        .order("created_at", { ascending: false })
        .limit(50)
        .then(res => ({
          ...res,
          data: res.data?.reverse()
        }))

      if (messagesData) {
        setMessages(
          messagesData.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: m.content }],
          })),
        )
      }
    }
  }, [userId, contentId, setMessages])

  useEffect(() => {
    if (userId) {
      fetchThreadAndMessages()
    }
  }, [userId, contentId, fetchThreadAndMessages])

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
          throw new Error(threadError?.message || "Failed to create chat session.")
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error("Error sending message", { description: message })
      setLocalInput(currentInputValue)
    }
  }

  // Send a suggestion chip as a message
  const handleSuggestionClick = (text: string) => {
    setLocalInput(text)
    // Auto-submit in next tick after state update
    setTimeout(() => {
      const form = document.getElementById("inline-chat-form") as HTMLFormElement
      if (form) form.requestSubmit()
    }, 0)
  }

  const handleClearChat = async () => {
    if (!threadId || !window.confirm("Clear chat history?")) return

    await supabase.from("chat_messages").delete().eq("thread_id", threadId)
    await supabase.from("chat_threads").delete().eq("id", threadId)

    setMessages([])
    setThreadId(null)
    toast.success("Chat cleared")
    inputRef.current?.focus()
  }

  const handleSpeak = useCallback((text: string, index: number) => {
    if (isSpeaking) stopSpeaking()
    setSpeakingMessageIndex(index)
    speak(text)
  }, [isSpeaking, stopSpeaking, speak])

  const handleStopSpeaking = useCallback(() => {
    stopSpeaking()
    setSpeakingMessageIndex(null)
  }, [stopSpeaking])

  const suggestionChips = getSuggestionChips(contentType, contentCategory)

  return (
    <div className="flex flex-col rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 flex justify-between items-center border-b border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-[#1d9bf0]" />
          <h3 className="text-xs font-semibold text-white">Chat about this content</h3>
        </div>
        {threadId && messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="h-6 px-2 text-[10px] text-gray-400 hover:text-white hover:bg-white/[0.08] rounded-md transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Messages area - fixed max height with own scroll */}
      <div className="h-[400px] lg:h-[360px] overflow-y-auto subtle-scrollbar">
        <div className="p-3 space-y-2.5">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center text-center text-gray-500 py-4">
              <MessageSquare className="w-8 h-8 mb-2 text-gray-600" />
              <p className="text-xs text-gray-400 mb-3">Chat about this content</p>
              {/* Suggestion chips */}
              <SuggestionChips
                onSelect={handleSuggestionClick}
                suggestions={suggestionChips}
                disabled={isLoading}
              />
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
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1d9bf0] flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Shield className="w-3 h-3 text-white" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <Loader2 className="w-3 h-3 animate-spin text-[#1d9bf0]" />
                <span className="text-[10px] text-gray-400">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <form
        id="inline-chat-form"
        onSubmit={handleFormSubmit}
        className="p-2 border-t border-white/[0.08] flex items-center gap-1.5 bg-white/[0.02]"
      >
        {/* Mic button */}
        {sttSupported && (
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0 relative",
              isListening
                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30"
                : "bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.08]"
            )}
            aria-label={isListening ? "Stop recording" : "Start voice input"}
            disabled={isLoading}
          >
            {isListening ? (
              <>
                <span className="absolute inset-0 rounded-lg bg-red-500 animate-ping opacity-30" />
                <Square className="w-3 h-3 relative z-10 fill-white" />
              </>
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        <div className="flex-grow relative">
          <Input
            ref={inputRef}
            value={localInput}
            onChange={handleLocalInputChange}
            placeholder={isListening ? "" : "Chat about this content..."}
            className={cn(
              "w-full bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-500 focus:ring-1 focus:ring-[#1d9bf0] focus:border-[#1d9bf0] rounded-lg h-9 text-xs",
              isListening && "border-red-500/50 ring-1 ring-red-500/30",
              isListening && !localInput && "pl-[130px]",
            )}
            disabled={isLoading}
          />
          {isListening && !localInput && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 h-3">
                <span className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]" style={{ height: '40%', animationDelay: '0ms' }} />
                <span className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]" style={{ height: '70%', animationDelay: '150ms' }} />
                <span className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]" style={{ height: '100%', animationDelay: '300ms' }} />
                <span className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]" style={{ height: '60%', animationDelay: '450ms' }} />
              </div>
              <span className="text-[10px] text-red-400 font-medium">Listening...</span>
            </div>
          )}
          {isListening && localInput && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-red-400 font-medium">Rec</span>
            </div>
          )}
        </div>
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 rounded-lg bg-[#1d9bf0] hover:bg-[#1a8cd8] disabled:opacity-50 shadow-lg shadow-blue-500/20 flex-shrink-0"
          disabled={isLoading || !localInput.trim()}
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  )
}

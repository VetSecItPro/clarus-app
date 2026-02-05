"use client"

import { useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatMessage, type ChatMessageData } from "./chat-message"
import { Loader2 } from "lucide-react"

interface ChatMessagesAreaProps {
  messages: ChatMessageData[]
  isLoading?: boolean
  loadingText?: string
  emptyState?: React.ReactNode
  className?: string
}

export function ChatMessagesArea({
  messages,
  isLoading = false,
  loadingText = "Analyzing...",
  emptyState,
  className,
}: ChatMessagesAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLength = useRef(messages.length)

  // Check if the last message is streaming (don't show loading indicator if so)
  const hasStreamingMessage = useMemo(() => {
    const lastMessage = messages[messages.length - 1]
    return lastMessage?.isStreaming === true
  }, [messages])

  // Auto-scroll when new messages are added or content changes
  useEffect(() => {
    if (messages.length > prevMessagesLength.current || hasStreamingMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    prevMessagesLength.current = messages.length
  }, [messages.length, hasStreamingMessage, messages])

  // Also scroll when loading state changes (new message incoming)
  useEffect(() => {
    if (isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [isLoading])

  // Only show loading indicator when loading AND not already streaming
  const showLoadingIndicator = isLoading && !hasStreamingMessage

  return (
    <ScrollArea className={className}>
      <div className="p-4 space-y-4">
        {/* Empty state */}
        {messages.length === 0 && !isLoading && emptyState}

        {/* Messages */}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Loading indicator - only show when not streaming */}
        {showLoadingIndicator && (
          <div className="flex gap-2 justify-start">
            <Image
              src="/clarus-logo.webp"
              alt="Clarus"
              width={28}
              height={28}
              sizes="28px"
              className="flex-shrink-0 w-7 h-7 rounded-full"
            />
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl">
              <Loader2 className="w-4 h-4 animate-spin text-[#1d9bf0]" />
              <span className="text-xs text-gray-400">{loadingText}</span>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  )
}

"use client"

import { memo } from "react"
import Image from "next/image"
import { User, Link2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import type { TriageData, TruthCheckData } from "@/types/database.types"
import { motion } from "framer-motion"

export type ChatMessageType =
  | "user"
  | "user-url"
  | "assistant"
  | "analysis-initial" // Quality + TL;DR
  | "analysis-executive"
  | "analysis-full"
  | "analysis-truth"
  | "system"

export interface ChatMessageData {
  id: string
  type: ChatMessageType
  content: string
  timestamp?: Date
  isStreaming?: boolean
  // For analysis messages
  triage?: TriageData
  truthCheck?: TruthCheckData
  url?: string
  urlMeta?: {
    domain: string
    type: "youtube" | "article" | "x_post" | "podcast"
    favicon: string
    title?: string
  }
}

interface ChatMessageProps {
  message: ChatMessageData
  showTimestamp?: boolean
}

// User URL message - shows the submitted URL
function UserUrlMessage({ message }: { message: ChatMessageData }) {
  const { url, urlMeta } = message

  return (
    <div className="flex gap-2 justify-end">
      <div className="max-w-[85%] sm:max-w-[75%]">
        <div className="rounded-2xl bg-[#1d9bf0] text-white shadow-lg shadow-blue-500/20 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-4 h-4" />
            <span className="text-sm font-medium">Analyze this</span>
          </div>
          {urlMeta && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-white/10">
              {urlMeta.favicon && (
                <Image
                  src={urlMeta.favicon}
                  alt=""
                  width={16}
                  height={16}
                  className="w-4 h-4"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              )}
              <span className="text-xs text-white/80 truncate flex-1">
                {urlMeta.domain}
              </span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {!urlMeta && url && (
            <p className="text-xs text-white/80 truncate">{url}</p>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1d9bf0] flex items-center justify-center shadow-lg">
        <User className="w-4 h-4 text-white" />
      </div>
    </div>
  )
}

// User text message
function UserTextMessage({ message }: { message: ChatMessageData }) {
  return (
    <div className="flex gap-2 justify-end">
      <div className="rounded-2xl bg-[#1d9bf0] text-white shadow-lg shadow-blue-500/20 px-4 py-2.5 max-w-[85%] sm:max-w-[75%]">
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1d9bf0] flex items-center justify-center shadow-lg">
        <User className="w-4 h-4 text-white" />
      </div>
    </div>
  )
}

// Assistant wrapper with avatar
function AssistantWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 justify-start" style={{ maxWidth: "600px" }}>
      <Image
        src="/clarus-logo.png"
        alt="Clarus"
        width={28}
        height={28}
        className="flex-shrink-0 w-7 h-7 rounded-full"
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// Initial analysis message - Quality Score + TL;DR
function AnalysisInitialMessage({ message }: { message: ChatMessageData }) {
  const { triage, content } = message

  return (
    <AssistantWrapper>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white/[0.04] border border-white/[0.08] overflow-hidden"
      >
        {/* Quality Score Header */}
        {triage && (
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="text-xs text-white/40 uppercase tracking-wider">
                  Quality
                </div>
                <div className="text-2xl font-bold text-white">
                  {triage.quality_score}
                  <span className="text-base text-white/40">/10</span>
                </div>
              </div>
              {triage.signal_noise_score !== undefined && (
                <RecommendationBadge score={triage.signal_noise_score} />
              )}
            </div>
            {/* Quality progress bar */}
            <div className="mt-3 h-2 bg-white/[0.1] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${triage.quality_score * 10}%` }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="h-full rounded-full bg-[#1d9bf0]"
              />
            </div>
          </div>
        )}

        {/* TL;DR Content */}
        <div className="p-4">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
            TL;DR
          </div>
          <p className="text-sm text-white/90 leading-relaxed">{content}</p>
        </div>
      </motion.div>
    </AssistantWrapper>
  )
}

// Recommendation badge component
const RECOMMENDATION_LABELS = [
  {
    label: "Skip",
    color: "text-red-400",
    bg: "bg-red-500/20",
    border: "border-red-500/30",
  },
  {
    label: "Skim",
    color: "text-orange-400",
    bg: "bg-orange-500/20",
    border: "border-orange-500/30",
  },
  {
    label: "Worth It",
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
  },
  {
    label: "Must See",
    color: "text-green-400",
    bg: "bg-green-500/20",
    border: "border-green-500/30",
  },
]

function RecommendationBadge({ score }: { score: number }) {
  const rec = RECOMMENDATION_LABELS[score] || RECOMMENDATION_LABELS[0]
  return (
    <div
      className={`px-3 py-1.5 rounded-full ${rec.bg} ${rec.border} border`}
    >
      <span className={`text-sm font-semibold ${rec.color}`}>{rec.label}</span>
    </div>
  )
}

// Executive summary message
function AnalysisExecutiveMessage({ message }: { message: ChatMessageData }) {
  return (
    <AssistantWrapper>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4"
      >
        <div className="text-xs text-white/40 uppercase tracking-wider mb-3">
          Executive Summary
        </div>
        <MarkdownRenderer className="text-sm [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-white/90 [&_h3]:mt-2 [&_h3]:mb-1 [&_li]:text-sm [&_strong]:text-white">
          {message.content}
        </MarkdownRenderer>
      </motion.div>
    </AssistantWrapper>
  )
}

// Full analysis message
function AnalysisFullMessage({ message }: { message: ChatMessageData }) {
  return (
    <AssistantWrapper>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4"
      >
        <div className="text-xs text-white/40 uppercase tracking-wider mb-3">
          Full Analysis
        </div>
        <MarkdownRenderer className="text-sm [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-white/90 [&_h3]:mt-2 [&_h3]:mb-1 [&_li]:text-sm [&_strong]:text-white">
          {message.content}
        </MarkdownRenderer>
      </motion.div>
    </AssistantWrapper>
  )
}

// Streaming cursor component
function StreamingCursor() {
  return (
    <span className="inline-block w-2 h-4 ml-0.5 bg-[#1d9bf0] animate-pulse rounded-sm" />
  )
}

// Regular assistant message (Q&A)
function AssistantTextMessage({ message }: { message: ChatMessageData }) {
  return (
    <AssistantWrapper>
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3">
        <MarkdownRenderer className="text-sm [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-white/90 [&_h3]:mt-2 [&_h3]:mb-1 [&_li]:text-sm [&_strong]:text-white [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs">
          {message.content}
        </MarkdownRenderer>
        {message.isStreaming && <StreamingCursor />}
      </div>
    </AssistantWrapper>
  )
}

// System message (small, centered)
function SystemMessage({ message }: { message: ChatMessageData }) {
  return (
    <div className="flex justify-center">
      <div className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
        <p className="text-xs text-white/50">{message.content}</p>
      </div>
    </div>
  )
}

// Main ChatMessage component
export const ChatMessage = memo(function ChatMessage({
  message,
  showTimestamp = false,
}: ChatMessageProps) {
  const renderMessage = () => {
    switch (message.type) {
      case "user-url":
        return <UserUrlMessage message={message} />
      case "user":
        return <UserTextMessage message={message} />
      case "analysis-initial":
        return <AnalysisInitialMessage message={message} />
      case "analysis-executive":
        return <AnalysisExecutiveMessage message={message} />
      case "analysis-full":
        return <AnalysisFullMessage message={message} />
      case "assistant":
        return <AssistantTextMessage message={message} />
      case "system":
        return <SystemMessage message={message} />
      default:
        return <AssistantTextMessage message={message} />
    }
  }

  return (
    <div className="relative">
      {renderMessage()}
      {showTimestamp && message.timestamp && (
        <div
          className={cn(
            "text-[10px] text-white/30 mt-1",
            message.type === "user" || message.type === "user-url"
              ? "text-right mr-9"
              : "ml-9"
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </div>
  )
})

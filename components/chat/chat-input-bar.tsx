"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Send,
  Link2,
  CheckCircle2,
  X,
  Mic,
  Square,
  Youtube,
  FileText,
  Twitter,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { validateUrl } from "@/lib/validation"
import { getYouTubeVideoId, isXUrl, getDomainFromUrl } from "@/lib/utils"
import { useSpeechToText } from "@/lib/hooks/use-speech"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

interface UrlPreview {
  url: string
  domain: string
  type: "youtube" | "article" | "x_post"
  favicon: string
}

interface ChatInputBarProps {
  onSubmitUrl: (url: string, urlMeta: UrlPreview) => void
  onSubmitMessage: (message: string) => void
  mode?: "url-only" | "chat-only" | "auto"
  placeholder?: string
  disabled?: boolean
  isProcessing?: boolean
}

export function ChatInputBar({
  onSubmitUrl,
  onSubmitMessage,
  mode = "auto",
  placeholder = "Paste a URL or ask a question...",
  disabled = false,
  isProcessing = false,
}: ChatInputBarProps) {
  const [inputValue, setInputValue] = useState("")
  const [urlPreview, setUrlPreview] = useState<UrlPreview | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Speech-to-text
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

  // Update input with transcript
  useEffect(() => {
    if (transcript) {
      setInputValue(transcript)
    }
  }, [transcript])

  // Detect and validate URL as user types
  const detectUrl = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setUrlPreview(null)
      return
    }

    const validation = validateUrl(trimmed)
    if (!validation.isValid || !validation.sanitized) {
      setUrlPreview(null)
      return
    }

    const validUrl = validation.sanitized
    const domain = getDomainFromUrl(validUrl)

    // Detect content type
    let type: "youtube" | "article" | "x_post" = "article"
    if (getYouTubeVideoId(validUrl)) {
      type = "youtube"
    } else if (isXUrl(validUrl)) {
      type = "x_post"
    }

    // Get favicon
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

    setUrlPreview({ url: validUrl, domain, type, favicon })
  }, [])

  // Debounce URL detection
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode !== "chat-only") {
        detectUrl(inputValue)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue, detectUrl, mode])

  const handleSubmit = () => {
    const trimmed = inputValue.trim()
    if (!trimmed || disabled || isProcessing) return

    // If URL detected and mode allows URL submission
    if (urlPreview && mode !== "chat-only") {
      onSubmitUrl(urlPreview.url, urlPreview)
      setInputValue("")
      setUrlPreview(null)
      return
    }

    // Regular message submission
    if (mode !== "url-only") {
      onSubmitMessage(trimmed)
      setInputValue("")
      setUrlPreview(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-analyze when a valid URL is pasted
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (mode === "chat-only") return

    const pastedText = e.clipboardData.getData("text").trim()
    if (!pastedText) return

    const validation = validateUrl(pastedText)
    if (!validation.isValid || !validation.sanitized) return

    e.preventDefault()
    setInputValue(pastedText)

    // Auto-detect and submit
    const validUrl = validation.sanitized
    const domain = getDomainFromUrl(validUrl)
    let type: "youtube" | "article" | "x_post" = "article"
    if (getYouTubeVideoId(validUrl)) type = "youtube"
    else if (isXUrl(validUrl)) type = "x_post"
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

    toast.success("URL detected - starting analysis...")
    onSubmitUrl(validUrl, { url: validUrl, domain, type, favicon })
    setInputValue("")
  }

  const clearInput = () => {
    setInputValue("")
    setUrlPreview(null)
    inputRef.current?.focus()
  }

  const getTypeIcon = (type: "youtube" | "article" | "x_post") => {
    switch (type) {
      case "youtube":
        return <Youtube className="w-4 h-4 text-red-400" />
      case "x_post":
        return <Twitter className="w-4 h-4 text-white" />
      default:
        return <FileText className="w-4 h-4 text-blue-400" />
    }
  }

  const isUrlMode = urlPreview && mode !== "chat-only"
  const canSubmit = inputValue.trim() && !disabled && !isProcessing

  return (
    <div className="w-full flex justify-center px-4 py-3">
      <div className="w-full" style={{ maxWidth: "680px" }}>
        {/* URL Preview */}
        <AnimatePresence>
          {isUrlMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <img
                  src={urlPreview.favicon}
                  alt=""
                  className="w-4 h-4"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
                <span className="text-xs text-white/80 truncate flex-1">
                  {urlPreview.domain}
                </span>
                {getTypeIcon(urlPreview.type)}
                <button
                  onClick={clearInput}
                  className="text-white/40 hover:text-white/60"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Container - pill shape like ChatGPT */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/[0.06] border transition-all",
            isFocused
              ? "border-[#1d9bf0]/50 ring-1 ring-[#1d9bf0]/20"
              : "border-white/[0.1] hover:border-white/[0.3]",
            isListening && "border-red-500/50 ring-1 ring-red-500/30"
          )}
        >
          {/* Microphone button */}
          {sttSupported && (
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={disabled || isProcessing}
              className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 relative",
                isListening
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.08]"
              )}
              aria-label={isListening ? "Stop recording" : "Start voice input"}
            >
              {isListening ? (
                <>
                  <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-30" />
                  <Square className="w-4 h-4 relative z-10 fill-white" />
                </>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Link icon */}
          <div className="flex-shrink-0">
            {isUrlMode ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Link2
                className={cn(
                  "w-4 h-4 transition-colors",
                  isFocused ? "text-[#1d9bf0]" : "text-white/30"
                )}
              />
            )}
          </div>

          {/* Input field */}
          <div className="flex-1 relative min-w-0">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                isListening
                  ? ""
                  : mode === "url-only"
                  ? "Paste a URL to analyze..."
                  : mode === "chat-only"
                  ? "Ask anything..."
                  : placeholder
              }
              disabled={disabled || isProcessing}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full bg-transparent text-white placeholder:text-gray-500 focus:outline-none text-sm"
            />

            {/* Listening indicator */}
            {isListening && !inputValue && (
              <div className="absolute inset-0 flex items-center gap-2">
                <div className="flex items-center gap-0.5 h-4">
                  <span
                    className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]"
                    style={{ height: "40%", animationDelay: "0ms" }}
                  />
                  <span
                    className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]"
                    style={{ height: "70%", animationDelay: "150ms" }}
                  />
                  <span
                    className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]"
                    style={{ height: "100%", animationDelay: "300ms" }}
                  />
                  <span
                    className="w-0.5 bg-red-500 rounded-full animate-[soundbar_0.5s_ease-in-out_infinite]"
                    style={{ height: "60%", animationDelay: "450ms" }}
                  />
                </div>
                <span className="text-xs text-red-400 font-medium">
                  Listening...
                </span>
              </div>
            )}
          </div>

          {/* Clear button */}
          {inputValue && !isProcessing && (
            <button
              onClick={clearInput}
              className="flex-shrink-0 text-white/30 hover:text-white/60"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
              canSubmit
                ? "bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white"
                : "text-white/30"
            )}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* AI Disclaimer */}
        <p className="text-center text-[10px] text-white/30 mt-2">
          Vajra uses AI and may make mistakes. Always verify important information.
        </p>
      </div>
    </div>
  )
}

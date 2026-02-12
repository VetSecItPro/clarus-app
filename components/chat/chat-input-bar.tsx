"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import NextImage from "next/image"
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
  FileUp,
  Headphones,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { validateUrl } from "@/lib/validation"
import { getYouTubeVideoId, isXUrl, isPodcastUrl, getDomainFromUrl } from "@/lib/utils"
import { useSpeechToText } from "@/lib/hooks/use-speech"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { LanguageSelector } from "@/components/ui/language-selector"
import { InstantTooltip } from "@/components/ui/tooltip"
import type { AnalysisLanguage } from "@/lib/languages"

/** Allowed file upload types: extension → MIME types */
const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ".txt": ["text/plain"],
  ".csv": ["text/csv", "application/csv"],
}

const ALLOWED_MIME_TYPES = new Set(Object.values(ALLOWED_FILE_TYPES).flat())
const ACCEPTED_EXTENSIONS = Object.keys(ALLOWED_FILE_TYPES).join(",")
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_MESSAGE_LENGTH = 10_000

/** Sanitize a file name for safe display: strip HTML-like chars and truncate */
function sanitizeFileName(name: string, maxLength = 40): string {
  const cleaned = name.replace(/[<>"'&]/g, "")
  if (cleaned.length <= maxLength) return cleaned
  const ext = cleaned.lastIndexOf(".")
  if (ext > 0) {
    const extension = cleaned.slice(ext)
    const base = cleaned.slice(0, maxLength - extension.length - 3)
    return `${base}...${extension}`
  }
  return cleaned.slice(0, maxLength - 3) + "..."
}

interface UrlPreview {
  url: string
  domain: string
  type: "youtube" | "article" | "x_post" | "podcast"
  favicon: string
}

interface ChatInputBarProps {
  onSubmitUrl: (url: string, urlMeta: UrlPreview) => void
  onSubmitMessage: (message: string) => void
  onSubmitFile?: (file: File) => void
  mode?: "url-only" | "chat-only" | "auto"
  placeholder?: string
  disabled?: boolean
  isProcessing?: boolean
  showFileUpload?: boolean
  /** Current analysis language */
  analysisLanguage?: AnalysisLanguage
  /** Callback when language changes */
  onLanguageChange?: (language: AnalysisLanguage) => void
  /** Whether user has multi-language unlocked (paid tier) */
  multiLanguageEnabled?: boolean
}

export function ChatInputBar({
  onSubmitUrl,
  onSubmitMessage,
  onSubmitFile,
  mode = "auto",
  placeholder = "Paste a URL or ask a question...",
  disabled = false,
  isProcessing = false,
  showFileUpload = true,
  analysisLanguage,
  onLanguageChange,
  multiLanguageEnabled = false,
}: ChatInputBarProps) {
  const [inputValue, setInputValue] = useState("")
  const [urlPreview, setUrlPreview] = useState<UrlPreview | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    let type: "youtube" | "article" | "x_post" | "podcast" = "article"
    if (getYouTubeVideoId(validUrl)) {
      type = "youtube"
    } else if (isXUrl(validUrl)) {
      type = "x_post"
    } else if (isPodcastUrl(validUrl)) {
      type = "podcast"
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
    // Handle file submission
    if (selectedFile && onSubmitFile) {
      handleFileSubmit()
      return
    }

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

  // Show preview chip when a valid URL is pasted (user must click send or press Enter)
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (mode === "chat-only") return

    const pastedText = e.clipboardData.getData("text").trim()
    if (!pastedText) return

    const validation = validateUrl(pastedText)
    if (!validation.isValid || !validation.sanitized) return

    e.preventDefault()

    const validUrl = validation.sanitized
    const domain = getDomainFromUrl(validUrl)
    let type: "youtube" | "article" | "x_post" | "podcast" = "article"
    if (getYouTubeVideoId(validUrl)) type = "youtube"
    else if (isXUrl(validUrl)) type = "x_post"
    else if (isPodcastUrl(validUrl)) type = "podcast"
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

    // Show URL in input with preview chip — wait for user to submit
    setInputValue(pastedText)
    setUrlPreview({ url: validUrl, domain, type, favicon })
  }

  const clearInput = () => {
    setInputValue("")
    setUrlPreview(null)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    inputRef.current?.focus()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file is not empty
    if (file.size === 0) {
      toast.error("File is empty", { description: "Please select a file with content." })
      return
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error("Unsupported file type", {
        description: "Supported: PDF, Word, Excel, PowerPoint, TXT, CSV.",
      })
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large", {
        description: `Maximum file size is 20MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
      })
      return
    }

    // Auto-submit file immediately (no user interaction needed)
    if (onSubmitFile) {
      toast.success("File detected - starting analysis...")
      onSubmitFile(file)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      return
    }

    // Fallback if no submit handler
    setSelectedFile(file)
    setInputValue("")
    setUrlPreview(null)
  }

  const handleFileSubmit = () => {
    if (!selectedFile || !onSubmitFile) return
    toast.success("File uploaded - starting analysis...")
    onSubmitFile(selectedFile)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const getTypeIcon = (type: "youtube" | "article" | "x_post" | "podcast") => {
    switch (type) {
      case "youtube":
        return <Youtube className="w-4 h-4 text-red-400" />
      case "x_post":
        return <Twitter className="w-4 h-4 text-white" />
      case "podcast":
        return <Headphones className="w-4 h-4 text-purple-400" />
      default:
        return <FileText className="w-4 h-4 text-blue-400" />
    }
  }

  const isUrlMode = urlPreview && mode !== "chat-only"
  const isFileMode = selectedFile && onSubmitFile
  const canSubmit = (inputValue.trim() || selectedFile) && !disabled && !isProcessing
  const charCount = inputValue.length
  const isNearLimit = charCount >= MAX_MESSAGE_LENGTH * 0.9
  const isAtLimit = charCount >= MAX_MESSAGE_LENGTH

  return (
    <div className="w-full flex justify-center px-4 py-3">
      <div className="w-full" style={{ maxWidth: "760px" }}>
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
                <NextImage
                  src={urlPreview.favicon}
                  alt=""
                  width={16}
                  height={16}
                  sizes="16px"
                  className="w-4 h-4"
                  unoptimized
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
                  aria-label="Clear URL preview"
                  className="text-white/40 hover:text-white/60"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Preview */}
        <AnimatePresence>
          {isFileMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <FileUp className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-white/80 truncate flex-1">
                  {sanitizeFileName(selectedFile.name)}
                </span>
                <span className="text-xs text-white/50">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)}MB
                </span>
                <button
                  onClick={clearInput}
                  aria-label="Clear file selection"
                  className="text-white/40 hover:text-white/60"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload file for analysis"
        />

        {/* Input Container - pill shape like ChatGPT */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/[0.06] border transition-all",
            isFocused
              ? "border-brand/50 ring-1 ring-brand/20"
              : "border-white/[0.1] hover:border-white/50",
            isListening && "border-red-500/50 ring-1 ring-red-500/30"
          )}
        >
          {/* Link icon */}
          <div className="flex-shrink-0">
            {isFileMode ? (
              <FileUp className="w-4 h-4 text-orange-400" />
            ) : isUrlMode ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Link2
                className={cn(
                  "w-4 h-4 transition-colors",
                  isFocused ? "text-brand" : "text-white/30"
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
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={
                isListening
                  ? ""
                  : selectedFile
                  ? `${sanitizeFileName(selectedFile.name)} ready to analyze`
                  : mode === "url-only"
                  ? "Paste a URL or upload a file..."
                  : mode === "chat-only"
                  ? "Ask anything..."
                  : placeholder
              }
              disabled={disabled || isProcessing}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Enter a URL, upload a file, or type a message"
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
              aria-label="Clear input"
              className="flex-shrink-0 text-white/30 hover:text-white/60"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* File upload button - before send */}
          {showFileUpload && onSubmitFile && mode !== "chat-only" && (
            <InstantTooltip content="Upload file">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isProcessing}
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0",
                  selectedFile
                    ? "bg-orange-500/20 text-orange-400"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
                )}
                aria-label="Upload file"
              >
                <FileUp className="w-4 h-4" />
              </button>
            </InstantTooltip>
          )}

          {/* Language selector — before mic, only in url-only mode */}
          {analysisLanguage && onLanguageChange && mode !== "chat-only" && (
            <LanguageSelector
              value={analysisLanguage}
              onValueChange={onLanguageChange}
              multiLanguageEnabled={multiLanguageEnabled}
              disabled={disabled || isProcessing}
              compact
            />
          )}

          {/* Microphone button - before send */}
          {sttSupported && (
            <InstantTooltip content={isListening ? "Stop recording" : "Voice input"}>
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={disabled || isProcessing}
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0 relative",
                  isListening
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
                )}
                aria-label={isListening ? "Stop recording" : "Start voice input"}
              >
                {isListening ? (
                  <>
                    <span className="absolute inset-0 rounded-lg bg-red-500 animate-ping opacity-30" />
                    <Square className="w-3.5 h-3.5 relative z-10 fill-white" />
                  </>
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            </InstantTooltip>
          )}

          {/* Send button */}
          <InstantTooltip content={isUrlMode ? "Analyze" : "Send"}>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-label={isUrlMode ? "Analyze content" : "Send message"}
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                canSubmit
                  ? "bg-brand hover:bg-brand-hover text-white"
                  : "text-white/30"
              )}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </InstantTooltip>
        </div>

        {/* Helper text and character count */}
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-[0.625rem] text-white/30">
            Supports PDF, Word, Excel, PowerPoint, TXT, and CSV. Max 20MB. AI may make mistakes.
          </p>
          {isNearLimit && (
            <span
              className={cn(
                "text-[0.625rem] tabular-nums flex-shrink-0 ml-2",
                isAtLimit ? "text-red-400" : "text-yellow-400/70"
              )}
            >
              {charCount.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

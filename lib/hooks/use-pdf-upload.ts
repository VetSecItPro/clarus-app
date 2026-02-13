"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import type { ChatMessageData } from "@/components/chat"
import type { AnalysisLanguage } from "@/lib/languages"

interface UsePdfUploadOptions {
  userId: string | null
  analysisLanguage: AnalysisLanguage
  addMessage: (message: ChatMessageData) => void
  onContentCreated?: (contentId: string) => void
  startPolling: (id: string) => void
  setContentId: (id: string) => void
  setState: (state: "idle" | "processing") => void
}

/**
 * Handles PDF file upload for content analysis.
 *
 * Creates a user message showing the PDF name, uploads via FormData
 * to `/api/process-pdf`, and starts status polling on success.
 */
export function usePdfUpload({
  userId,
  analysisLanguage,
  addMessage,
  onContentCreated,
  startPolling,
  setContentId,
  setState,
}: UsePdfUploadOptions) {
  const submitPdf = useCallback(
    async (file: File) => {
      if (!userId) {
        toast.error("Please sign in to continue")
        return
      }

      setState("processing")

      addMessage({
        id: `user-pdf-${Date.now()}`,
        type: "user-url",
        content: `\u{1F4C4} ${file.name}`,
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
        startPolling(data.contentId)
      } catch (error) {
        console.error("PDF upload error:", error)
        toast.error("Failed to upload PDF")
        setState("idle")
      }
    },
    [userId, addMessage, onContentCreated, startPolling, analysisLanguage, setContentId, setState]
  )

  return { submitPdf }
}

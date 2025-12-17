"use client"

import { useState } from "react"
import { Loader2, Link2, Upload, MessageSquare, CheckCircle2 } from "lucide-react"
import withAuth from "@/components/with-auth"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import BottomNavigation from "@/components/bottom-navigation"
import GlasmorphicSettingsButton from "@/components/glassmorphic-settings-button"
import { AddUrlModal } from "@/components/add-url-modal"
import { supabase } from "@/lib/supabase"
import { getYouTubeVideoId, isXUrl, cn } from "@/lib/utils"
import { BlueCheckLogo } from "@/components/blue-check-logo"
import { useRouter } from "next/navigation"

interface HomePageProps {
  session: Session | null
}

type OptionType = "clipboard" | "upload" | "chat"

type ProcessingStatus = "idle" | "reading" | "creating" | "fetching" | "summarizing" | "complete" | "error"

const processingSteps = [
  { status: "reading" as ProcessingStatus, label: "Reading clipboard" },
  { status: "creating" as ProcessingStatus, label: "Creating entry" },
  { status: "fetching" as ProcessingStatus, label: "Fetching content" },
  { status: "summarizing" as ProcessingStatus, label: "Generating summary" },
  { status: "complete" as ProcessingStatus, label: "Complete" },
]

function HomePageContent({ session }: HomePageProps) {
  const [isAddUrlModalOpen, setIsAddUrlModalOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<OptionType>("clipboard")
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("idle")
  const [processingContentId, setProcessingContentId] = useState<string | null>(null)
  const router = useRouter()

  const handleQuickAddFromClipboard = async () => {
    setProcessingStatus("reading")

    if (!navigator.clipboard || !navigator.clipboard.readText) {
      toast.error("Clipboard not available")
      setProcessingStatus("idle")
      setIsAddUrlModalOpen(true)
      return
    }

    try {
      const clipboardText = await navigator.clipboard.readText()
      if (!clipboardText.trim()) {
        toast.error("Clipboard is empty")
        setProcessingStatus("idle")
        return
      }

      let potentialUrl: URL
      try {
        potentialUrl = new URL(clipboardText)
      } catch (_) {
        toast.error("Not a valid URL")
        setProcessingStatus("idle")
        return
      }

      const url = potentialUrl.href
      let type: "youtube" | "article" | "x_post" = "article"
      if (getYouTubeVideoId(url)) {
        type = "youtube"
      } else if (isXUrl(url)) {
        type = "x_post"
      }

      setProcessingStatus("creating")

      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser()
      if (sessionError || !user) {
        toast.error("Not authenticated")
        setProcessingStatus("idle")
        return
      }

      const placeholderTitle = `Processing: ${url.substring(0, 50)}${url.length > 50 ? "..." : ""}`
      const { data: newContent, error: insertError } = await supabase
        .from("content")
        .insert([{ url, type, user_id: user.id, title: placeholderTitle, full_text: null }])
        .select("id")
        .single()

      if (insertError || !newContent) {
        toast.error("Failed to add URL")
        setProcessingStatus("idle")
        return
      }

      setProcessingContentId(newContent.id)
      setProcessingStatus("fetching")
      window.dispatchEvent(new CustomEvent("contentAdded"))

      const apiResponse = await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: newContent.id }),
      })

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({ error: "Unknown error" }))
        toast.error(errorData.error || "Processing failed")
        setProcessingStatus("error")
        // Still redirect to item page even on error
        setTimeout(() => {
          router.push(`/item/${newContent.id}`)
        }, 1500)
        return
      }

      setProcessingStatus("summarizing")

      // Brief delay to show the summarizing step
      await new Promise((resolve) => setTimeout(resolve, 500))

      setProcessingStatus("complete")
      window.dispatchEvent(new CustomEvent("contentAdded"))

      // Redirect to item page after showing complete status
      setTimeout(() => {
        router.push(`/item/${newContent.id}`)
      }, 800)
    } catch (error: any) {
      if (error instanceof DOMException) {
        toast.error("Clipboard access blocked")
        setIsAddUrlModalOpen(true)
      } else {
        toast.error("Failed to add from clipboard")
      }
      setProcessingStatus("idle")
    }
  }

  const handleOptionClick = (option: OptionType) => {
    setSelectedOption(option)

    if (option === "clipboard") {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setIsAddUrlModalOpen(true)
        return
      }
      handleQuickAddFromClipboard()
    } else {
      toast.info("Coming soon!")
    }
  }

  const options = [
    {
      id: "clipboard" as OptionType,
      icon: Link2,
      label: "Paste URL",
      subtitle: "YouTube, Articles, X Posts, Links",
      available: true,
    },
    {
      id: "upload" as OptionType,
      icon: Upload,
      label: "Upload File",
      subtitle: "PDF, Documents, Images",
      available: false,
    },
    {
      id: "chat" as OptionType,
      icon: MessageSquare,
      label: "Start Chat",
      subtitle: "Ask questions, get insights",
      available: false,
    },
  ]

  const isProcessing = processingStatus !== "idle" && processingStatus !== "error"

  if (isProcessing) {
    const currentStepIndex = processingSteps.findIndex((s) => s.status === processingStatus)

    return (
      <div className="h-screen bg-black overflow-hidden flex flex-col">
        <div className="flex justify-end p-4 shrink-0">
          <GlasmorphicSettingsButton />
        </div>

        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
          <div className="flex flex-col items-center mb-8">
            <BlueCheckLogo size={56} />
            <h1 className="text-xl font-bold text-white mt-4">Processing</h1>
            <p className="text-neutral-500 text-xs mt-1">Please wait...</p>
          </div>

          {/* Progress steps */}
          <div className="w-full max-w-xs space-y-3">
            {processingSteps.map((step, index) => {
              const isComplete = index < currentStepIndex
              const isCurrent = index === currentStepIndex
              const isPending = index > currentStepIndex

              return (
                <div
                  key={step.status}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-xl border transition-all duration-300",
                    isCurrent
                      ? "bg-[#1d9bf0]/10 border-[#1d9bf0]/30"
                      : isComplete
                        ? "bg-white/[0.04] border-white/[0.08]"
                        : "bg-white/[0.02] border-white/[0.05] opacity-50",
                  )}
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 text-[#1d9bf0] animate-spin" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white/20" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isCurrent ? "text-white" : isComplete ? "text-white/60" : "text-white/30",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-xs mt-6">
            <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1d9bf0] transition-all duration-500 ease-out"
                style={{ width: `${((currentStepIndex + 1) / processingSteps.length) * 100}%` }}
              />
            </div>
          </div>
        </main>

        <BottomNavigation />
      </div>
    )
  }

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col">
      <div className="flex justify-end p-4 shrink-0">
        <GlasmorphicSettingsButton />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        <div className="flex flex-col items-center mb-8">
          <BlueCheckLogo size={56} />
          <h1 className="text-xl font-bold text-white mt-4">Truth Checker</h1>
          <p className="text-neutral-500 text-xs mt-1">by Vajra Labs</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          {options.map((option) => {
            const isSelected = selectedOption === option.id
            const Icon = option.icon

            return (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                className={cn(
                  "relative flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all duration-200",
                  "shadow-lg hover:shadow-xl active:scale-[0.97] active:shadow-md",
                  isSelected && option.available
                    ? "bg-gradient-to-r from-[#1d9bf0]/20 to-[#1d9bf0]/10 border-[#1d9bf0]/50 shadow-[0_4px_20px_rgba(29,155,240,0.25)]"
                    : option.available
                      ? "bg-white/[0.06] border-white/20 hover:bg-white/[0.1] hover:border-white/30"
                      : "bg-white/[0.03] border-white/10 cursor-not-allowed",
                  !option.available && "opacity-50",
                )}
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-inner",
                    isSelected && option.available
                      ? "bg-[#1d9bf0]/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
                      : option.available
                        ? "bg-white/[0.1] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]"
                        : "bg-white/[0.05]",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-6 h-6",
                      isSelected && option.available
                        ? "text-[#1d9bf0]"
                        : option.available
                          ? "text-white/80"
                          : "text-white/40",
                    )}
                  />
                </div>

                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-base font-semibold",
                      isSelected && option.available
                        ? "text-white"
                        : option.available
                          ? "text-white/90"
                          : "text-white/50",
                    )}
                  >
                    {option.label}
                  </span>
                  <span
                    className={cn(
                      "text-xs mt-0.5",
                      isSelected && option.available
                        ? "text-white/70"
                        : option.available
                          ? "text-white/50"
                          : "text-white/30",
                    )}
                  >
                    {option.subtitle}
                  </span>
                </div>

                {!option.available && (
                  <span className="text-[10px] uppercase tracking-wider text-white/60 font-semibold bg-white/[0.1] px-2.5 py-1.5 rounded-lg border border-white/10">
                    Soon
                  </span>
                )}

                {option.available && (
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      isSelected ? "bg-[#1d9bf0]/20" : "bg-white/[0.06]",
                    )}
                  >
                    <svg
                      className={cn("w-4 h-4", isSelected ? "text-[#1d9bf0]" : "text-white/50")}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </main>

      <BottomNavigation />
      <AddUrlModal isOpen={isAddUrlModalOpen} onOpenChange={setIsAddUrlModalOpen} />
    </div>
  )
}

export default withAuth(HomePageContent)

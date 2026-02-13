"use client"

import { useState, useCallback } from "react"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type SectionType = "overview" | "triage" | "takeaways" | "accuracy" | "action_items" | "detailed"

interface SectionFeedbackProps {
  contentId: string
  sectionType: SectionType
  initialValue?: boolean | null // true = helpful, false = not helpful, null = no feedback
}

export function SectionFeedback({ contentId, sectionType, initialValue = null }: SectionFeedbackProps) {
  const [value, setValue] = useState<boolean | null>(initialValue)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFeedback = useCallback(async (isHelpful: boolean) => {
    // Toggle off if same value clicked again
    const newValue = value === isHelpful ? null : isHelpful
    const previousValue = value
    setValue(newValue) // Optimistic update

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_id: contentId,
          section_type: sectionType,
          is_helpful: newValue,
        }),
      })

      if (!res.ok) {
        setValue(previousValue) // Revert on failure
        toast.error("Failed to save feedback")
        return
      }

      if (newValue !== null) {
        toast.success("Thanks for your feedback", { duration: 2000 })
      }
    } catch {
      setValue(previousValue)
      toast.error("Failed to save feedback")
    } finally {
      setIsSubmitting(false)
    }
  }, [contentId, sectionType, value])

  return (
    <div className="flex items-center gap-1.5 ml-auto">
      <button
        onClick={() => handleFeedback(true)}
        disabled={isSubmitting}
        aria-label="This section was helpful"
        className={cn(
          "p-2.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1 focus-visible:ring-offset-black active:scale-95",
          value === true
            ? "bg-emerald-500/20 text-emerald-400"
            : "text-white/50 hover:text-emerald-400 hover:bg-emerald-500/10"
        )}
      >
        <ThumbsUp className={cn("w-3.5 h-3.5", value === true && "fill-current")} />
      </button>
      <button
        onClick={() => handleFeedback(false)}
        disabled={isSubmitting}
        aria-label="This section was not helpful"
        className={cn(
          "p-2.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1 focus-visible:ring-offset-black active:scale-95",
          value === false
            ? "bg-red-500/20 text-red-400"
            : "text-white/50 hover:text-red-400 hover:bg-red-500/10"
        )}
      >
        <ThumbsDown className={cn("w-3.5 h-3.5", value === false && "fill-current")} />
      </button>
    </div>
  )
}

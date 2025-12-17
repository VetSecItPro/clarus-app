"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { AddUrlModal } from "@/components/add-url-modal"
import { toast } from "sonner"
import BlueCheckLogo from "@/components/blue-check-logo"

interface ShazamAddButtonProps {
  onQuickAddFromClipboard: () => Promise<void>
  isQuickAdding: boolean
}

export default function ShazamAddButton({ onQuickAddFromClipboard, isQuickAdding }: ShazamAddButtonProps) {
  const [isAddUrlModalOpen, setIsAddUrlModalOpen] = useState(false)

  const handleOpenAddUrlModal = () => setIsAddUrlModalOpen(true)

  const handleQuickAdd = async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      toast.error("Clipboard API not available. Opening manual add dialog.")
      handleOpenAddUrlModal()
      return
    }
    try {
      await onQuickAddFromClipboard()
    } catch (error) {
      handleOpenAddUrlModal()
    }
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-8">
        <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <BlueCheckLogo size="sm" />
          Tap to Add Content
        </h2>

        <button
          onClick={handleQuickAdd}
          disabled={isQuickAdding}
          className="relative h-64 w-64 rounded-full bg-white/5 border-4 border-white/10 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          aria-label="Add content from clipboard"
        >
          {isQuickAdding ? (
            <Loader2 className="h-32 w-32 animate-spin text-muted-foreground" />
          ) : (
            <BlueCheckLogo size="xl" className="w-32 h-32" />
          )}
        </button>

        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Tap the button to add content from your clipboard, or{" "}
          <button onClick={handleOpenAddUrlModal} className="text-blue-400 underline hover:text-blue-300">
            enter manually
          </button>
        </p>
      </div>

      <AddUrlModal isOpen={isAddUrlModalOpen} onOpenChange={setIsAddUrlModalOpen} />
    </>
  )
}

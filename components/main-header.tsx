"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import UserProfileButton from "@/components/user-profile-button"
import { AddUrlModal } from "@/components/add-url-modal"
import { EditAIPromptsModal } from "@/components/edit-ai-prompts-modal"
import { PlusCircle, Cog, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface MainHeaderProps {
  title: string
  onRefresh?: () => void
  isRefreshing?: boolean
  onQuickAddFromClipboard: () => Promise<void>
  isQuickAdding: boolean
}

export default function MainHeader({ title, onQuickAddFromClipboard, isQuickAdding, isRefreshing }: MainHeaderProps) {
  const [isAddUrlModalOpen, setIsAddUrlModalOpen] = useState(false)
  const [isEditPromptModalOpen, setIsEditPromptModalOpen] = useState(false)

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
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-[#121212] bg-opacity-80 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-50">{title}</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleQuickAdd}
                disabled={isQuickAdding || isRefreshing}
                aria-label="Add new URL from clipboard or manually"
                className="h-9 w-9 rounded-full hover:bg-gray-800"
              >
                {isQuickAdding ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : (
                  <PlusCircle className="h-5 w-5 text-gray-400" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditPromptModalOpen(true)}
                aria-label="Edit AI Prompts"
                className="h-9 w-9 rounded-full hover:bg-gray-800"
              >
                <Cog className="h-5 w-5 text-gray-400" />
              </Button>
              <UserProfileButton />
            </div>
          </div>
        </div>
      </header>
      <AddUrlModal isOpen={isAddUrlModalOpen} onOpenChange={setIsAddUrlModalOpen} />
      <EditAIPromptsModal isOpen={isEditPromptModalOpen} onOpenChange={setIsEditPromptModalOpen} />
    </>
  )
}

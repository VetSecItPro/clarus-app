"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Loader2, FolderPlus, Pencil } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { COLLECTION_COLORS } from "@/lib/schemas"
import type { Collection } from "@/lib/hooks/use-collections"

interface CreateCollectionDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (data: {
    name: string
    description?: string | null
    color?: string | null
    icon?: string | null
  }) => Promise<Collection>
  /** If provided, the dialog is in edit mode */
  editingCollection?: Collection | null
  onUpdate?: (
    id: string,
    data: {
      name?: string
      description?: string | null
      color?: string | null
      icon?: string | null
    }
  ) => Promise<Collection>
}

const PRESET_ICONS = [
  "folder", "book", "star", "heart", "zap",
  "lightbulb", "target", "flag",
]

export function CreateCollectionDialog({
  open,
  onClose,
  onCreate,
  editingCollection,
  onUpdate,
}: CreateCollectionDialogProps) {
  const isEditing = !!editingCollection
  const [name, setName] = useState(editingCollection?.name ?? "")
  const [description, setDescription] = useState(editingCollection?.description ?? "")
  const [selectedColor, setSelectedColor] = useState<string | null>(
    editingCollection?.color ?? COLLECTION_COLORS[0]
  )
  const [selectedIcon, setSelectedIcon] = useState<string | null>(
    editingCollection?.icon ?? "folder"
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = useCallback(() => {
    setName("")
    setDescription("")
    setSelectedColor(COLLECTION_COLORS[0])
    setSelectedIcon("folder")
  }, [])

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      resetForm()
      onClose()
    }
  }, [isSubmitting, resetForm, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Collection name is required")
      return
    }

    if (trimmedName.length > 100) {
      toast.error("Collection name is too long (max 100 characters)")
      return
    }

    setIsSubmitting(true)

    try {
      if (isEditing && editingCollection && onUpdate) {
        await onUpdate(editingCollection.id, {
          name: trimmedName,
          description: description.trim() || null,
          color: selectedColor,
          icon: selectedIcon,
        })
        toast.success("Collection updated")
      } else {
        await onCreate({
          name: trimmedName,
          description: description.trim() || null,
          color: selectedColor,
          icon: selectedIcon,
        })
        toast.success("Collection created")
      }

      resetForm()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="bg-black border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
                    {isEditing ? (
                      <Pencil className="w-5 h-5 text-brand" />
                    ) : (
                      <FolderPlus className="w-5 h-5 text-brand" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {isEditing ? "Edit Collection" : "New Collection"}
                    </h2>
                    <p className="text-xs text-white/40">
                      {isEditing
                        ? "Update your collection details"
                        : "Organize your content into folders"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  aria-label="Close dialog"
                  className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white/50 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
                {/* Name */}
                <div>
                  <label
                    htmlFor="collection-name"
                    className="block text-xs font-medium text-white/50 uppercase tracking-wide mb-2"
                  >
                    Name
                  </label>
                  <input
                    id="collection-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., AI Research, Election Coverage"
                    maxLength={100}
                    autoFocus
                    className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand/50 transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="collection-description"
                    className="block text-xs font-medium text-white/50 uppercase tracking-wide mb-2"
                  >
                    Description{" "}
                    <span className="text-white/30 normal-case">(optional)</span>
                  </label>
                  <textarea
                    id="collection-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this collection about?"
                    maxLength={500}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand/50 transition-colors resize-none"
                  />
                </div>

                {/* Color */}
                <div>
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">
                    Color
                  </p>
                  <div className="flex gap-2">
                    {COLLECTION_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        aria-label={`Select color ${color}`}
                        className={cn(
                          "w-8 h-8 rounded-full transition-all border-2",
                          selectedColor === color
                            ? "border-white scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon */}
                <div>
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">
                    Icon
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setSelectedIcon(icon)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs capitalize transition-all border",
                          selectedIcon === icon
                            ? "bg-white/[0.1] border-white/[0.2] text-white"
                            : "bg-white/[0.04] border-white/[0.06] text-white/50 hover:bg-white/[0.08] hover:text-white/70"
                        )}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/[0.1] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover disabled:bg-brand/50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isEditing ? "Updating..." : "Creating..."}
                      </>
                    ) : isEditing ? (
                      "Update"
                    ) : (
                      "Create"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FolderPlus,
  Check,
  Plus,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  useCollections,
  useContentCollections,
  type Collection,
} from "@/lib/hooks/use-collections"

interface AddToCollectionButtonProps {
  /** The content item ID to add */
  contentId: string
  /** Compact mode for list view (smaller button) */
  compact?: boolean
  /** CSS class override */
  className?: string
}

export function AddToCollectionButton({
  contentId,
  compact = false,
  className,
}: AddToCollectionButtonProps) {
  const {
    collections,
    isLoading,
    addItemToCollection,
    removeItemFromCollection,
    createCollection,
  } = useCollections()

  const { collectionIds: currentCollectionIds, refresh: refreshContentCollections } =
    useContentCollections(contentId)

  const [isOpen, setIsOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [quickCreateName, setQuickCreateName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setShowQuickCreate(false)
        setQuickCreateName("")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handleToggle = useCallback(
    async (collection: Collection) => {
      const isInCollection = currentCollectionIds.includes(collection.id)
      setTogglingId(collection.id)

      try {
        if (isInCollection) {
          await removeItemFromCollection(collection.id, contentId)
          toast.success(`Removed from "${collection.name}"`)
        } else {
          await addItemToCollection(collection.id, contentId)
          toast.success(`Added to "${collection.name}"`)
        }
        await refreshContentCollections()
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update"
        toast.error(message)
      } finally {
        setTogglingId(null)
      }
    },
    [
      contentId,
      currentCollectionIds,
      addItemToCollection,
      removeItemFromCollection,
      refreshContentCollections,
    ]
  )

  const handleQuickCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = quickCreateName.trim()
      if (!trimmed) return

      setIsCreating(true)
      try {
        const newCollection = await createCollection({ name: trimmed })
        // Auto-add the content to the new collection
        await addItemToCollection(newCollection.id, contentId)
        toast.success(`Created "${trimmed}" and added item`)
        setQuickCreateName("")
        setShowQuickCreate(false)
        await refreshContentCollections()
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create"
        toast.error(message)
      } finally {
        setIsCreating(false)
      }
    },
    [quickCreateName, createCollection, addItemToCollection, contentId, refreshContentCollections]
  )

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setIsOpen(!isOpen)
        }}
        aria-label="Add to collection"
        className={cn(
          "transition-all",
          compact
            ? "w-7 h-7 rounded-lg bg-black/80 hover:bg-black flex items-center justify-center text-white/60 hover:text-white focus-visible:ring-2 focus-visible:ring-brand/50 active:scale-95"
            : "w-10 h-10 flex items-center justify-center bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.15] text-white/50 hover:text-white rounded-full",
          className
        )}
      >
        <FolderPlus className={cn(compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 bg-black/95 border border-white/[0.1] rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <p className="text-xs font-medium text-white/50">
                Add to Collection
              </p>
            </div>

            {/* Collections list */}
            <div className="max-h-48 overflow-y-auto py-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                </div>
              ) : collections.length === 0 && !showQuickCreate ? (
                <div className="px-3 py-3 text-center">
                  <p className="text-xs text-white/50 mb-2">
                    No collections yet
                  </p>
                </div>
              ) : (
                collections.map((collection) => {
                  const isInCollection = currentCollectionIds.includes(
                    collection.id
                  )
                  const isToggling = togglingId === collection.id

                  return (
                    <button
                      key={collection.id}
                      onClick={() => handleToggle(collection)}
                      disabled={isToggling}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all",
                        isInCollection
                          ? "text-white bg-white/[0.04]"
                          : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                      )}
                    >
                      {/* Color dot */}
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: collection.color || "var(--brand)",
                        }}
                      />
                      <span className="flex-1 text-left truncate text-xs">
                        {collection.name}
                      </span>
                      {isToggling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : isInCollection ? (
                        <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>

            {/* Quick create */}
            <div className="border-t border-white/[0.06]">
              {showQuickCreate ? (
                <form onSubmit={handleQuickCreate} className="p-2">
                  <input
                    type="text"
                    value={quickCreateName}
                    onChange={(e) => setQuickCreateName(e.target.value)}
                    placeholder="Collection name..."
                    maxLength={100}
                    autoFocus
                    aria-label="New collection name"
                    className="w-full px-3 py-1.5 bg-white/[0.06] border border-white/[0.08] rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 mb-2"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickCreate(false)
                        setQuickCreateName("")
                      }}
                      className="flex-1 px-2 py-1.5 text-xs text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!quickCreateName.trim() || isCreating}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-white bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg transition-all"
                    >
                      {isCreating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Create"
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowQuickCreate(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-white/50 hover:text-white hover:bg-white/[0.04] transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Collection
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

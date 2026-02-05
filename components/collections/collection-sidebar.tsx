"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FolderPlus,
  FolderOpen,
  ChevronRight,
  Pencil,
  Trash2,
  Library,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useCollections, type Collection } from "@/lib/hooks/use-collections"
import { CreateCollectionDialog } from "./create-collection-dialog"

interface CollectionSidebarProps {
  /** Currently selected collection ID (null = show all) */
  selectedCollectionId: string | null
  /** Called when user selects a collection or "All" */
  onSelectCollection: (collectionId: string | null) => void
}

/** Maps icon names to simple colored circles with the first letter */
function CollectionIcon({
  icon,
  color,
  size = "md",
}: {
  icon: string | null
  color: string | null
  size?: "sm" | "md"
}) {
  const bgColor = color || "#1d9bf0"
  const sizeClass = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"

  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center font-semibold text-white shrink-0",
        sizeClass
      )}
      style={{ backgroundColor: `${bgColor}30` }}
    >
      <span style={{ color: bgColor }}>
        {(icon || "folder").charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

export function CollectionSidebar({
  selectedCollectionId,
  onSelectCollection,
}: CollectionSidebarProps) {
  const {
    collections,
    isLoading,
    createCollection,
    updateCollection,
    deleteCollection,
  } = useCollections()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = useCallback(
    async (collection: Collection) => {
      if (
        !window.confirm(
          `Delete "${collection.name}"? Items will remain in your library.`
        )
      ) {
        return
      }

      setDeletingId(collection.id)
      try {
        await deleteCollection(collection.id)
        toast.success(`"${collection.name}" deleted`)
        if (selectedCollectionId === collection.id) {
          onSelectCollection(null)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete"
        toast.error(message)
      } finally {
        setDeletingId(null)
      }
    },
    [deleteCollection, selectedCollectionId, onSelectCollection]
  )

  const handleEdit = useCallback((collection: Collection) => {
    setEditingCollection(collection)
    setShowCreateDialog(true)
  }, [])

  const handleDialogClose = useCallback(() => {
    setShowCreateDialog(false)
    setEditingCollection(null)
  }, [])

  const totalItems = collections.reduce((sum, c) => sum + c.item_count, 0)

  return (
    <>
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Collections
          </h3>
          <button
            onClick={() => setShowCreateDialog(true)}
            aria-label="Create new collection"
            className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white transition-all"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* All items button */}
        <button
          onClick={() => onSelectCollection(null)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all mb-1",
            selectedCollectionId === null
              ? "bg-white/[0.08] border border-white/[0.1] text-white"
              : "text-white/60 hover:bg-white/[0.04] hover:text-white"
          )}
        >
          <Library className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left truncate">All Items</span>
          {totalItems > 0 && (
            <span className="text-[10px] text-white/40 tabular-nums">
              {totalItems}
            </span>
          )}
        </button>

        {/* Collections list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
          </div>
        ) : collections.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs text-white/30 mb-2">No collections yet</p>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="text-xs text-[#1d9bf0] hover:text-[#1a8cd8] transition-colors"
            >
              Create your first collection
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            <AnimatePresence>
              {collections.map((collection) => (
                <motion.div
                  key={collection.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="group relative"
                >
                  <button
                    onClick={() => onSelectCollection(collection.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all",
                      selectedCollectionId === collection.id
                        ? "bg-white/[0.08] border border-white/[0.1] text-white"
                        : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                    )}
                  >
                    <CollectionIcon
                      icon={collection.icon}
                      color={collection.color}
                      size="sm"
                    />
                    <span className="flex-1 text-left truncate">
                      {collection.name}
                    </span>
                    <span className="text-[10px] text-white/40 tabular-nums group-hover:hidden">
                      {collection.item_count}
                    </span>

                    {/* Hover actions */}
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(collection)
                        }}
                        aria-label={`Edit ${collection.name}`}
                        className="w-6 h-6 rounded-md hover:bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white transition-all"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(collection)
                        }}
                        disabled={deletingId === collection.id}
                        aria-label={`Delete ${collection.name}`}
                        className="w-6 h-6 rounded-md hover:bg-red-500/20 flex items-center justify-center text-white/40 hover:text-red-400 transition-all"
                      >
                        {deletingId === collection.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </button>

                  {/* Active indicator */}
                  {selectedCollectionId === collection.id && (
                    <motion.div
                      layoutId="activeCollection"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                      style={{ backgroundColor: collection.color || "#1d9bf0" }}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Selected collection detail */}
        {selectedCollectionId && (
          <SelectedCollectionDetail
            collection={collections.find((c) => c.id === selectedCollectionId)}
          />
        )}
      </div>

      {/* Create/Edit Dialog */}
      <CreateCollectionDialog
        open={showCreateDialog}
        onClose={handleDialogClose}
        onCreate={createCollection}
        editingCollection={editingCollection}
        onUpdate={updateCollection}
      />
    </>
  )
}

function SelectedCollectionDetail({
  collection,
}: {
  collection: Collection | undefined
}) {
  if (!collection) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl"
    >
      <div className="flex items-center gap-2 mb-2">
        <FolderOpen className="w-3.5 h-3.5 text-white/40" />
        <span className="text-xs font-medium text-white truncate">
          {collection.name}
        </span>
      </div>
      {collection.description && (
        <p className="text-[11px] text-white/40 line-clamp-2 mb-2">
          {collection.description}
        </p>
      )}
      <div className="flex items-center gap-1 text-[10px] text-white/30">
        <span>{collection.item_count} items</span>
        <ChevronRight className="w-3 h-3" />
      </div>
    </motion.div>
  )
}

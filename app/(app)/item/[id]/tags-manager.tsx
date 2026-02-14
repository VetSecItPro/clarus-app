"use client"

import { Loader2, Tag, Plus, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TagsManagerProps {
  tags: string[]
  showTagInput: boolean
  setShowTagInput: (show: boolean) => void
  newTagInput: string
  setNewTagInput: (value: string) => void
  handleAddTag: (tag: string) => void
  handleRemoveTag: (tag: string) => void
  isAddingTag: boolean
  tagSuggestions: { tag: string; count: number }[]
  /** Desktop mode includes Tooltip wrappers for richer hover states */
  variant?: "desktop" | "mobile"
}

export function TagsManager({
  tags,
  showTagInput,
  setShowTagInput,
  newTagInput,
  setNewTagInput,
  handleAddTag,
  handleRemoveTag,
  isAddingTag,
  tagSuggestions,
  variant = "desktop",
}: TagsManagerProps) {
  const isDesktop = variant === "desktop"

  return (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="w-4 h-4 text-purple-400 shrink-0" />
          <h3 className="text-sm font-semibold text-white truncate">Tags</h3>
        </div>
        {!showTagInput && (
          isDesktop ? (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowTagInput(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </TooltipTrigger>
                <TooltipContent>Add a tag to organize this content</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-all"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          )
        )}
      </div>

      {/* Tag input */}
      {showTagInput && (
        <div className="relative mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTagInput.trim()) handleAddTag(newTagInput)
                else if (e.key === "Escape") { setShowTagInput(false); setNewTagInput("") }
              }}
              placeholder="Type a tag..."
              className="flex-1 px-3 py-2 bg-white/[0.06] border border-white/[0.12] rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
              autoFocus
            />
            <button
              onClick={() => handleAddTag(newTagInput)}
              disabled={!newTagInput.trim() || isAddingTag}
              className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm transition-all disabled:opacity-50"
            >
              {isAddingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
            </button>
            <button
              onClick={() => { setShowTagInput(false); setNewTagInput("") }}
              className="p-2 text-white/50 hover:text-white/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {newTagInput && tagSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-12 mt-1 bg-black/95 border border-white/[0.1] rounded-lg shadow-xl z-10 overflow-hidden">
              {tagSuggestions.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => handleAddTag(tag)}
                  disabled={isAddingTag}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white/[0.06] transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="text-white/80 capitalize">{tag}</span>
                  <span className="text-xs text-white/50">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tags list */}
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {isDesktop ? (
            <TooltipProvider delayDuration={300}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="group flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300"
                >
                  <span className="capitalize">{tag}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                        className="opacity-50 hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Remove tag</TooltipContent>
                  </Tooltip>
                </span>
              ))}
            </TooltipProvider>
          ) : (
            tags.map((tag) => (
              <span
                key={tag}
                className="group flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300"
              >
                <span className="capitalize">{tag}</span>
                <button
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                  className="opacity-50 hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
      ) : (
        <p className="text-xs text-white/50">No tags yet. Add tags to organize your content.</p>
      )}
    </div>
  )
}

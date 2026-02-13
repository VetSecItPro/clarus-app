"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Youtube,
  FileText,
  Twitter,
  Headphones,
  Check,
  Loader2,
  Search,
  GitCompareArrows,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

interface ContentItem {
  id: string
  title: string | null
  url: string
  type: string | null
  thumbnail_url: string | null
  date_added: string | null
}

interface CompareSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  onCompare: (contentIds: string[]) => void
  isComparing: boolean
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  youtube: Youtube,
  article: FileText,
  x_post: Twitter,
  podcast: Headphones,
}

export function CompareSelector({
  open,
  onOpenChange,
  userId,
  onCompare,
  isComparing,
}: CompareSelectorProps) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")

  const fetchItems = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      // Fetch analyzed content (those with summaries)
      const { data, error } = await supabase
        .from("content")
        .select("id, title, url, type, thumbnail_url, date_added, summaries!inner(id)")
        .eq("user_id", userId)
        .order("date_added", { ascending: false })
        .limit(100)

      if (error) throw error

      setItems(
        (data ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          url: item.url,
          type: item.type,
          thumbnail_url: item.thumbnail_url,
          date_added: item.date_added,
        }))
      )
    } catch (err) {
      console.error("Failed to fetch content for comparison:", err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (open) {
      fetchItems()
      setSelectedIds(new Set())
      setSearchQuery("")
    }
  }, [open, fetchItems])

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 3) {
        next.add(id)
      }
      return next
    })
  }

  // PERF: memoize filtered items to avoid re-filtering on every render (selection changes, etc.)
  const filteredItems = useMemo(() => items.filter((item) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      item.title?.toLowerCase().includes(query) ||
      item.url.toLowerCase().includes(query)
    )
  }), [items, searchQuery])

  const handleCompare = () => {
    if (selectedIds.size >= 2) {
      onCompare(Array.from(selectedIds))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-black/95 border-white/[0.1] text-white max-w-xl max-h-[85vh] flex flex-col"
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <GitCompareArrows className="w-5 h-5 text-brand" />
            Compare Content
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Select 2-3 analyzed items to compare. The AI will identify agreements,
            disagreements, and unique insights across your sources.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            type="text"
            placeholder="Search your content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search content to compare"
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Selection count */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-white/50">
            {selectedIds.size}/3 selected
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-[200px] max-h-[400px] pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-white/50 text-sm">
              {searchQuery
                ? "No matching content found"
                : "No analyzed content available"}
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedIds.has(item.id)
              const isDisabled = !isSelected && selectedIds.size >= 3
              const Icon = TYPE_ICONS[item.type ?? "article"] ?? FileText

              return (
                <button
                  key={item.id}
                  onClick={() => toggleSelection(item.id)}
                  disabled={isDisabled || isComparing}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                    isSelected
                      ? "bg-brand/15 border border-brand/30"
                      : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06] hover:border-white/[0.08]",
                    isDisabled && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {/* Checkbox area */}
                  <div
                    className={cn(
                      "w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors",
                      isSelected
                        ? "bg-brand border-brand"
                        : "border border-white/20 bg-white/[0.04]"
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>

                  {/* Type icon */}
                  <Icon className="w-4 h-4 text-white/50 shrink-0" />

                  {/* Content info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90 font-medium truncate">
                      {item.title ?? "Untitled"}
                    </div>
                    <div className="text-xs text-white/50 truncate">
                      {item.date_added
                        ? formatDistanceToNow(new Date(item.date_added), {
                            addSuffix: true,
                          })
                        : "Unknown date"}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
            disabled={isComparing}
          >
            Cancel
          </button>
          <button
            onClick={handleCompare}
            disabled={selectedIds.size < 2 || isComparing}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all",
              selectedIds.size >= 2
                ? "bg-brand hover:bg-brand-hover text-white"
                : "bg-white/[0.06] text-white/50 cursor-not-allowed"
            )}
          >
            {isComparing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <GitCompareArrows className="w-4 h-4" />
                Compare ({selectedIds.size})
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

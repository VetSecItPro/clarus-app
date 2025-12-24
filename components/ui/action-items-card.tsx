"use client"

import { motion } from "framer-motion"
import { CheckCircle2, Circle, Zap, Target, Lightbulb, Copy, Check } from "lucide-react"
import type { ActionItemsData, ActionItemData } from "@/types/database.types"
import { useState } from "react"
import { toast } from "sonner"

interface ActionItemsCardProps {
  actionItems: ActionItemsData
}

function getPriorityStyle(priority: string) {
  switch (priority) {
    case "high":
      return {
        bg: "bg-red-500/15",
        text: "text-red-400",
        border: "border-red-500/30",
        label: "High Priority",
      }
    case "medium":
      return {
        bg: "bg-yellow-500/15",
        text: "text-yellow-400",
        border: "border-yellow-500/30",
        label: "Medium",
      }
    case "low":
      return {
        bg: "bg-green-500/15",
        text: "text-green-400",
        border: "border-green-500/30",
        label: "Nice to have",
      }
    default:
      return {
        bg: "bg-white/10",
        text: "text-white/60",
        border: "border-white/20",
        label: priority,
      }
  }
}

function getCategoryIcon(category?: string) {
  const lower = category?.toLowerCase() || ""
  if (lower.includes("technical") || lower.includes("code")) {
    return <Zap className="w-3.5 h-3.5" />
  }
  if (lower.includes("strategy") || lower.includes("business")) {
    return <Target className="w-3.5 h-3.5" />
  }
  return <Lightbulb className="w-3.5 h-3.5" />
}

function ActionItem({ item, index }: { item: ActionItemData; index: number }) {
  const [isChecked, setIsChecked] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const priorityStyle = getPriorityStyle(item.priority)

  const handleCopy = async () => {
    const textToCopy = `${item.title}\n${item.description}${item.category ? `\nCategory: ${item.category}` : ""}\nPriority: ${item.priority}`
    try {
      await navigator.clipboard.writeText(textToCopy)
      setIsCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`group p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] transition-all ${
        isChecked ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => setIsChecked(!isChecked)}
          className="mt-0.5 flex-shrink-0 text-white/40 hover:text-[#1d9bf0] transition-colors"
        >
          {isChecked ? (
            <CheckCircle2 className="w-5 h-5 text-[#1d9bf0]" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title and badges */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className={`text-sm font-medium text-white leading-tight ${isChecked ? "line-through text-white/50" : ""}`}>
              {item.title}
            </h4>
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.category && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-white/[0.06] text-white/50 border border-white/[0.08]">
                  {getCategoryIcon(item.category)}
                  {item.category}
                </span>
              )}
              <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${priorityStyle.bg} ${priorityStyle.text} border ${priorityStyle.border}`}>
                {priorityStyle.label}
              </span>
              <button
                onClick={handleCopy}
                className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all"
                title="Copy to clipboard"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Description */}
          <p className={`text-sm text-white/50 leading-relaxed ${isChecked ? "line-through" : ""}`}>
            {item.description}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export function ActionItemsCard({ actionItems }: ActionItemsCardProps) {
  if (!actionItems || actionItems.length === 0) {
    return (
      <div className="text-center py-8 text-white/40">
        No action items extracted from this content.
      </div>
    )
  }

  // Sort by priority: high -> medium -> low
  const sortedItems = [...actionItems].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
  })

  const highPriorityCount = sortedItems.filter(i => i.priority === "high").length
  const totalCount = sortedItems.length

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-1"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/50">
            {totalCount} actionable {totalCount === 1 ? "item" : "items"}
          </span>
          {highPriorityCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
              {highPriorityCount} high priority
            </span>
          )}
        </div>
        <span className="text-xs text-white/30">Click to mark complete</span>
      </motion.div>

      {/* Action items list */}
      <div className="space-y-2">
        {sortedItems.map((item, index) => (
          <ActionItem key={index} item={item} index={index} />
        ))}
      </div>
    </div>
  )
}

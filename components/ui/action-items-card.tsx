"use client"

import { motion } from "framer-motion"
import { CheckCircle2, Circle, Copy, Check } from "lucide-react"
import type { ActionItemsData, ActionItemData } from "@/types/database.types"
import { useState } from "react"
import { toast } from "sonner"

interface ActionItemsCardProps {
  actionItems: ActionItemsData
}

function ActionItem({ item, index }: { item: ActionItemData; index: number }) {
  const [isChecked, setIsChecked] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = `${item.title}\n${item.description}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`group ${isChecked ? "opacity-50" : ""}`}
    >
      {/* Title row: checkbox + title + copy button */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsChecked(!isChecked)}
          className="flex-shrink-0 text-white/40 hover:text-[#1d9bf0] transition-colors"
        >
          {isChecked ? (
            <CheckCircle2 className="w-4 h-4 text-[#1d9bf0]" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
        </button>
        <span className={`flex-1 text-sm text-white/90 font-medium ${isChecked ? "line-through text-white/50" : ""}`}>
          {item.title}
        </span>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-1 rounded text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
          title="Copy action item"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      {/* Description - left justified */}
      <div className={`text-xs text-white/50 mt-1 leading-relaxed ${isChecked ? "line-through" : ""}`}>
        {item.description}
      </div>
      {/* Priority and category */}
      <div className="text-xs text-white/30 mt-1 capitalize">
        {item.priority} priority{item.category ? ` · ${item.category}` : ""}
      </div>
    </motion.div>
  )
}

export function ActionItemsCard({ actionItems }: ActionItemsCardProps) {
  if (!actionItems || actionItems.length === 0) {
    return (
      <div className="text-sm text-white/40">
        No action items extracted from this content.
      </div>
    )
  }

  // Sort by priority: high -> medium -> low
  const sortedItems = [...actionItems].sort((a, b) => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
  })

  return (
    <div className="space-y-4">
      {sortedItems.map((item, index) => (
        <ActionItem key={index} item={item} index={index} />
      ))}
    </div>
  )
}

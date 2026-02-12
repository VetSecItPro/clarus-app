"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Download, FileSpreadsheet, FileJson } from "lucide-react"
import { cn } from "@/lib/utils"
import { exportData, type ExportFormat } from "@/lib/admin/export"

interface ExportButtonProps {
  /** Data rows to export */
  data: Record<string, unknown>[]
  /** Base filename (without extension) */
  filename: string
  /** Column keys to include (defaults to all) */
  columns?: string[]
  /** Disabled state (e.g. while loading) */
  disabled?: boolean
}

const FORMAT_OPTIONS: { id: ExportFormat; label: string; icon: React.ElementType }[] = [
  { id: "csv", label: "Export CSV", icon: FileSpreadsheet },
  { id: "json", label: "Export JSON", icon: FileJson },
]

export function ExportButton({ data, filename, columns, disabled }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const timestamp = new Date().toISOString().slice(0, 10)
      exportData({ data, format, filename: `${filename}-${timestamp}`, columns })
      setIsOpen(false)
    },
    [data, filename, columns]
  )

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || data.length === 0}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
          "bg-white/[0.04] border border-white/[0.08] text-white/60",
          "hover:bg-white/[0.08] hover:text-white hover:border-white/[0.12]",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-40 bg-black/95 border border-white/[0.1] rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          {FORMAT_OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                onClick={() => handleExport(opt.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/60 hover:bg-white/[0.06] hover:text-white transition-all"
              >
                <Icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

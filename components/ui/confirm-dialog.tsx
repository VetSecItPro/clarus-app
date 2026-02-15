"use client"

import { useState, useCallback, useRef, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Hook ────────────────────────────────────────────

interface UseConfirmDialogOptions<T> {
  title: string | ((item: T) => string)
  description: string | ((item: T) => string)
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "default"
  onConfirm: (item: T) => Promise<void>
}

/**
 * Encapsulates the confirm-before-action pattern.
 *
 * Returns a `confirm(item)` trigger and a `dialog` element to render.
 * The hook manages open/loading state internally — consumers never
 * touch `useState` or wire up `onOpenChange` themselves.
 */
export function useConfirmDialog<T>(options: UseConfirmDialogOptions<T>): [ReactNode, (item: T) => void] {
  const [pending, setPending] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  // Ref keeps onConfirm stable across renders without re-creating the dialog element
  const optionsRef = useRef(options)
  optionsRef.current = options

  const confirm = useCallback((item: T) => {
    setPending(item)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!pending) return
    setLoading(true)
    try {
      await optionsRef.current.onConfirm(pending)
    } finally {
      setLoading(false)
      setPending(null)
    }
  }, [pending])

  const resolve = (str: string | ((item: T) => string), item: T) =>
    typeof str === "function" ? str(item) : str

  const opts = optionsRef.current

  const dialog = (
    <Dialog open={!!pending} onOpenChange={(open) => !open && !loading && setPending(null)}>
      <DialogContent className="max-w-sm bg-zinc-950 border-white/[0.08]">
        {pending && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">
                {resolve(opts.title, pending)}
              </DialogTitle>
              <DialogDescription className="text-white/60">
                {resolve(opts.description, pending)}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <button
                onClick={() => setPending(null)}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.1] transition-all text-sm disabled:opacity-50"
              >
                {opts.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2",
                  (opts.variant ?? "default") === "danger"
                    ? "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
                    : "bg-brand/20 border border-brand/30 text-brand hover:bg-brand/30"
                )}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {opts.confirmLabel ?? "Confirm"}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )

  return [dialog, confirm]
}

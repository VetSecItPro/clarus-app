"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">
          Failed to load install page
        </h2>
        <p className="text-white/50 text-sm mb-6">
          Something went wrong. You can also install Clarus from your browser menu.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2 rounded-full bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-5 py-2 rounded-full bg-white/[0.06] text-white/70 text-sm hover:bg-white/[0.1] transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}

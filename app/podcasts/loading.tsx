// FE: FIX-FE-006 — loading state for podcasts route
import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div role="status" aria-label="Loading">
        <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  )
}

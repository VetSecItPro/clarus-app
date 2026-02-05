// FE: FIX-FE-008 — error boundary for library route
"use client"

export default function Error({ error: _error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[#1d9bf0] rounded-lg hover:bg-[#1d9bf0]/80 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

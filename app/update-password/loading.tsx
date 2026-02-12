export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="h-7 w-48 bg-white/[0.08] rounded mx-auto animate-pulse" />
          <div className="h-4 w-64 bg-white/[0.06] rounded mx-auto animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-11 bg-white/[0.04] rounded-lg border border-white/[0.06] animate-pulse" />
          <div className="h-11 bg-white/[0.04] rounded-lg border border-white/[0.06] animate-pulse" />
          <div className="h-11 bg-white/[0.06] rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}

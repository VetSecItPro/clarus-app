export default function Loading() {
  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header skeleton */}
      <div className="h-14 border-b border-white/[0.06] hidden sm:block" />

      {/* Chat header skeleton */}
      <div className="border-b border-white/[0.06] bg-black">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-48 bg-white/[0.08] rounded animate-pulse" />
            <div className="h-3 w-32 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-9 h-9 rounded-lg bg-white/[0.04] animate-pulse" />
            <div className="w-9 h-9 rounded-lg bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-h-0 w-full mx-auto" style={{ maxWidth: "720px" }}>
        <div className="flex-1 overflow-hidden px-4 pt-4">
          {/* Content summary card skeleton */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 mb-4" style={{ maxWidth: "600px" }}>
            <div className="flex gap-3">
              <div className="w-20 h-14 rounded-lg bg-white/[0.05] animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-white/[0.08] rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-white/[0.06] rounded animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-5 w-12 bg-white/[0.08] rounded-full animate-pulse" />
                  <div className="h-5 w-16 bg-white/[0.08] rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Message skeletons */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.05] animate-pulse" />
              <div className="flex-1 space-y-2 max-w-md">
                <div className="h-4 w-full bg-white/[0.06] rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-white/[0.06] rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Input bar skeleton */}
        <div className="shrink-0 pb-20 sm:pb-4 px-4">
          <div className="h-12 bg-white/[0.04] border border-white/[0.06] rounded-xl animate-pulse" />
        </div>
      </main>
    </div>
  )
}

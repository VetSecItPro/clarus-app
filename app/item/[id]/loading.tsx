export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header skeleton */}
      <div className="h-16 border-b border-white/[0.06]" />

      <main className="flex-1 max-w-4xl mx-auto px-4 pt-4 pb-8 w-full">
        {/* Back button + title skeleton */}
        <div className="mb-6">
          <div className="h-4 w-16 bg-white/[0.06] rounded animate-pulse mb-4" />
          <div className="h-7 w-3/4 bg-white/[0.06] rounded animate-pulse mb-2" />
          <div className="flex gap-3 items-center">
            <div className="h-4 w-24 bg-white/[0.04] rounded animate-pulse" />
            <div className="h-4 w-20 bg-white/[0.04] rounded animate-pulse" />
          </div>
        </div>

        {/* Triage card skeleton */}
        <div className="h-24 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse mb-6" />

        {/* Summary skeleton */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-4 animate-pulse">
          <div className="h-5 w-32 bg-white/[0.06] rounded mb-3" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-white/[0.04] rounded" />
            <div className="h-4 w-5/6 bg-white/[0.04] rounded" />
            <div className="h-4 w-4/6 bg-white/[0.04] rounded" />
          </div>
        </div>

        {/* Analysis sections skeleton */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-white/[0.06] rounded-lg" />
                <div className="h-5 w-36 bg-white/[0.06] rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-white/[0.04] rounded" />
                <div className="h-4 w-5/6 bg-white/[0.04] rounded" />
                <div className="h-4 w-3/6 bg-white/[0.04] rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

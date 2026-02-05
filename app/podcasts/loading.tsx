export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header skeleton */}
      <div className="h-16 border-b border-white/[0.06]" />

      <main className="flex-1 max-w-3xl mx-auto px-4 pt-6 pb-8 w-full">
        {/* Page header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <div className="h-7 w-40 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-4 w-56 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-28 bg-white/[0.06] rounded-full animate-pulse" />
        </div>

        {/* Subscription card skeletons */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/[0.06] rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-48 bg-white/[0.06] rounded" />
                  <div className="h-4 w-32 bg-white/[0.04] rounded" />
                </div>
                <div className="w-8 h-8 bg-white/[0.06] rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

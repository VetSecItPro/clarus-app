export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header skeleton */}
      <div className="h-14 border-b border-white/[0.06]" />

      <main className="flex-1 max-w-2xl mx-auto px-4 py-8 w-full">
        {/* Page title skeleton */}
        <div className="mb-8 space-y-2">
          <div className="h-7 w-32 bg-white/[0.06] rounded animate-pulse" />
          <div className="h-4 w-56 bg-white/[0.04] rounded animate-pulse" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-4 mb-8 border-b border-white/[0.06] pb-px">
          <div className="h-5 w-16 bg-white/[0.06] rounded animate-pulse mb-2.5" />
          <div className="h-5 w-24 bg-white/[0.04] rounded animate-pulse mb-2.5" />
        </div>

        {/* Period + tier header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <div className="h-5 w-36 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-3 w-24 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-4 w-20 bg-white/[0.06] rounded animate-pulse" />
        </div>

        {/* Usage bars skeleton */}
        <div className="space-y-5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] animate-pulse" />
                  <div className="h-4 w-28 bg-white/[0.06] rounded animate-pulse" />
                </div>
                <div className="h-4 w-14 bg-white/[0.06] rounded animate-pulse" />
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

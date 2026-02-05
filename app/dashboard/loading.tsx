export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header skeleton */}
      <div className="h-16 border-b border-white/[0.06]" />

      <main className="flex-1 max-w-4xl mx-auto px-4 pt-6 pb-8 w-full">
        {/* Page title skeleton */}
        <div className="mb-6 space-y-2">
          <div className="h-7 w-32 bg-white/[0.06] rounded animate-pulse" />
          <div className="h-4 w-48 bg-white/[0.04] rounded animate-pulse" />
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-white/[0.03] border border-white/[0.06] rounded-xl animate-pulse"
            />
          ))}
        </div>

        {/* Content list skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-white/[0.03] border border-white/[0.06] rounded-xl animate-pulse"
            />
          ))}
        </div>
      </main>
    </div>
  )
}

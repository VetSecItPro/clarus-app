export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header skeleton */}
      <div className="h-14 border-b border-white/[0.06]" />

      <main className="flex-1 max-w-4xl mx-auto px-4 pt-6 pb-8 w-full">
        {/* Content header skeleton */}
        <div className="mb-6 space-y-3">
          <div className="h-5 w-20 bg-white/[0.06] rounded animate-pulse" />
          <div className="h-8 w-3/4 bg-white/[0.06] rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-white/[0.04] rounded animate-pulse" />
        </div>

        {/* Triage card skeleton */}
        <div className="h-24 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse mb-4" />

        {/* Summary skeleton */}
        <div className="space-y-3 mb-6">
          <div className="h-4 w-full bg-white/[0.04] rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-white/[0.04] rounded animate-pulse" />
          <div className="h-4 w-4/6 bg-white/[0.04] rounded animate-pulse" />
        </div>

        {/* Analysis sections skeleton */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </main>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header skeleton */}
      <div className="h-16 border-b border-white/[0.06]" />

      <main className="flex-1 max-w-4xl mx-auto px-4 pt-6 pb-8 w-full">
        {/* Back button skeleton */}
        <div className="h-4 w-20 bg-white/[0.06] rounded animate-pulse mb-6" />

        {/* Page title skeleton */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-white/[0.06] rounded-xl animate-pulse" />
          <div className="space-y-2">
            <div className="h-7 w-48 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-4 w-64 bg-white/[0.04] rounded animate-pulse" />
          </div>
        </div>

        {/* Source selection skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-white/[0.03] border border-dashed border-white/[0.1] rounded-2xl animate-pulse flex items-center justify-center"
            >
              <div className="w-8 h-8 bg-white/[0.06] rounded-full" />
            </div>
          ))}
        </div>

        {/* Compare button skeleton */}
        <div className="flex justify-center">
          <div className="h-10 w-36 bg-white/[0.06] rounded-full animate-pulse" />
        </div>
      </main>
    </div>
  )
}

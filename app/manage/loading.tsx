export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header skeleton */}
      <div className="h-16 border-b border-white/[0.06]" />

      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Sidebar skeleton */}
        <aside className="hidden lg:block w-56 border-r border-white/[0.06] p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-9 bg-white/[0.06] rounded-lg animate-pulse"
            />
          ))}
        </aside>

        {/* Content skeleton */}
        <main className="flex-1 p-4 sm:p-6">
          {/* Metric cards skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 bg-white/[0.03] border border-white/[0.06] rounded-xl animate-pulse"
              />
            ))}
          </div>

          {/* Chart skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-56 bg-white/[0.03] border border-white/[0.06] rounded-xl animate-pulse"
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

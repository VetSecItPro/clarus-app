export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header skeleton */}
      <div className="h-16 border-b border-white/[0.06]" />

      <main className="flex-1 max-w-3xl mx-auto px-4 lg:px-6 py-6 sm:py-10 w-full">
        {/* Badge skeleton */}
        <div className="mb-6 sm:mb-8">
          <div className="h-7 w-32 bg-white/[0.06] rounded-full animate-pulse mb-4" />
          <div className="h-8 w-40 bg-white/[0.06] rounded animate-pulse mb-1.5" />
          <div className="h-4 w-56 bg-white/[0.04] rounded animate-pulse" />
        </div>

        {/* Filter bar skeleton */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            <div className="h-8 w-24 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-8 w-24 bg-white/[0.06] rounded-lg animate-pulse" />
          </div>
          <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            <div className="h-8 w-12 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Card skeletons */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 animate-pulse"
            >
              <div className="flex gap-3">
                <div className="w-7 space-y-2">
                  <div className="h-7 bg-white/[0.06] rounded" />
                  <div className="h-4 bg-white/[0.06] rounded mx-auto w-4" />
                  <div className="h-7 bg-white/[0.06] rounded" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between">
                    <div className="h-5 bg-white/[0.06] rounded w-20" />
                    <div className="h-5 bg-white/[0.06] rounded w-10" />
                  </div>
                  <div className="h-5 bg-white/[0.06] rounded w-3/4" />
                  <div className="h-4 bg-white/[0.04] rounded w-full" />
                  <div className="h-4 bg-white/[0.04] rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

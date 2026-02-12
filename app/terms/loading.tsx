export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="h-16 border-b border-white/[0.06]" />
      <main className="flex-1 max-w-3xl mx-auto px-4 pt-12 pb-16 w-full">
        <div className="h-8 w-56 bg-white/[0.08] rounded animate-pulse mb-3" />
        <div className="h-4 w-32 bg-white/[0.06] rounded animate-pulse mb-10" />
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-5 w-40 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-4 bg-white/[0.04] rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-white/[0.04] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

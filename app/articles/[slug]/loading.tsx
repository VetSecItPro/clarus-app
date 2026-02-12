export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="h-16 border-b border-white/[0.06]" />
      <main className="flex-1 max-w-3xl mx-auto px-4 pt-10 pb-16 w-full">
        <div className="h-5 w-24 bg-white/[0.06] rounded animate-pulse mb-6" />
        <div className="h-10 w-3/4 bg-white/[0.08] rounded animate-pulse mb-3" />
        <div className="h-4 w-48 bg-white/[0.06] rounded animate-pulse mb-8" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-white/[0.04] rounded animate-pulse" style={{ width: `${90 - i * 5}%` }} />
          ))}
        </div>
      </main>
    </div>
  )
}

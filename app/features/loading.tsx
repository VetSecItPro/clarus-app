export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="h-16 border-b border-white/[0.06]" />
      <main className="flex-1 max-w-5xl mx-auto px-4 pt-12 pb-16 w-full">
        <div className="text-center mb-12 space-y-3">
          <div className="h-8 w-56 bg-white/[0.08] rounded mx-auto animate-pulse" />
          <div className="h-4 w-80 bg-white/[0.06] rounded mx-auto animate-pulse" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-white/[0.04] rounded-2xl border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  )
}

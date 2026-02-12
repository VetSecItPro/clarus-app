export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="h-16 border-b border-white/[0.06]" />
      <main className="flex-1 max-w-2xl mx-auto px-4 pt-12 pb-16 w-full">
        <div className="text-center mb-10 space-y-3">
          <div className="h-8 w-40 bg-white/[0.08] rounded mx-auto animate-pulse" />
          <div className="h-4 w-64 bg-white/[0.06] rounded mx-auto animate-pulse" />
        </div>
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-white/[0.04] rounded-lg border border-white/[0.06] animate-pulse" />
          ))}
          <div className="h-32 bg-white/[0.04] rounded-lg border border-white/[0.06] animate-pulse" />
          <div className="h-11 w-32 bg-white/[0.06] rounded-full animate-pulse" />
        </div>
      </main>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="h-16 border-b border-white/[0.06]" />
      <main id="main-content" className="flex-1 max-w-5xl mx-auto px-4 pt-12 pb-16 w-full">
        <div className="text-center mb-10 space-y-3">
          <div className="h-8 w-48 bg-white/[0.08] rounded mx-auto animate-pulse" />
          <div className="h-4 w-72 bg-white/[0.06] rounded mx-auto animate-pulse" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[400px] bg-white/[0.04] rounded-2xl border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="h-16 border-b border-white/[0.06]" />
      <main className="flex-1 max-w-4xl mx-auto px-4 pt-8 pb-16 w-full">
        <div className="h-8 w-32 bg-white/[0.08] rounded animate-pulse mb-8" />
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-white/[0.04] rounded-xl border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  )
}

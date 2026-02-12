export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="h-16 border-b border-white/[0.06]" />
      <main className="flex-1 max-w-2xl mx-auto px-4 pt-8 pb-16 w-full">
        <div className="h-7 w-36 bg-white/[0.08] rounded animate-pulse mb-6" />
        <div className="h-12 bg-white/[0.04] rounded-xl border border-white/[0.06] animate-pulse mb-4" />
        <div className="h-9 w-28 bg-white/[0.08] rounded-full animate-pulse" />
      </main>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <main className="flex-1 max-w-lg mx-auto px-4 pt-16 pb-16 w-full">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 bg-white/[0.06] rounded-2xl mx-auto animate-pulse" />
          <div className="h-8 w-48 bg-white/[0.08] rounded mx-auto animate-pulse" />
          <div className="h-4 w-72 bg-white/[0.06] rounded mx-auto animate-pulse" />
        </div>
        <div className="mt-10 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/[0.04] rounded-xl border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  )
}

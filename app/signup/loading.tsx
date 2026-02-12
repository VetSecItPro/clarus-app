export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-xs px-6 space-y-4">
        <div className="h-7 w-40 bg-white/[0.08] rounded animate-pulse mb-6" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-white/[0.04] rounded-lg border border-white/[0.06] animate-pulse" />
        ))}
        <div className="h-9 w-36 bg-white/[0.08] rounded-full mx-auto animate-pulse mt-4" />
      </div>
    </div>
  )
}

import { FeedListSkeleton } from "@/components/ui/content-skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header skeleton */}
      <div className="h-16 border-b border-white/[0.06]" />

      <main className="flex-1 max-w-4xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-16 sm:pb-8 w-full">
        {/* Page header skeleton */}
        <div className="flex items-center justify-between mb-3 sm:mb-6">
          <div className="space-y-2">
            <div className="h-7 w-32 bg-white/[0.08] rounded animate-pulse" />
            <div className="h-4 w-48 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-1 p-1 bg-white/[0.06] rounded-lg">
            <div className="w-8 h-8 bg-white/[0.08] rounded-md animate-pulse" />
            <div className="w-8 h-8 bg-white/[0.08] rounded-md animate-pulse" />
          </div>
        </div>

        {/* Search bar skeleton */}
        <div className="mb-3 sm:mb-6 flex items-center gap-2">
          <div className="flex-1 h-[42px] sm:h-[46px] bg-white/[0.06] rounded-xl sm:rounded-2xl animate-pulse" />
          <div className="h-[42px] sm:h-[46px] w-[42px] sm:w-[46px] bg-white/[0.06] rounded-full animate-pulse" />
        </div>

        {/* Content skeleton */}
        <FeedListSkeleton count={5} viewMode="list" />
      </main>
    </div>
  )
}

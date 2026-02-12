import { cn } from "@/lib/utils"

// Reusable skeleton pulse animation
const shimmer = "animate-pulse bg-white/[0.08]"

export function ContentCardSkeleton({ viewMode = "list" }: { viewMode?: "list" | "grid" }) {
  if (viewMode === "grid") {
    return (
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        {/* Thumbnail */}
        <div className={cn("aspect-video", shimmer)} />
        {/* Content */}
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className={cn("h-5 w-16 rounded-full", shimmer)} />
            <div className={cn("h-4 w-8 rounded ml-auto", shimmer)} />
          </div>
          <div className={cn("h-4 w-full rounded", shimmer)} />
          <div className={cn("h-4 w-3/4 rounded", shimmer)} />
          <div className={cn("h-3 w-24 rounded", shimmer)} />
        </div>
      </div>
    )
  }

  // List view skeleton
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className={cn("w-28 h-20 flex-shrink-0 rounded-xl", shimmer)} />
        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className={cn("h-5 w-16 rounded-full", shimmer)} />
            <div className={cn("h-4 w-12 rounded", shimmer)} />
          </div>
          <div className={cn("h-4 w-full rounded", shimmer)} />
          <div className={cn("h-4 w-2/3 rounded", shimmer)} />
          <div className={cn("h-3 w-40 rounded", shimmer)} />
        </div>
        {/* Expand button */}
        <div className={cn("w-8 h-8 rounded-lg self-center", shimmer)} />
      </div>
    </div>
  )
}

export function ContentListSkeleton({
  count = 5,
  viewMode = "list"
}: {
  count?: number
  viewMode?: "list" | "grid"
}) {
  return (
    <div className={cn(
      viewMode === "grid"
        ? "grid grid-cols-2 lg:grid-cols-3 gap-4"
        : "space-y-3"
    )}>
      {Array.from({ length: count }).map((_, i) => (
        <ContentCardSkeleton key={i} viewMode={viewMode} />
      ))}
    </div>
  )
}

export function FeedCardSkeleton({ viewMode = "list" }: { viewMode?: "list" | "grid" }) {
  if (viewMode === "grid") {
    return (
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        {/* User bar */}
        <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
          <div className={cn("w-5 h-5 rounded-full", shimmer)} />
          <div className={cn("h-3 w-20 rounded", shimmer)} />
          <div className={cn("h-4 w-10 rounded-full ml-auto", shimmer)} />
        </div>
        {/* Thumbnail */}
        <div className={cn("aspect-video", shimmer)} />
        {/* Content */}
        <div className="p-3 space-y-2">
          <div className={cn("h-5 w-16 rounded-full", shimmer)} />
          <div className={cn("h-4 w-full rounded", shimmer)} />
          <div className={cn("h-3 w-24 rounded", shimmer)} />
        </div>
      </div>
    )
  }

  // List view skeleton
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* User bar */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <div className={cn("w-7 h-7 rounded-full", shimmer)} />
        <div className={cn("h-4 w-24 rounded", shimmer)} />
        <div className={cn("h-5 w-16 rounded-full ml-2", shimmer)} />
      </div>
      {/* Main content */}
      <div className="p-4 flex gap-4">
        <div className={cn("w-28 h-20 flex-shrink-0 rounded-xl", shimmer)} />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className={cn("h-5 w-16 rounded-full", shimmer)} />
            <div className={cn("h-4 w-10 rounded", shimmer)} />
          </div>
          <div className={cn("h-4 w-full rounded", shimmer)} />
          <div className={cn("h-4 w-2/3 rounded", shimmer)} />
          <div className={cn("h-3 w-32 rounded", shimmer)} />
        </div>
        <div className={cn("w-8 h-8 rounded-lg self-center", shimmer)} />
      </div>
    </div>
  )
}

export function FeedListSkeleton({
  count = 5,
  viewMode = "list"
}: {
  count?: number
  viewMode?: "list" | "grid"
}) {
  return (
    <div className={cn(
      viewMode === "grid"
        ? "grid grid-cols-2 lg:grid-cols-3 gap-4"
        : "space-y-4"
    )}>
      {Array.from({ length: count }).map((_, i) => (
        <FeedCardSkeleton key={i} viewMode={viewMode} />
      ))}
    </div>
  )
}

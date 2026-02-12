"use client"

import React, { memo } from "react"
import Link from "next/link"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { cn, formatDuration } from "@/lib/utils"
import { FileText, Play, Trash2, Loader2, Zap, Twitter, ChevronDown, ChevronUp, ArrowRight, Star, TrendingUp, Bookmark, ShieldCheck, AlertTriangle, Clock } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { LibraryItem } from "@/lib/hooks/use-library"

// Shimmer placeholder for better perceived loading
const shimmerBase64 = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxYTFhMWEiLz48L3N2Zz4="

type SummaryData = {
  brief_overview: string | null
  mid_length_summary: string | null
  triage: {
    quality_score?: number
    signal_noise_score?: number
    worth_your_time?: string
    one_liner?: string
  } | null
  truth_check: {
    overall_rating?: string
    issues?: unknown[]
    sources_quality?: string
  } | null
}

interface LibraryItemCardProps {
  item: LibraryItem
  viewMode: "list" | "grid"
  isExpanded: boolean
  deletingId: string | null
  togglingBookmark: string | null
  onToggleExpand: (e: React.MouseEvent, itemId: string) => void
  onToggleBookmark: (e: React.MouseEvent, item: LibraryItem) => void
  onDelete: (e: React.MouseEvent, itemId: string) => void
}

const getTypeBadge = (type: string | null) => {
  switch (type) {
    case "youtube":
      return { icon: Play, label: "YouTube", color: "bg-red-500/20 text-red-400 border-red-500/30" }
    case "x_post":
      return { icon: Twitter, label: "X Post", color: "bg-white/10 text-white/80 border-white/20" }
    case "article":
    default:
      return { icon: FileText, label: "Article", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" }
  }
}

const getDomain = (url: string | null) => {
  if (!url) return ""
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch {
    return ""
  }
}

const getSummaryData = (item: LibraryItem): SummaryData | null => {
  const summaries = item.summaries
  if (Array.isArray(summaries)) {
    return summaries[0] ?? null
  }
  return summaries as SummaryData | null
}

const getSignalRating = (item: LibraryItem) => {
  const ratings = item.content_ratings
  if (Array.isArray(ratings)) {
    return ratings[0]?.signal_score ?? null
  }
  return (ratings as unknown as { signal_score: number | null })?.signal_score ?? null
}

const getSummaryPreview = (item: LibraryItem) => {
  const summary = getSummaryData(item)
  const overview = summary?.brief_overview
  if (!overview) return null
  return overview.length > 80 ? overview.slice(0, 80) + "..." : overview
}

/** Build a compact accuracy summary line from truth check data */
const getAccuracySummary = (item: LibraryItem): {
  issueCount: number
  overallRating: string | null
  sourcesQuality: string | null
} | null => {
  const summary = getSummaryData(item)
  const tc = summary?.truth_check
  if (!tc) return null

  const issues = Array.isArray(tc.issues) ? tc.issues : []
  return {
    issueCount: issues.length,
    overallRating: tc.overall_rating ?? null,
    sourcesQuality: tc.sources_quality ?? null,
  }
}

/** Mini-summary badge row for accuracy + quality at a glance */
function MiniSummaryLine({ item }: { item: LibraryItem }) {
  const accuracy = getAccuracySummary(item)
  const summaryData = getSummaryData(item)
  const qualityScore = summaryData?.triage?.quality_score

  // Only render if we have at least one data point
  if (!accuracy && !qualityScore) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {accuracy && (
        <span className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border",
          accuracy.issueCount === 0
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : accuracy.issueCount <= 2
              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
        )}>
          {accuracy.issueCount === 0 ? (
            <ShieldCheck className="w-2.5 h-2.5" />
          ) : (
            <AlertTriangle className="w-2.5 h-2.5" />
          )}
          {accuracy.issueCount === 0
            ? "No issues"
            : `${accuracy.issueCount} ${accuracy.issueCount === 1 ? "issue" : "issues"}`}
        </span>
      )}
      {accuracy?.overallRating && (
        <span className="text-[10px] text-white/40">{accuracy.overallRating}</span>
      )}
      {qualityScore && (
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
          <Star className="w-2.5 h-2.5" />
          {qualityScore}/10
        </span>
      )}
    </div>
  )
}

/** Compute analysis age in days from date_added */
function getAnalysisAgeDays(item: LibraryItem): number | null {
  if (!item.date_added) return null
  return Math.floor((Date.now() - new Date(item.date_added).getTime()) / (1000 * 60 * 60 * 24))
}

function LibraryItemCardComponent({
  item,
  viewMode,
  isExpanded,
  deletingId,
  togglingBookmark,
  onToggleExpand,
  onToggleBookmark,
  onDelete,
}: LibraryItemCardProps) {
  const typeBadge = getTypeBadge(item.type)
  const TypeIcon = typeBadge.icon
  const signalScore = getSignalRating(item)
  const summaryPreview = getSummaryPreview(item)
  const summaryData = getSummaryData(item)
  const triage = summaryData?.triage
  const ageDays = getAnalysisAgeDays(item)
  const isStale = ageDays !== null && ageDays > 7
  const isVeryStale = ageDays !== null && ageDays > 30

  if (viewMode === "grid") {
    return (
      <div className="group relative bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200">
        <Link href={`/item/${item.id}`}>
          {/* Thumbnail */}
          <div className="relative aspect-video bg-white/[0.06]">
            {item.thumbnail_url ? (
              /* FIX-309: descriptive alt text for grid thumbnail */
              <Image
                src={item.thumbnail_url}
                alt={item.title || "Content thumbnail"}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                loading="lazy"
                placeholder="blur"
                blurDataURL={shimmerBase64}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <TypeIcon className="w-8 h-8 text-white/20" />
              </div>
            )}
            {/* Duration badge for videos */}
            {item.type === "youtube" && item.duration && (
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] text-white font-medium">
                {formatDuration(item.duration)}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-3">
            {/* Type badge & Signal */}
            <div className="flex items-center justify-between mb-2">
              <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium", typeBadge.color)}>
                <TypeIcon className="w-2.5 h-2.5" />
                {typeBadge.label}
              </div>
              {signalScore && (
                <div className="flex items-center gap-1 text-amber-400 text-xs">
                  <Zap className="w-3 h-3 fill-current" />
                  <span>{signalScore}</span>
                </div>
              )}
            </div>

            <h3 className="text-white font-medium text-sm line-clamp-2 mb-1">
              {item.title || "Processing..."}
            </h3>
            <p className="text-white/40 text-xs mb-1.5">{getDomain(item.url)}</p>
            {/* Mini-summary line */}
            <div className="mb-1.5">
              <MiniSummaryLine item={item} />
            </div>
            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-[9px] text-purple-400 capitalize"
                  >
                    {tag}
                  </span>
                ))}
                {item.tags.length > 2 && (
                  <span className="text-[9px] text-white/40">+{item.tags.length - 2}</span>
                )}
              </div>
            )}
          </div>
        </Link>

        {/* Action buttons */}
        <TooltipProvider delayDuration={300}>
          <div className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10">
            {/* FIX-304: added aria-labels for grid view icon-only buttons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => onToggleBookmark(e, item)}
                  disabled={togglingBookmark === item.id}
                  aria-label={item.is_bookmarked ? "Remove bookmark" : "Add bookmark"}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    item.is_bookmarked
                      ? "bg-amber-500/80 text-white"
                      : "bg-black/60 hover:bg-amber-500/80"
                  )}
                >
                  {togglingBookmark === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Bookmark className={cn("w-3.5 h-3.5 text-white", item.is_bookmarked && "fill-current")} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{item.is_bookmarked ? "Remove bookmark" : "Add bookmark"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => onDelete(e, item.id)}
                  disabled={deletingId === item.id}
                  aria-label="Delete item"
                  className="p-1.5 bg-black/60 rounded-lg hover:bg-red-500/80 transition-all"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
        {/* Bookmark indicator when bookmarked */}
        {item.is_bookmarked && (
          <div className="absolute top-2 left-2 p-1 bg-amber-500/80 rounded-md z-10">
            <Bookmark className="w-3 h-3 text-white fill-current" />
          </div>
        )}
      </div>
    )
  }

  // List view with expandable cards
  return (
    <div className={cn(
      "group relative bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-200 feed-item",
      isExpanded ? "bg-white/[0.06] border-white/[0.15]" : "hover:bg-white/[0.06] hover:border-white/[0.12]"
    )}>
      {/* Main card content */}
      <div
        className="p-4 cursor-pointer"
        onClick={(e) => onToggleExpand(e, item.id)}
      >
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="relative w-28 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.06]">
            {item.thumbnail_url ? (
              /* FIX-309: descriptive alt text for list thumbnail */
              <Image
                src={item.thumbnail_url}
                alt={item.title || "Content thumbnail"}
                fill
                className="object-cover"
                sizes="112px"
                loading="lazy"
                placeholder="blur"
                blurDataURL={shimmerBase64}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <TypeIcon className="w-6 h-6 text-white/20" />
              </div>
            )}
            {/* Duration badge for videos */}
            {item.type === "youtube" && item.duration && (
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-[10px] text-white font-medium">
                {formatDuration(item.duration)}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Type badge & Signal */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium", typeBadge.color)}>
                <TypeIcon className="w-2.5 h-2.5" />
                {typeBadge.label}
              </div>
              {signalScore && (
                <div className="flex items-center gap-1 text-amber-400 text-xs">
                  <Zap className="w-3 h-3 fill-current" />
                  <span>{signalScore}</span>
                </div>
              )}
            </div>

            <h3 className="text-white font-medium text-sm line-clamp-2 mb-1">
              {item.title || "Processing..."}
            </h3>

            {/* Summary preview - only when collapsed */}
            {!isExpanded && summaryPreview && (
              <p className="text-white/50 text-xs line-clamp-1 mb-1">{summaryPreview}</p>
            )}

            {/* Mini-summary line - only when collapsed */}
            {!isExpanded && (
              <div className="mb-1">
                <MiniSummaryLine item={item} />
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
              <span>{getDomain(item.url)}</span>
              {item.date_added && (
                <>
                  <span>•</span>
                  <span className={cn(
                    isVeryStale && "text-red-400/60",
                    isStale && !isVeryStale && "text-amber-400/60"
                  )}>
                    {isStale && <Clock className="w-3 h-3 inline mr-0.5 -mt-px" />}
                    Analyzed {formatDistanceToNow(new Date(item.date_added), { addSuffix: true })}
                  </span>
                </>
              )}
            </div>
            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-[10px] text-purple-400 capitalize"
                  >
                    {tag}
                  </span>
                ))}
                {item.tags.length > 3 && (
                  <span className="text-[10px] text-white/40">+{item.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>

          {/* Expand/collapse button */}
          <div className="flex items-center">
            <div className={cn(
              "p-1.5 rounded-lg transition-all",
              isExpanded ? "bg-white/[0.1]" : "opacity-50 group-hover:opacity-100"
            )}>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-white/60" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white/60" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-white/[0.08] pt-4 space-y-4">
          {/* Triage info */}
          {triage && (
            <div className="flex flex-wrap gap-3">
              {triage.quality_score && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <Star className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400">Quality: {triage.quality_score}/10</span>
                </div>
              )}
              {triage.signal_noise_score !== undefined && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-amber-400">
                    Signal: {["Noise", "Noteworthy", "Insightful", "Mind-blowing"][triage.signal_noise_score] || triage.signal_noise_score}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* One-liner */}
          {triage?.one_liner && (
            <p className="text-white/70 text-sm italic">&ldquo;{triage.one_liner}&rdquo;</p>
          )}

          {/* Brief overview */}
          {summaryData?.brief_overview && (
            <div>
              <h4 className="text-white/50 text-xs uppercase tracking-wide mb-2">Overview</h4>
              <p className="text-white/80 text-sm leading-relaxed line-clamp-4">{summaryData.brief_overview}</p>
            </div>
          )}

          {/* Key takeaways */}
          {summaryData?.mid_length_summary && (
            <div>
              <h4 className="text-white/50 text-xs uppercase tracking-wide mb-2">Key Takeaways</h4>
              <p className="text-white/70 text-sm leading-relaxed line-clamp-4">{summaryData.mid_length_summary}</p>
            </div>
          )}

          {/* Worth reading */}
          {triage?.worth_your_time && (
            <div className="p-3 bg-white/[0.04] rounded-xl">
              <h4 className="text-white/50 text-xs uppercase tracking-wide mb-1">Worth Your Time?</h4>
              <p className="text-white/80 text-sm">{triage.worth_your_time}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3">
            <Link
              href={`/item/${item.id}`}
              onClick={(e) => e.stopPropagation()}
              prefetch={true}
              className="group/btn inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1d9bf0] to-[#0d8bdf] hover:from-[#1a8cd8] hover:to-[#0a7bc8] text-white rounded-full transition-all text-sm font-semibold shadow-lg shadow-[#1d9bf0]/25 hover:shadow-[#1d9bf0]/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              View Full Analysis
              <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" />
            </Link>
            <div className="flex items-center gap-2">
              {/* FIX-304: added aria-label for expanded list view bookmark button */}
              <button
                onClick={(e) => onToggleBookmark(e, item)}
                disabled={togglingBookmark === item.id}
                aria-label={item.is_bookmarked ? "Remove bookmark" : "Add bookmark"}
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-full transition-all border",
                  item.is_bookmarked
                    ? "bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30"
                    : "bg-white/[0.06] border-white/[0.08] text-white/50 hover:bg-amber-500/20 hover:border-amber-500/30 hover:text-amber-400"
                )}
                title={item.is_bookmarked ? "Remove bookmark" : "Add bookmark"}
              >
                {togglingBookmark === item.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bookmark className={cn("w-4 h-4", item.is_bookmarked && "fill-current")} />
                )}
              </button>
              {/* FIX-304: added aria-label for expanded list view delete button */}
              <button
                onClick={(e) => onDelete(e, item.id)}
                disabled={deletingId === item.id}
                aria-label="Delete item"
                className="w-10 h-10 flex items-center justify-center bg-white/[0.06] border border-white/[0.08] hover:bg-red-500/20 hover:border-red-500/30 text-white/50 hover:text-red-400 rounded-full transition-all"
                title="Delete"
              >
                {deletingId === item.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons - only show when collapsed */}
      {!isExpanded && (
        <TooltipProvider delayDuration={300}>
          <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <Tooltip>
              {/* FIX-304: added aria-labels for collapsed list view icon-only buttons */}
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => onToggleBookmark(e, item)}
                  disabled={togglingBookmark === item.id}
                  aria-label={item.is_bookmarked ? "Remove bookmark" : "Add bookmark"}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    item.is_bookmarked
                      ? "bg-amber-500/20 text-amber-400"
                      : "hover:bg-amber-500/20 text-white/40 hover:text-amber-400"
                  )}
                >
                  {togglingBookmark === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bookmark className={cn("w-4 h-4", item.is_bookmarked && "fill-current")} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{item.is_bookmarked ? "Remove bookmark" : "Add bookmark"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => onDelete(e, item.id)}
                  disabled={deletingId === item.id}
                  aria-label="Delete item"
                  className="p-2 rounded-lg hover:bg-red-500/20 transition-all"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}
      {/* Bookmark indicator - always visible when bookmarked */}
      {item.is_bookmarked && !isExpanded && (
        <div className="absolute top-3 left-3">
          <Bookmark className="w-4 h-4 text-amber-400 fill-current" />
        </div>
      )}
    </div>
  )
}

// Memoize the component to prevent re-renders when props haven't changed
export const LibraryItemCard = memo(LibraryItemCardComponent, (prevProps, nextProps) => {
  // Custom comparison - only re-render if relevant props changed
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.title === nextProps.item.title &&
    prevProps.item.is_bookmarked === nextProps.item.is_bookmarked &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.deletingId === nextProps.deletingId &&
    prevProps.togglingBookmark === nextProps.togglingBookmark
  )
})

LibraryItemCard.displayName = "LibraryItemCard"

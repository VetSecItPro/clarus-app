"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Play, CheckCircle2, Clock, ChevronDown, ChevronUp, Podcast } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import Link from "next/link"

interface Episode {
  id: string
  episode_title: string
  episode_url: string
  episode_date: string | null
  duration_seconds: number | null
  description: string | null
  content_id: string | null
}

interface EpisodeListProps {
  subscriptionId: string
  podcastName?: string
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function EpisodeList({ subscriptionId }: EpisodeListProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const fetchEpisodes = useCallback(async () => {
    try {
      const response = await fetch(`/api/podcast-subscriptions/${subscriptionId}/episodes?limit=50`)
      const data = await response.json()
      if (response.ok) {
        setEpisodes(data.episodes)
      }
    } catch {
      console.error("Failed to fetch episodes")
    } finally {
      setLoading(false)
    }
  }, [subscriptionId])

  useEffect(() => {
    fetchEpisodes()
  }, [fetchEpisodes])

  const handleAnalyze = async (episode: Episode) => {
    if (confirmingId !== episode.id) {
      setConfirmingId(episode.id)
      return
    }

    setConfirmingId(null)
    setAnalyzingId(episode.id)

    try {
      const response = await fetch(
        `/api/podcast-subscriptions/${subscriptionId}/episodes/${episode.id}/analyze`,
        { method: "POST" }
      )

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? "Failed to start analysis")
        return
      }

      toast.success("Analysis started! Check your library for results.")

      // Update the episode in the list
      setEpisodes((prev) =>
        prev.map((ep) =>
          ep.id === episode.id ? { ...ep, content_id: data.content_id } : ep
        )
      )
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setAnalyzingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6" role="status">
        <Loader2 className="w-5 h-5 animate-spin text-white/50" />
        <span className="sr-only">Loading episodes</span>
      </div>
    )
  }

  if (episodes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Podcast className="w-6 h-6 text-white/30" />
        <p className="text-white/50 text-sm">
          No episodes found yet. Episodes will appear after the next feed check.
        </p>
      </div>
    )
  }

  const visibleEpisodes = expanded ? episodes : episodes.slice(0, 5)

  return (
    <div className="space-y-1">
      <AnimatePresence initial={false}>
        {visibleEpisodes.map((episode, index) => (
          <motion.div
            key={episode.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ delay: index * 0.03 }}
            className="group flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
          >
            {/* Episode info */}
            <div className="flex-1 min-w-0">
              <p className="text-white/90 text-sm font-medium truncate" title={episode.episode_title}>
                {episode.episode_title}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                {episode.episode_date && (
                  <span>{formatDate(episode.episode_date)}</span>
                )}
                {episode.episode_date && episode.duration_seconds && (
                  <span className="text-white/50">·</span>
                )}
                {episode.duration_seconds && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(episode.duration_seconds)}
                  </span>
                )}
              </div>
            </div>

            {/* Action button */}
            <div className="shrink-0 flex items-center">
              {episode.content_id ? (
                <Link
                  href={`/content/${episode.content_id}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                    "hover:bg-emerald-500/20 transition-colors"
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Analyzed
                </Link>
              ) : analyzingId === episode.id ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/20">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyzing...
                </div>
              ) : confirmingId === episode.id ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAnalyze(episode)}
                  onBlur={() => setConfirmingId(null)}
                  className="text-xs h-8 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                >
                  Uses 1 analysis credit. Confirm?
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAnalyze(episode)}
                  className="text-xs h-8 text-white/50 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                >
                  <Play className="w-3.5 h-3.5" />
                  Analyze
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Show more / less */}
      {episodes.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 w-full justify-center py-2 text-xs text-white/50 hover:text-white/60 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Show {episodes.length - 5} more episodes
            </>
          )}
        </button>
      )}
    </div>
  )
}

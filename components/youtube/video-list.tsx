"use client"

import { useEffect, useState, useCallback } from "react"
import { Loader2, Play, ExternalLink, CheckCircle } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

interface Video {
  id: string
  video_title: string
  video_url: string
  video_id: string
  published_date: string | null
  description: string | null
  thumbnail_url: string | null
  content_id: string | null
}

interface VideoListProps {
  subscriptionId: string
  channelName?: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown date"
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function VideoList({ subscriptionId, channelName }: VideoListProps) {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const fetchVideos = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/youtube-subscriptions/${subscriptionId}/videos?limit=50`
      )
      const data = await response.json()
      if (response.ok) {
        setVideos(data.videos)
      }
    } catch {
      toast.error("Failed to load videos")
    } finally {
      setLoading(false)
    }
  }, [subscriptionId])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  const handleAnalyze = async (videoId: string, videoTitle: string) => {
    if (analyzingId) return

    // Two-click confirmation
    if (confirmingId !== videoId) {
      setConfirmingId(videoId)
      return
    }

    setConfirmingId(null)
    setAnalyzingId(videoId)

    try {
      const response = await fetch(
        `/api/youtube-subscriptions/${subscriptionId}/videos/${videoId}/analyze`,
        { method: "POST" }
      )
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? "Failed to start analysis")
        return
      }

      // Update local state
      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId ? { ...v, content_id: data.content_id } : v
        )
      )

      toast.success(`Analyzing: ${videoTitle}`)
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setAnalyzingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-white/40" />
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <p className="text-center text-white/40 text-sm py-6">
        No videos found yet. New videos will appear after the next feed check.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/30 mb-3">
        {videos.length} video{videos.length !== 1 ? "s" : ""}
        {channelName ? ` from ${channelName}` : ""}
      </p>
      <AnimatePresence initial={false}>
        {videos.map((video, index) => (
          <motion.div
            key={video.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="flex items-start gap-3 py-2.5 group"
          >
            {/* Thumbnail */}
            {video.thumbnail_url ? (
              <a
                href={video.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Image
                  src={video.thumbnail_url}
                  alt={video.video_title}
                  width={120}
                  height={68}
                  sizes="120px"
                  className="w-[120px] h-[68px] rounded-lg object-cover"
                  unoptimized
                />
              </a>
            ) : (
              <div className="w-[120px] h-[68px] rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Play className="w-5 h-5 text-white/20" />
              </div>
            )}

            {/* Video info */}
            <div className="flex-1 min-w-0">
              <a
                href={video.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/80 hover:text-white transition-colors line-clamp-2"
              >
                {video.video_title}
              </a>
              <p className="text-xs text-white/30 mt-1">
                {formatDate(video.published_date)}
              </p>
            </div>

            {/* Analyze button or analyzed badge */}
            <div className="shrink-0 flex items-center gap-1.5">
              {video.content_id ? (
                <Link
                  href={`/item/${video.content_id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  View
                </Link>
              ) : (
                <button
                  onClick={() => handleAnalyze(video.id, video.video_title)}
                  disabled={analyzingId === video.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    confirmingId === video.id
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-brand/10 text-brand hover:bg-brand/20"
                  } disabled:opacity-50`}
                >
                  {analyzingId === video.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : confirmingId === video.id ? (
                    "Confirm?"
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Analyze
                    </>
                  )}
                </button>
              )}
              <a
                href={video.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md text-white/20 hover:text-white/50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

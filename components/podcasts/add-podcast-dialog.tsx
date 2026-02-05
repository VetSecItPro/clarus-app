"use client"

import { useState } from "react"
import Image from "next/image"
import { Loader2, Rss, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

interface FeedPreview {
  podcast_name: string
  podcast_image_url: string | null
}

interface AddPodcastDialogProps {
  currentCount: number
  limit: number
  onSubscribed: () => void
}

export function AddPodcastDialog({ currentCount, limit, onSubscribed }: AddPodcastDialogProps) {
  const [open, setOpen] = useState(false)
  const [feedUrl, setFeedUrl] = useState("")
  const [preview, setPreview] = useState<FeedPreview | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const atLimit = currentCount >= limit

  const resetState = () => {
    setFeedUrl("")
    setPreview(null)
    setError(null)
    setIsValidating(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) resetState()
  }

  const handleValidate = async () => {
    if (!feedUrl.trim()) {
      setError("Please enter a feed URL")
      return
    }

    setIsValidating(true)
    setError(null)
    setPreview(null)

    try {
      const response = await fetch("/api/podcast-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feed_url: feedUrl.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Failed to validate feed")
        return
      }

      // The POST actually created the subscription. We're done!
      setPreview({
        podcast_name: data.subscription.podcast_name,
        podcast_image_url: data.subscription.podcast_image_url,
      })

      // Brief delay to show the success state, then close
      setTimeout(() => {
        onSubscribed()
        handleOpenChange(false)
      }, 1200)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="gap-2"
          disabled={atLimit}
        >
          <Rss className="w-4 h-4" />
          Add Podcast
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#111] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Add Podcast Feed</DialogTitle>
          <DialogDescription className="text-white/50">
            Enter the RSS feed URL for the podcast you want to monitor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tier limit warning */}
          {currentCount >= limit - 1 && !atLimit && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>You have {limit - currentCount} subscription{limit - currentCount === 1 ? "" : "s"} remaining on your current plan.</span>
            </div>
          )}

          {/* URL input */}
          <div className="space-y-2">
            <label htmlFor="feed-url" className="text-sm text-white/70">
              RSS Feed URL
            </label>
            <input
              id="feed-url"
              type="url"
              placeholder="https://feeds.example.com/podcast.xml"
              value={feedUrl}
              onChange={(e) => {
                setFeedUrl(e.target.value)
                setError(null)
                setPreview(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isValidating && !preview) {
                  handleValidate()
                }
              }}
              disabled={isValidating || !!preview}
              className={cn(
                "w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder:text-white/30",
                "focus:outline-none focus:ring-2 focus:ring-[#1d9bf0]/50 focus:border-[#1d9bf0]/30",
                "disabled:opacity-50 transition-colors",
                error ? "border-red-500/40" : "border-white/10"
              )}
            />
          </div>

          {/* Error */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success preview */}
          <AnimatePresence mode="wait">
            {preview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              >
                {preview.podcast_image_url ? (
                  <Image
                    src={preview.podcast_image_url}
                    alt={preview.podcast_name}
                    width={56}
                    height={56}
                    sizes="56px"
                    className="w-14 h-14 rounded-lg object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center">
                    <Rss className="w-6 h-6 text-white/40" />
                  </div>
                )}
                <div>
                  <p className="text-white font-medium">{preview.podcast_name}</p>
                  <p className="text-emerald-400 text-sm">Subscribed successfully!</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter>
          {!preview && (
            <Button
              onClick={handleValidate}
              disabled={isValidating || !feedUrl.trim()}
              className="w-full sm:w-auto"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validating Feed...
                </>
              ) : (
                "Subscribe"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

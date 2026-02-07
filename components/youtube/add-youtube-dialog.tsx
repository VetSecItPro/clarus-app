"use client"

import { useState } from "react"
import Image from "next/image"
import { Loader2, Youtube, AlertCircle } from "lucide-react"
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

interface ChannelPreview {
  channel_name: string
  channel_image_url: string | null
}

interface AddYouTubeDialogProps {
  currentCount: number
  limit: number
  onSubscribed: () => void
}

export function AddYouTubeDialog({ currentCount, limit, onSubscribed }: AddYouTubeDialogProps) {
  const [open, setOpen] = useState(false)
  const [channelUrl, setChannelUrl] = useState("")
  const [preview, setPreview] = useState<ChannelPreview | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const atLimit = currentCount >= limit

  const resetState = () => {
    setChannelUrl("")
    setPreview(null)
    setError(null)
    setIsValidating(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) resetState()
  }

  const handleValidate = async () => {
    if (!channelUrl.trim()) {
      setError("Please enter a YouTube URL")
      return
    }

    setIsValidating(true)
    setError(null)
    setPreview(null)

    try {
      const response = await fetch("/api/youtube-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_url: channelUrl.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Failed to resolve YouTube channel")
        return
      }

      setPreview({
        channel_name: data.subscription.channel_name,
        channel_image_url: data.subscription.channel_image_url,
      })

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
          <Youtube className="w-4 h-4" />
          Add Channel
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#111] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Add YouTube Channel</DialogTitle>
          <DialogDescription className="text-white/50">
            Paste any YouTube URL — channel, @handle, or even a video from the channel.
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
            <label htmlFor="channel-url" className="text-sm text-white/70">
              YouTube URL
            </label>
            <input
              id="channel-url"
              type="url"
              placeholder="https://youtube.com/@channelname"
              value={channelUrl}
              onChange={(e) => {
                setChannelUrl(e.target.value)
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
                "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/30",
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
                {preview.channel_image_url ? (
                  <Image
                    src={preview.channel_image_url}
                    alt={preview.channel_name}
                    width={56}
                    height={56}
                    sizes="56px"
                    className="w-14 h-14 rounded-lg object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center">
                    <Youtube className="w-6 h-6 text-white/40" />
                  </div>
                )}
                <div>
                  <p className="text-white font-medium">{preview.channel_name}</p>
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
              disabled={isValidating || !channelUrl.trim()}
              className="w-full sm:w-auto"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resolving Channel...
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

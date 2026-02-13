"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell, BellOff, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useUserTier } from "@/lib/hooks/use-user-tier"
import { useRouter } from "next/navigation"

interface SubscribePromptProps {
  contentType: "youtube" | "podcast"
  contentUrl: string
  /** YouTube channel ID (available on YouTube content items) */
  channelId?: string | null
  /** Author/creator name for display */
  authorName?: string | null
  /** Current user ID for tier checking */
  userId: string
  className?: string
}

type PromptState = "loading" | "subscribed" | "prompt" | "subscribing" | "dismissed" | "error"

const DISMISS_STORAGE_PREFIX = "subscribe-prompt-dismissed:"

export function SubscribePrompt({
  contentType,
  contentUrl,
  channelId,
  authorName,
  userId,
  className = "",
}: SubscribePromptProps) {
  const [state, setState] = useState<PromptState>("loading")
  const { features: tierFeatures } = useUserTier(userId)
  const router = useRouter()

  // Determine the tier feature key
  const featureKey = contentType === "youtube" ? "youtubeSubscriptions" : "podcastSubscriptions"
  const hasFeature = tierFeatures[featureKey]

  // Check dismiss state from localStorage
  const dismissKey = `${DISMISS_STORAGE_PREFIX}${contentType}:${channelId ?? contentUrl}`

  const checkSubscriptionStatus = useCallback(async () => {
    // Check if dismissed this session
    try {
      if (typeof window !== "undefined" && sessionStorage.getItem(dismissKey)) {
        setState("dismissed")
        return
      }
    } catch {
      // sessionStorage may be unavailable
    }

    // For YouTube, we need channelId to check subscription
    if (contentType === "youtube" && !channelId) {
      setState("dismissed") // Can't check without channel ID
      return
    }

    try {
      const params = new URLSearchParams({ type: contentType })
      if (contentType === "youtube" && channelId) {
        params.set("channel_id", channelId)
      } else if (contentType === "podcast") {
        // For podcasts, we need to check by URL — but the subscription uses feed_url,
        // not the content URL. We'll show the prompt optimistically and let the subscribe
        // flow handle resolution.
        setState("prompt")
        return
      }

      const response = await fetch(`/api/subscription-status?${params.toString()}`)
      if (!response.ok) {
        setState("prompt") // Show prompt on error (optimistic)
        return
      }

      const data = await response.json() as { subscribed: boolean; subscriptionId?: string }
      if (data.subscribed) {
        setState("subscribed")

      } else {
        setState("prompt")
      }
    } catch {
      setState("prompt") // Show prompt on network error
    }
  }, [contentType, channelId, dismissKey])

  useEffect(() => {
    checkSubscriptionStatus()
  }, [checkSubscriptionStatus])

  const handleSubscribe = async () => {
    if (!hasFeature) {
      toast.info("Feed subscriptions require a Starter plan or higher.", {
        action: { label: "View plans", onClick: () => router.push("/pricing") },
      })
      return
    }

    setState("subscribing")

    try {
      if (contentType === "youtube") {
        // Subscribe to YouTube channel directly
        const response = await fetch("/api/youtube-subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel_url: contentUrl }),
        })

        if (!response.ok) {
          const data = await response.json() as { error?: string }
          if (response.status === 403) {
            toast.error(data.error ?? "Subscription limit reached")
            setState("prompt")
            return
          }
          throw new Error(data.error ?? "Failed to subscribe")
        }

        setState("subscribed")
        toast.success("Subscribed! You'll see new videos in your Feeds tab.")
      } else {
        // For podcasts, first resolve the feed URL
        const resolveResponse = await fetch("/api/resolve-podcast-feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: contentUrl }),
        })

        if (!resolveResponse.ok) {
          const data = await resolveResponse.json() as { error?: string }
          throw new Error(data.error ?? "Could not find RSS feed for this podcast")
        }

        const feedInfo = await resolveResponse.json() as {
          feedUrl: string
          podcastName: string
          podcastImageUrl: string | null
        }

        // Now subscribe using the resolved feed URL
        const subResponse = await fetch("/api/podcast-subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feed_url: feedInfo.feedUrl }),
        })

        if (!subResponse.ok) {
          const data = await subResponse.json() as { error?: string }
          if (subResponse.status === 403) {
            toast.error(data.error ?? "Subscription limit reached")
            setState("prompt")
            return
          }
          throw new Error(data.error ?? "Failed to subscribe")
        }

        setState("subscribed")
        toast.success("Subscribed! You'll see new episodes in your Feeds tab.")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      // Check for "already subscribed" pattern
      if (message.toLowerCase().includes("already subscribed")) {
        setState("subscribed")
        toast.info("You're already subscribed to this feed.")
        return
      }
      toast.error(message)
      setState("error")
    }
  }

  const handleDismiss = () => {
    setState("dismissed")
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(dismissKey, "1")
      }
    } catch {
      // sessionStorage may be unavailable
    }
  }

  // Don't render in loading, dismissed, or error states
  if (state === "loading" || state === "dismissed") return null

  // Subscribed state: subtle badge
  if (state === "subscribed") {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 ${className}`}>
        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-xs text-emerald-300">
          Subscribed to {contentType === "youtube" ? "channel" : "podcast"}
        </span>
      </div>
    )
  }

  // Error state with retry
  if (state === "error") {
    return (
      <div className={`p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] ${className}`}>
        <div className="flex items-start gap-3">
          <BellOff className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">Could not set up subscription.</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSubscribe}
                className="px-3 py-1 text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.12] rounded-lg transition-colors cursor-pointer"
              >
                Retry
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-400 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Subscribe prompt
  const creatorLabel = authorName ?? (contentType === "youtube" ? "this channel" : "this podcast")

  return (
    <div className={`p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] ${className}`}>
      <div className="flex items-start gap-3">
        <Bell className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-tight">
            Subscribe to {creatorLabel}?
          </p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Get notified when new {contentType === "youtube" ? "videos" : "episodes"} drop.
            You choose what to analyze.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSubscribe}
              disabled={state === "subscribing"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
            >
              {state === "subscribing" ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Subscribing...
                </>
              ) : (
                <>
                  <Bell className="w-3 h-3" />
                  Subscribe
                </>
              )}
            </button>
            <button
              onClick={handleDismiss}
              disabled={state === "subscribing"}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

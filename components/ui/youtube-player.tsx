"use client"

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react"
import { cn } from "@/lib/utils"

interface YouTubePlayerProps {
  videoId: string
  className?: string
}

export interface YouTubePlayerRef {
  seekTo: (seconds: number) => void
  play: () => void
  pause: () => void
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  ({ videoId, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<any>(null)
    const playerIdRef = useRef(`youtube-player-${Math.random().toString(36).substr(2, 9)}`)

    const initPlayer = useCallback(() => {
      if (!containerRef.current || !window.YT?.Player) return

      playerRef.current = new window.YT.Player(playerIdRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1, // Important for iOS - plays inline instead of fullscreen
          fs: 1, // Allow fullscreen
          cc_load_policy: 0, // Don't force captions
          iv_load_policy: 3, // Hide video annotations
          origin: typeof window !== "undefined" ? window.location.origin : "",
        },
        events: {
          onReady: () => {
            // Player is ready
          },
        },
      })
    }, [videoId])

    useEffect(() => {
      // Load YouTube IFrame API
      if (!window.YT) {
        const tag = document.createElement("script")
        tag.src = "https://www.youtube.com/iframe_api"
        const firstScriptTag = document.getElementsByTagName("script")[0]
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

        window.onYouTubeIframeAPIReady = initPlayer
      } else {
        initPlayer()
      }

      return () => {
        if (playerRef.current?.destroy) {
          playerRef.current.destroy()
        }
      }
    }, [initPlayer])

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (playerRef.current?.seekTo) {
          playerRef.current.seekTo(seconds, true)
          playerRef.current.playVideo()
        }
      },
      play: () => {
        if (playerRef.current?.playVideo) {
          playerRef.current.playVideo()
        }
      },
      pause: () => {
        if (playerRef.current?.pauseVideo) {
          playerRef.current.pauseVideo()
        }
      },
    }))

    return (
      <div className={cn("relative w-full", className)}>
        {/* Container with proper aspect ratio for mobile */}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden bg-black"
          style={{ paddingBottom: "56.25%" }} // 16:9 aspect ratio
        >
          <div
            id={playerIdRef.current}
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </div>
    )
  }
)

YouTubePlayer.displayName = "YouTubePlayer"

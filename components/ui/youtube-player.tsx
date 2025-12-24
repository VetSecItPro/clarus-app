"use client"

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react"

interface YouTubePlayerProps {
  videoId: string
  className?: string
}

export interface YouTubePlayerRef {
  seekTo: (seconds: number) => void
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
    }))

    return (
      <div className={className}>
        <div ref={containerRef}>
          <div id={playerIdRef.current} className="w-full aspect-video" />
        </div>
      </div>
    )
  }
)

YouTubePlayer.displayName = "YouTubePlayer"

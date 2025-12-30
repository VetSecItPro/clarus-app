"use client"

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react"
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
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const playerRef = useRef<any>(null)
    const [useSimpleEmbed, setUseSimpleEmbed] = useState(false)

    // Detect mobile devices and Safari for simple embed fallback
    // Direct iframe works more reliably than IFrame API on mobile
    useEffect(() => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
      const isAndroid = /Android/.test(navigator.userAgent)
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      const isMobile = isIOS || isAndroid || /webOS|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent)

      if (isMobile || isSafari) {
        setUseSimpleEmbed(true)
      }
    }, [])

    const initPlayer = useCallback(() => {
      if (useSimpleEmbed || !window.YT?.Player || !iframeRef.current) return

      // For non-iOS, use the IFrame API for better control
      playerRef.current = new window.YT.Player(iframeRef.current, {
        events: {
          onReady: () => {
            // Player is ready
          },
        },
      })
    }, [useSimpleEmbed])

    useEffect(() => {
      if (useSimpleEmbed) return // Skip API loading for simple embed

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
    }, [initPlayer, useSimpleEmbed])

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (playerRef.current?.seekTo) {
          playerRef.current.seekTo(seconds, true)
          playerRef.current.playVideo()
        } else if (iframeRef.current) {
          // Fallback: reload iframe with timestamp
          const src = iframeRef.current.src.split('?')[0]
          iframeRef.current.src = `${src}?start=${Math.floor(seconds)}&autoplay=1&playsinline=1&rel=0&modestbranding=1`
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

    // Build the embed URL with iOS-friendly parameters
    const embedUrl = `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : ""}`

    return (
      <div className={cn("relative w-full", className)}>
        {/* Container with proper aspect ratio */}
        <div className="relative w-full overflow-hidden bg-black aspect-video">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
            style={{
              // iOS Safari rendering fixes
              WebkitTransform: 'translate3d(0,0,0)',
              transform: 'translate3d(0,0,0)',
            }}
          />
        </div>
      </div>
    )
  }
)

YouTubePlayer.displayName = "YouTubePlayer"

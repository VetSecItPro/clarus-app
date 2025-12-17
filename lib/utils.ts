import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || typeof seconds === "undefined") {
    return "N/A"
  }
  if (seconds === 0) {
    return "0:00"
  }

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  const hDisplay = h > 0 ? `${h}:` : ""
  const mDisplay = h > 0 ? String(m).padStart(2, "0") : String(m)
  const sDisplay = String(s).padStart(2, "0")

  return `${hDisplay}${mDisplay}:${sDisplay}`
}

export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null
  let videoId = null
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname === "youtu.be") {
      // Handles URLs like youtu.be/VIDEO_ID
      videoId = urlObj.pathname.slice(1)
    } else if (urlObj.hostname.includes("youtube.com")) {
      if (urlObj.pathname.startsWith("/shorts/")) {
        // Handles URLs like youtube.com/shorts/VIDEO_ID
        videoId = urlObj.pathname.split("/")[2]
      } else {
        // Handles URLs like youtube.com/watch?v=VIDEO_ID
        videoId = urlObj.searchParams.get("v")
      }
    }
  } catch (error) {
    // It's okay if parsing fails, it's just not a valid URL for this check
    return null
  }
  return videoId
}

export function isPdfUrl(url: string): boolean {
  if (!url) return false
  try {
    const path = new URL(url).pathname
    return path.toLowerCase().endsWith(".pdf")
  } catch (error) {
    // Invalid URL, so it can't be a PDF URL
    return false
  }
}

export function isXUrl(url: string): boolean {
  if (!url) return false
  try {
    const hostname = new URL(url).hostname
    return hostname === "x.com" || hostname === "twitter.com"
  } catch (error) {
    return false
  }
}

export function getDomainFromUrl(url: string | null): string {
  if (!url) return "unknown.com"
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch (e) {
    return "unknown.com"
  }
}

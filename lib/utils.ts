/**
 * @module utils
 * @description General-purpose utility functions used across the application.
 *
 * Includes Tailwind class merging, media duration formatting, URL type
 * detection (YouTube, podcast, PDF, X/Twitter), domain extraction, and
 * URL normalization for cross-user content cache matching.
 */

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges Tailwind CSS classes with intelligent conflict resolution.
 *
 * Combines `clsx` (conditional class joining) with `tailwind-merge`
 * (deduplication of conflicting Tailwind utilities like `p-2 p-4`).
 *
 * @param inputs - Class values, arrays, or conditional objects
 * @returns A single merged class string
 *
 * @example
 * ```ts
 * cn("px-2 py-1", isActive && "bg-blue-500", "px-4")
 * // "py-1 bg-blue-500 px-4" (px-2 is superseded by px-4)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a duration in seconds to a human-readable `H:MM:SS` or `M:SS` string.
 *
 * Used for displaying podcast and video durations in the UI.
 *
 * @param seconds - Duration in seconds, or null/undefined
 * @returns Formatted string like `"1:23:45"`, `"5:30"`, or `"N/A"` for null input
 *
 * @example
 * ```ts
 * formatDuration(5400)     // "1:30:00"
 * formatDuration(90)       // "1:30"
 * formatDuration(null)     // "N/A"
 * ```
 */
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

/**
 * Extracts the video ID from a YouTube URL.
 *
 * Supports standard watch URLs, short `youtu.be` links, and
 * `/shorts/` URLs.
 *
 * @param url - A YouTube URL string
 * @returns The video ID string, or `null` if the URL is not a recognized YouTube format
 *
 * @example
 * ```ts
 * getYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ") // "dQw4w9WgXcQ"
 * getYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")                // "dQw4w9WgXcQ"
 * getYouTubeVideoId("https://example.com")                          // null
 * ```
 */
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
  } catch {
    // It's okay if parsing fails, it's just not a valid URL for this check
    return null
  }
  return videoId
}

/**
 * Checks whether a URL points to a PDF document based on its file extension.
 *
 * @param url - The URL to check
 * @returns `true` if the URL pathname ends with `.pdf`
 */
export function isPdfUrl(url: string): boolean {
  if (!url) return false
  try {
    const path = new URL(url).pathname
    return path.toLowerCase().endsWith(".pdf")
  } catch {
    // Invalid URL, so it can't be a PDF URL
    return false
  }
}

/**
 * Checks whether a URL belongs to X (formerly Twitter).
 *
 * @param url - The URL to check
 * @returns `true` if the hostname is `x.com` or `twitter.com`
 */
export function isXUrl(url: string): boolean {
  if (!url) return false
  try {
    const hostname = new URL(url).hostname
    return hostname === "x.com" || hostname === "twitter.com"
  } catch {
    return false
  }
}

/** Audio file extensions that indicate a direct podcast/audio URL */
const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac"]

/** Podcast hosting platforms that may expose direct audio URLs */
const PODCAST_HOSTNAMES = [
  "anchor.fm",
  "podbean.com",
  "buzzsprout.com",
  "transistor.fm",
  "simplecast.com",
  "libsyn.com",
  "overcast.fm",
  "pocketcasts.com",
  "podcasts.apple.com",
]

/**
 * Detects whether a URL points to podcast or audio content.
 *
 * Matches direct audio file links (by extension), Spotify episode URLs,
 * and known podcast hosting platforms. Used to route content through the
 * AssemblyAI transcription pipeline instead of the article scraper.
 *
 * @param url - The URL to check
 * @returns `true` if the URL is recognized as audio/podcast content
 *
 * @see {@link lib/assemblyai.ts} for the transcription pipeline
 */
export function isPodcastUrl(url: string): boolean {
  if (!url) return false
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()
    const hostname = urlObj.hostname.toLowerCase()

    // Direct audio file links
    if (AUDIO_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
      return true
    }

    // Spotify episode URLs (open.spotify.com/episode/*)
    if (hostname === "open.spotify.com" && pathname.startsWith("/episode/")) {
      return true
    }

    // Known podcast hosting platforms
    return PODCAST_HOSTNAMES.some(
      (h) => hostname === h || hostname.endsWith(`.${h}`)
    )
  } catch {
    return false
  }
}

/**
 * Extracts the domain name from a URL, stripping the `www.` prefix.
 *
 * Returns `"unknown.com"` for null or unparseable URLs.
 *
 * @param url - The URL to extract the domain from, or null
 * @returns The bare domain string (e.g., `"nytimes.com"`)
 */
export function getDomainFromUrl(url: string | null): string {
  if (!url) return "unknown.com"
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch {
    return "unknown.com"
  }
}

/**
 * Tracking and analytics query parameters to strip for URL normalization.
 * These do not change the content at the URL -- only track how the user arrived.
 */
const TRACKING_PARAMS = new Set([
  // UTM parameters
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  // Platform click IDs
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "twclid",
  "li_fat_id",
  // Email / newsletter trackers
  "mc_cid",
  "mc_eid",
  // Analytics & referral
  "ref",
  "source",
  "_ga",
  "_gl",
  "_hsenc",
  "_hsmi",
  // Misc trackers
  "yclid",
  "wickedid",
  "igshid",
  "s_kwcid",
  "si",
])

/**
 * Normalizes a URL for cross-user content cache matching.
 *
 * Two URLs that point to the same content should produce the same
 * normalized string, even if one has tracking parameters, a `www.`
 * prefix, mixed-case hostname, or a trailing slash. This enables
 * content deduplication so that re-analyzing the same article skips
 * the scraping step.
 *
 * Transformations applied:
 * 1. Lowercase hostname and strip `www.` prefix
 * 2. Remove trailing slash (except root `/`)
 * 3. Delete known tracking/analytics query parameters
 * 4. Sort remaining query parameters alphabetically
 * 5. Remove URL hash fragment
 *
 * Returns the original string unchanged for non-HTTP schemes (e.g.,
 * `pdf://` used for uploaded PDFs) or unparseable strings.
 *
 * @param raw - The raw URL string to normalize
 * @returns The normalized URL string
 *
 * @example
 * ```ts
 * normalizeUrl("https://WWW.Example.com/article/?utm_source=twitter&ref=home")
 * // "https://example.com/article"
 * ```
 */
export function normalizeUrl(raw: string): string {
  if (!raw) return raw

  // Don't normalize internal scheme URLs (pdf://, etc.)
  if (raw.startsWith("pdf://")) return raw

  let urlObj: URL
  try {
    urlObj = new URL(raw)
  } catch {
    // Not a valid URL — return as-is
    return raw
  }

  // Lowercase the hostname and strip www. prefix
  urlObj.hostname = urlObj.hostname.toLowerCase().replace(/^www\./, "")

  // Remove trailing slash from pathname (but keep "/" for root)
  if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith("/")) {
    urlObj.pathname = urlObj.pathname.slice(0, -1)
  }

  // Strip tracking parameters
  for (const param of TRACKING_PARAMS) {
    urlObj.searchParams.delete(param)
  }

  // Sort remaining query parameters alphabetically for consistent ordering
  urlObj.searchParams.sort()

  // Remove hash fragment (doesn't affect server-side content)
  urlObj.hash = ""

  // If all query params were stripped, remove the trailing "?"
  // URL.toString() handles this automatically, but let's be explicit
  return urlObj.toString()
}

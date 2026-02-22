/**
 * @module deepgram
 * @description Deepgram Nova-3 integration for podcast transcription with speaker diarization.
 *
 * Implements a two-phase pipeline:
 * 1. **Submit** -- POST the audio URL to Deepgram with webhook callback
 * 2. **Webhook** -- Receive the completed transcript, format with speaker labels
 *
 * Speaker diarization is enabled by default to attribute statements to
 * individual speakers, which is critical for accurate claim attribution
 * in the analysis pipeline.
 *
 * @see {@link lib/utils.ts} isPodcastUrl for URL detection that routes to this pipeline
 * @see {@link lib/api-usage.ts} for cost tracking (billed per second of audio)
 */

import { logger } from "@/lib/logger"
import { fetchAndParseFeed, type PodcastEpisode } from "@/lib/rss-parser"
import { ProcessContentError } from "@/lib/pipeline/types"

const DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"

/** Audio file extensions recognized as direct audio URLs (no resolution needed). */
const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac", ".opus", ".wma"]

/** Total time budget for the entire resolveAudioUrl() waterfall. */
const RESOLVE_TIMEOUT_MS = 30_000

/** Per-resolver network request timeout. */
const RESOLVER_FETCH_TIMEOUT_MS = 10_000

// ============================================
// HELPERS
// ============================================

/**
 * Fetch with AbortController timeout and one retry on transient 5xx errors.
 * Does NOT retry timeouts — only server errors with a 2s backoff.
 */
async function fetchWithTimeout(
  input: string,
  init?: RequestInit & { timeout?: number },
): Promise<Response> {
  const timeoutMs = init?.timeout ?? RESOLVER_FETCH_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const doFetch = () =>
    fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "Clarus/1.0 (Podcast Audio Resolver)",
        ...init?.headers,
      },
    })

  try {
    let response = await doFetch()
    if (response.status >= 500 && response.status < 600) {
      // One retry after 2s for transient server errors
      await new Promise((r) => setTimeout(r, 2000))
      response = await doFetch()
    }
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// ── RSS feed cache (module-level, 1hr TTL, 50-entry FIFO) ──

interface CachedFeed {
  episodes: PodcastEpisode[]
  feedTitle: string
  fetchedAt: number
}

const rssFeedCache = new Map<string, CachedFeed>()
const RSS_CACHE_TTL_MS = 3600_000 // 1 hour
const RSS_CACHE_MAX = 50

async function fetchFeedCached(feedUrl: string): Promise<CachedFeed> {
  const cached = rssFeedCache.get(feedUrl)
  if (cached && Date.now() - cached.fetchedAt < RSS_CACHE_TTL_MS) {
    return cached
  }

  const parsed = await fetchAndParseFeed(feedUrl)
  const entry: CachedFeed = {
    episodes: parsed.episodes,
    feedTitle: parsed.feed.title,
    fetchedAt: Date.now(),
  }

  // FIFO eviction
  if (rssFeedCache.size >= RSS_CACHE_MAX) {
    const firstKey = rssFeedCache.keys().next().value
    if (firstKey !== undefined) rssFeedCache.delete(firstKey)
  }
  rssFeedCache.set(feedUrl, entry)
  return entry
}

// ── Episode matching (fuzzy scoring) ──

/** Normalize text for fuzzy comparison: lowercase, strip punctuation, collapse whitespace. */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Fuzzy-match an episode from an RSS feed using title similarity, date, and duration.
 *
 * Scoring:
 * - Exact normalized title match: +100
 * - Substring match (either direction): +60
 * - Word overlap (Jaccard-like): up to +50
 * - Date within 24h: +20
 * - Duration within 60s: +15
 * - Minimum threshold: 30 points
 */
function matchEpisode(
  episodes: PodcastEpisode[],
  opts: { title?: string; date?: Date; durationSeconds?: number },
): PodcastEpisode | null {
  if (episodes.length === 0) return null

  const normTitle = opts.title ? normalizeForMatch(opts.title) : ""
  let bestScore = 0
  let bestEp: PodcastEpisode | null = null

  for (const ep of episodes) {
    let score = 0
    const epNorm = normalizeForMatch(ep.title)

    // Title scoring
    if (normTitle && epNorm) {
      if (epNorm === normTitle) {
        score += 100
      } else if (epNorm.includes(normTitle) || normTitle.includes(epNorm)) {
        score += 60
      } else {
        // Word overlap
        const queryWords = new Set(normTitle.split(" "))
        const epWords = new Set(epNorm.split(" "))
        const intersection = [...queryWords].filter((w) => epWords.has(w)).length
        const union = new Set([...queryWords, ...epWords]).size
        if (union > 0) {
          score += Math.round((intersection / union) * 50)
        }
      }
    }

    // Date proximity (within 24h)
    if (opts.date && ep.pubDate) {
      const diffMs = Math.abs(opts.date.getTime() - ep.pubDate.getTime())
      if (diffMs < 86_400_000) score += 20
    }

    // Duration proximity (within 60s)
    if (opts.durationSeconds != null && ep.durationSeconds != null) {
      if (Math.abs(opts.durationSeconds - ep.durationSeconds) <= 60) score += 15
    }

    if (score > bestScore) {
      bestScore = score
      bestEp = ep
    }
  }

  return bestScore >= 30 ? bestEp : null
}

// ============================================
// AUDIO RESOLVERS (waterfall order)
// ============================================

interface AudioResolver {
  name: string
  canHandle: (url: URL) => boolean
  resolve: (url: URL, originalUrl: string) => Promise<string | null>
}

/** 1. Buzzsprout: /POD_ID/episodes/EP_ID → /POD_ID/EP_ID.mp3 (no network) */
const buzzsproutResolver: AudioResolver = {
  name: "buzzsprout",
  canHandle: (url) => url.hostname.includes("buzzsprout.com"),
  resolve: async (url) => {
    const m = url.pathname.match(/^\/(\d+)\/episodes\/(\d+)/)
    if (m) return `https://www.buzzsprout.com/${m[1]}/${m[2]}.mp3`
    if (/^\/\d+\/\d+\.mp3$/.test(url.pathname)) return url.href
    return null
  },
}

/** 2. Transistor: /episodes/slug → share.transistor.fm/s/slug.mp3 (no network) */
const transistorResolver: AudioResolver = {
  name: "transistor",
  canHandle: (url) => url.hostname.includes("transistor.fm"),
  resolve: async (url) => {
    const m = url.pathname.match(/^\/episodes\/(.+?)(?:\/|$)/)
    if (m) return `https://share.transistor.fm/s/${m[1]}.mp3`
    return null
  },
}

/** 3. Apple Podcasts: iTunes Lookup API → RSS feed → episode match → enclosure URL */
const applePodcastsResolver: AudioResolver = {
  name: "apple-podcasts",
  canHandle: (url) => url.hostname === "podcasts.apple.com",
  resolve: async (url) => {
    // Extract podcast ID from URL: /podcast/name/id123456789
    const idMatch = url.pathname.match(/\/id(\d+)/)
    if (!idMatch) return null
    const podcastId = idMatch[1]

    // Extract episode name from URL for matching (e.g., /podcast/name/episode-slug/id...)
    // Apple URLs look like: /us/podcast/show-name/id123?i=456
    // The `i` param is the episode ID
    const episodeParam = url.searchParams.get("i")

    try {
      // Step 1: iTunes Lookup API → get feedUrl
      const lookupUrl = `https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`
      const lookupResp = await fetchWithTimeout(lookupUrl)
      if (!lookupResp.ok) return null

      const lookupData = await lookupResp.json()
      const feedUrl = lookupData?.results?.[0]?.feedUrl
      if (!feedUrl) return null

      // Step 2: Fetch and parse the RSS feed
      const feed = await fetchFeedCached(feedUrl)
      if (feed.episodes.length === 0) return null

      // Step 3: If we have an episode param, try to match; otherwise return latest
      if (episodeParam) {
        // Apple episode IDs aren't in RSS — we need to match by title
        // Try a secondary lookup for the specific episode
        const epLookupUrl = `https://itunes.apple.com/lookup?id=${episodeParam}&entity=podcastEpisode`
        const epResp = await fetchWithTimeout(epLookupUrl)
        if (epResp.ok) {
          const epData = await epResp.json()
          const epInfo = epData?.results?.[0]
          if (epInfo?.trackName) {
            const matched = matchEpisode(feed.episodes, {
              title: epInfo.trackName,
              date: epInfo.releaseDate ? new Date(epInfo.releaseDate) : undefined,
              durationSeconds: epInfo.trackTimeMillis
                ? Math.round(epInfo.trackTimeMillis / 1000)
                : undefined,
            })
            if (matched) return matched.url
          }
        }
      }

      // Fallback: return the most recent episode's audio URL
      return feed.episodes[0]?.url ?? null
    } catch (err) {
      logger.warn(`[apple-podcasts] Resolution failed: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  },
}

/** 4. Overcast: scrape HTML for <audio> or <source> tag */
const overcastResolver: AudioResolver = {
  name: "overcast",
  canHandle: (url) => url.hostname === "overcast.fm",
  resolve: async (_url, originalUrl) => {
    try {
      const resp = await fetchWithTimeout(originalUrl)
      if (!resp.ok) return null
      const html = await resp.text()

      // Look for <audio src="..."> or <source src="...">
      const audioMatch =
        html.match(/<audio[^>]+src=["']([^"']+)["']/i) ??
        html.match(/<source[^>]+src=["']([^"']+)["']/i)
      if (audioMatch) {
        const src = audioMatch[1]
        // Resolve relative URLs
        return src.startsWith("http") ? src : new URL(src, originalUrl).href
      }
      return null
    } catch {
      return null
    }
  },
}

/** 5. Pocket Casts: scrape HTML for audio source or JSON audioUrl */
const pocketCastsResolver: AudioResolver = {
  name: "pocket-casts",
  canHandle: (url) =>
    url.hostname === "pocketcasts.com" ||
    url.hostname === "www.pocketcasts.com" ||
    url.hostname === "pca.st",
  resolve: async (_url, originalUrl) => {
    try {
      const resp = await fetchWithTimeout(originalUrl)
      if (!resp.ok) return null
      const html = await resp.text()

      // Check for <audio src="...">
      const audioMatch =
        html.match(/<audio[^>]+src=["']([^"']+)["']/i) ??
        html.match(/<source[^>]+src=["']([^"']+)["']/i)
      if (audioMatch) {
        const src = audioMatch[1]
        return src.startsWith("http") ? src : new URL(src, originalUrl).href
      }

      // Check for "audioUrl":"..." in embedded JSON
      const jsonMatch = html.match(/"audioUrl"\s*:\s*"([^"]+)"/i)
      if (jsonMatch) return jsonMatch[1]

      return null
    } catch {
      return null
    }
  },
}

/** 6. Spotify: try to find show via iTunes, then match episode from RSS */
const spotifyResolver: AudioResolver = {
  name: "spotify",
  canHandle: (url) => url.hostname === "open.spotify.com",
  resolve: async (url) => {
    if (!url.pathname.startsWith("/episode/")) return null

    try {
      // Try scraping the embed page for show name
      const episodeId = url.pathname.split("/")[2]
      const embedUrl = `https://open.spotify.com/embed/episode/${episodeId}`
      const embedResp = await fetchWithTimeout(embedUrl)

      let showName: string | null = null
      let episodeTitle: string | null = null

      if (embedResp.ok) {
        const html = await embedResp.text()
        // Look for show name and episode title in meta tags or JSON-LD
        const showMatch =
          html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i) ??
          html.match(/"show"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i)
        if (showMatch) showName = showMatch[1]

        const titleMatch =
          html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ??
          html.match(/"name"\s*:\s*"([^"]+)"/i)
        if (titleMatch) episodeTitle = titleMatch[1]
      }

      if (!showName) {
        // Try the regular page
        const pageResp = await fetchWithTimeout(url.href)
        if (pageResp.ok) {
          const html = await pageResp.text()
          const titleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
          if (titleMatch) episodeTitle = titleMatch[1]
          const descMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)
          if (descMatch && !showName) {
            // Description often contains show name
            showName = descMatch[1].split(" · ")[0]?.trim() || null
          }
        }
      }

      if (!showName && !episodeTitle) {
        throw new ProcessContentError(
          "This is a Spotify link. Spotify doesn't share audio files publicly. Try finding this podcast on Apple Podcasts or paste its RSS feed URL instead.",
          200,
        )
      }

      // Search iTunes for the podcast
      const searchQuery = encodeURIComponent(showName || episodeTitle || "")
      const searchUrl = `https://itunes.apple.com/search?term=${searchQuery}&entity=podcast&limit=5`
      const searchResp = await fetchWithTimeout(searchUrl)
      if (!searchResp.ok) {
        throw new ProcessContentError(
          `We found '${showName || episodeTitle}' on Spotify but couldn't locate its RSS feed. Try pasting an Apple Podcasts link or the direct RSS feed URL.`,
          200,
        )
      }

      const searchData = await searchResp.json()
      const results = searchData?.results as Array<{ feedUrl?: string; collectionName?: string }> | undefined
      if (!results || results.length === 0) {
        throw new ProcessContentError(
          `We found '${showName || episodeTitle}' on Spotify but couldn't locate its RSS feed. Try pasting an Apple Podcasts link or the direct RSS feed URL.`,
          200,
        )
      }

      // Try each matching podcast's RSS feed
      for (const result of results) {
        if (!result.feedUrl) continue
        try {
          const feed = await fetchFeedCached(result.feedUrl)
          if (episodeTitle) {
            const matched = matchEpisode(feed.episodes, { title: episodeTitle })
            if (matched) return matched.url
          }
          // If no episode title, return the latest episode
          if (feed.episodes.length > 0) return feed.episodes[0].url
        } catch {
          continue
        }
      }

      throw new ProcessContentError(
        `We found '${showName || episodeTitle}' on Spotify but couldn't locate its RSS feed. Try pasting an Apple Podcasts link or the direct RSS feed URL.`,
        200,
      )
    } catch (err) {
      if (err instanceof ProcessContentError) throw err
      logger.warn(`[spotify] Resolution failed: ${err instanceof Error ? err.message : String(err)}`)
      throw new ProcessContentError(
        "This is a Spotify link. Spotify doesn't share audio files publicly. Try finding this podcast on Apple Podcasts or paste its RSS feed URL instead.",
        200,
      )
    }
  },
}

/** Known podcast hosting platforms where we can scrape for <audio> or RSS <link>. */
const KNOWN_PODCAST_HOSTS = [
  "podbean.com",
  "libsyn.com",
  "simplecast.com",
  "anchor.fm",
  "megaphone.fm",
  "acast.com",
  "spreaker.com",
  "captivate.fm",
  "redcircle.com",
]

/** 7. Known podcast host: scrape page for <audio> or RSS <link> → parse feed → match */
const knownHostRssResolver: AudioResolver = {
  name: "known-host-rss",
  canHandle: (url) => {
    const hostname = url.hostname.toLowerCase()
    return KNOWN_PODCAST_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`))
  },
  resolve: async (_url, originalUrl) => {
    try {
      const resp = await fetchWithTimeout(originalUrl)
      if (!resp.ok) return null
      const html = await resp.text()

      // Check for <audio> tag first (fastest path)
      const audioMatch =
        html.match(/<audio[^>]+src=["']([^"']+)["']/i) ??
        html.match(/<source[^>]+src=["']([^"']+\.(?:mp3|m4a|ogg|wav|aac))[^"']*["']/i)
      if (audioMatch) {
        const src = audioMatch[1]
        return src.startsWith("http") ? src : new URL(src, originalUrl).href
      }

      // Look for RSS <link> in <head>
      const rssMatch = html.match(
        /<link[^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/i,
      )
      if (rssMatch) {
        const feedUrl = rssMatch[1].startsWith("http")
          ? rssMatch[1]
          : new URL(rssMatch[1], originalUrl).href
        try {
          const feed = await fetchFeedCached(feedUrl)
          // Try to extract episode title from page for matching
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
          const pageTitle = titleMatch ? titleMatch[1].trim() : ""
          const matched = matchEpisode(feed.episodes, { title: pageTitle })
          if (matched) return matched.url
          // Fallback: latest episode
          if (feed.episodes.length > 0) return feed.episodes[0].url
        } catch {
          // RSS fetch failed, fall through
        }
      }

      return null
    } catch {
      return null
    }
  },
}

/** 8. Generic webpage: fetch and check for <audio> element or audio Content-Type */
const genericWebpageResolver: AudioResolver = {
  name: "generic-webpage",
  canHandle: () => true,
  resolve: async (_url, originalUrl) => {
    try {
      const resp = await fetchWithTimeout(originalUrl, { redirect: "follow" })

      // If the final URL has an audio content-type, we followed a redirect to audio
      const contentType = resp.headers.get("content-type") || ""
      if (contentType.startsWith("audio/") || contentType === "application/octet-stream") {
        return resp.url
      }

      // If it's HTML, look for <audio> tags
      if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
        const html = await resp.text()
        const audioMatch =
          html.match(/<audio[^>]+src=["']([^"']+)["']/i) ??
          html.match(/<source[^>]+src=["']([^"']+\.(?:mp3|m4a|ogg|wav|aac))[^"']*["']/i)
        if (audioMatch) {
          const src = audioMatch[1]
          return src.startsWith("http") ? src : new URL(src, originalUrl).href
        }
      }

      return null
    } catch {
      return null
    }
  },
}

/** 9. HEAD request: follow redirects and check Content-Type for audio/* */
const headRequestResolver: AudioResolver = {
  name: "head-request",
  canHandle: () => true,
  resolve: async (_url, originalUrl) => {
    try {
      const resp = await fetchWithTimeout(originalUrl, {
        method: "HEAD",
        redirect: "follow",
      })

      const contentType = resp.headers.get("content-type") || ""
      if (contentType.startsWith("audio/") || contentType === "application/octet-stream") {
        return resp.url
      }
      return null
    } catch {
      return null
    }
  },
}

/** Ordered list of resolvers — tried in sequence (waterfall pattern). */
const AUDIO_RESOLVERS: AudioResolver[] = [
  buzzsproutResolver,
  transistorResolver,
  applePodcastsResolver,
  overcastResolver,
  pocketCastsResolver,
  spotifyResolver,
  knownHostRssResolver,
  genericWebpageResolver,
  headRequestResolver,
]

/**
 * Resolves a podcast URL to a direct audio file URL that Deepgram can fetch.
 *
 * Uses a multi-strategy waterfall: platform-specific transformers (no network),
 * RSS feed lookups via iTunes API, HTML scraping for <audio> tags, and HEAD
 * requests as a final fallback. Throws ProcessContentError with an actionable
 * user message if all strategies fail.
 *
 * @param url - The podcast episode URL (may be a page URL or direct audio)
 * @returns The resolved direct audio URL
 * @throws ProcessContentError if the URL is invalid or no audio can be found
 */
export async function resolveAudioUrl(url: string): Promise<string> {
  // Validate URL
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new ProcessContentError(
      "The podcast URL is not valid. Please check the link and try again.",
      200,
    )
  }

  // Fast path: already a direct audio URL
  const pathLower = parsed.pathname.toLowerCase()
  if (AUDIO_EXTENSIONS.some((ext) => pathLower.endsWith(ext))) {
    logger.info(`[resolveAudioUrl] Already a direct audio URL: ${url}`)
    return url
  }

  // Waterfall through resolvers with total timeout
  const deadline = Date.now() + RESOLVE_TIMEOUT_MS

  for (const resolver of AUDIO_RESOLVERS) {
    if (Date.now() >= deadline) {
      logger.warn(`[resolveAudioUrl] Total timeout reached after ${RESOLVE_TIMEOUT_MS / 1000}s`)
      break
    }

    if (!resolver.canHandle(parsed)) continue

    try {
      logger.info(`[resolveAudioUrl] Trying ${resolver.name} for: ${url}`)
      const result = await resolver.resolve(parsed, url)
      if (result) {
        logger.info(`[resolveAudioUrl] ${resolver.name} resolved: ${url} → ${result}`)
        return result
      }
      logger.info(`[resolveAudioUrl] ${resolver.name} returned null, trying next`)
    } catch (err) {
      // ProcessContentError from resolvers (e.g., Spotify) should propagate
      if (err instanceof ProcessContentError) throw err
      logger.warn(
        `[resolveAudioUrl] ${resolver.name} failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // All resolvers failed
  throw new ProcessContentError(
    "We couldn't find the audio file for this podcast episode. Try pasting a direct audio URL (.mp3), an Apple Podcasts link, or the podcast's RSS feed URL.",
    200,
  )
}

interface SubmitTranscriptionResult {
  transcript_id: string
}

/** Options for podcast transcription submission. */
export interface TranscriptionOptions {
  /** Decrypted Authorization header for private/premium podcast audio. */
  feedAuthHeader?: string
  /** Content ID to pass as extra metadata so the webhook can identify content even if request_id lookup fails. */
  contentId?: string
}

/** A single speaker utterance from Deepgram's diarization output. */
export interface DeepgramUtterance {
  speaker: number
  transcript: string
  start: number
  end: number
}

/**
 * The payload received from Deepgram via webhook when transcription completes.
 * Also re-exported for use by the webhook API route handler.
 *
 * Note: `request_id` lives inside `metadata`, NOT at the top level.
 * The top-level `request_id` only appears in the *initial submission* response.
 * The callback payload uses `metadata.request_id` to identify the request.
 */
export interface DeepgramCallbackPayload {
  metadata: {
    request_id: string
    duration: number
    channels: number
    models: string[]
    extra?: Record<string, string>
  }
  results: {
    utterances?: DeepgramUtterance[]
  }
  err_code?: number
  err_msg?: string
}

interface FormattedTranscript {
  full_text: string
  duration_seconds: number
  speaker_count: number
}

/**
 * Submits an audio URL to Deepgram for asynchronous transcription.
 *
 * The transcription runs asynchronously on Deepgram's servers. When
 * complete, Deepgram sends the result to the provided webhook URL.
 * Speaker diarization, utterance grouping, smart formatting, and
 * language detection are enabled by default.
 *
 * For private/premium feeds: when `options.feedAuthHeader` is provided,
 * the audio is first downloaded with credentials, then the raw bytes
 * are sent directly to Deepgram (which accepts audio in the POST body).
 *
 * @param audioUrl - The URL of the audio file
 * @param webhookUrl - The URL Deepgram should POST the result to when complete
 * @param apiKey - The Deepgram API key
 * @param options - Optional settings for private feed authentication
 * @returns An object containing the `transcript_id` for tracking
 * @throws Error if the Deepgram API returns a non-200 response
 */
export async function submitPodcastTranscription(
  audioUrl: string,
  webhookUrl: string,
  apiKey: string,
  options?: TranscriptionOptions,
): Promise<SubmitTranscriptionResult> {
  const queryParams = new URLSearchParams({
    model: "nova-3",
    diarize: "true",
    utterances: "true",
    smart_format: "true",
    detect_language: "true",
    callback: webhookUrl,
  })

  // Pass content_id as extra metadata so the webhook can identify content
  // even if the primary request_id → podcast_transcript_id lookup fails.
  if (options?.contentId) {
    queryParams.set("extra", `content_id:${options.contentId}`)
  }

  const apiUrl = `${DEEPGRAM_API_URL}?${queryParams.toString()}`

  // Always download audio ourselves and stream to Deepgram.
  // Many podcast CDNs (Buzzsprout, Podbean, etc.) block requests without a
  // browser-like User-Agent, returning 403. By proxying the audio through our
  // server we control the fetch headers and avoid silent Deepgram failures.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 min for large audio files

  let response: Response

  try {
    const fetchHeaders: Record<string, string> = {
      "User-Agent": `Mozilla/5.0 (compatible; Clarus/1.0; +${process.env.NEXT_PUBLIC_APP_URL || "https://clarusapp.io"})`,
    }
    if (options?.feedAuthHeader) {
      fetchHeaders.Authorization = options.feedAuthHeader
    }

    // Pre-check audio file size to avoid downloading excessively large files
    const MAX_AUDIO_BYTES = 500 * 1024 * 1024 // 500 MB
    try {
      const headResp = await fetch(audioUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(10000),
        headers: fetchHeaders,
        redirect: "follow",
      })
      const contentLength = headResp.headers.get("content-length")
      if (contentLength && parseInt(contentLength, 10) > MAX_AUDIO_BYTES) {
        throw new ProcessContentError(
          `Audio file is too large (${Math.round(parseInt(contentLength, 10) / 1024 / 1024)}MB). Maximum supported size is 500MB.`,
          400,
        )
      }
    } catch (err) {
      // HEAD request failures are non-fatal — some servers don't support HEAD
      if (err instanceof ProcessContentError) throw err
    }

    const audioResponse = await fetch(audioUrl, {
      signal: controller.signal,
      headers: fetchHeaders,
      redirect: "follow",
    })

    if (!audioResponse.ok) {
      throw new ProcessContentError(
        `Failed to download podcast audio (HTTP ${audioResponse.status}). The audio file may be unavailable or access-restricted.`,
        400,
      )
    }

    if (!audioResponse.body) {
      throw new ProcessContentError(
        "Audio download returned no data. The file may be empty or the server rejected the request.",
        400,
      )
    }

    // Detect content type from response (default to audio/mpeg)
    const contentType = audioResponse.headers.get("content-type") || "audio/mpeg"
    const deepgramContentType = contentType.startsWith("audio/") ? contentType : "audio/mpeg"

    response = await fetch(apiUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": deepgramContentType,
      },
      body: audioResponse.body,
      // @ts-expect-error -- Node fetch supports duplex for streaming request bodies
      duplex: "half",
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Deepgram submission failed (${response.status}): ${errorText}`,
    )
  }

  const data = await response.json()
  return { transcript_id: data.request_id }
}

/**
 * Formats a Deepgram callback payload into a readable transcript
 * with timestamps and speaker labels.
 *
 * Each utterance is formatted as `[MM:SS] Speaker A: text` with
 * double newlines between utterances for readability.
 *
 * Deepgram uses integer speaker IDs (0, 1, 2) which are mapped to
 * letters (A, B, C) via String.fromCharCode(65 + speaker).
 *
 * @param payload - The callback payload from Deepgram
 * @returns A formatted transcript with full text, duration, and speaker count
 */
export function formatTranscript(
  payload: DeepgramCallbackPayload,
): FormattedTranscript {
  const utterances = payload.results.utterances || []
  const speakers = new Set<number>()

  const lines = utterances.map((u) => {
    speakers.add(u.speaker)
    const timestamp = formatSeconds(u.start)
    const speakerLabel = String.fromCharCode(65 + u.speaker)
    return `[${timestamp}] Speaker ${speakerLabel}: ${u.transcript}`
  })

  return {
    full_text: lines.join("\n\n"),
    duration_seconds: Math.round(payload.metadata.duration || 0),
    speaker_count: speakers.size,
  }
}

// ============================================
// POLLING FALLBACK (Management API)
// ============================================

/** Status returned when polling Deepgram for a transcription result. */
export type TranscriptionPollResult =
  | { status: "completed"; payload: DeepgramCallbackPayload }
  | { status: "processing" }
  | { status: "failed"; error: string }

/**
 * Poll Deepgram's Management API for a completed transcription.
 *
 * Used as a fallback when the webhook callback fails to arrive.
 * Returns the transcript in the same `DeepgramCallbackPayload` shape
 * that `formatTranscript()` expects, so the recovery path is identical
 * to the normal webhook flow.
 *
 * @param requestId - The Deepgram request_id (stored as podcast_transcript_id)
 * @param apiKey - The Deepgram API key
 * @returns Poll result with status and optional payload
 */
export async function pollTranscriptionResult(
  requestId: string,
  apiKey: string,
): Promise<TranscriptionPollResult> {
  try {
    const response = await fetch(
      `https://api.deepgram.com/v1/listen/${requestId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Token ${apiKey}`,
        },
        signal: AbortSignal.timeout(15000),
      },
    )

    if (response.status === 404) {
      return { status: "failed", error: "Request not found on Deepgram" }
    }

    if (!response.ok) {
      return { status: "failed", error: `Deepgram API error: ${response.status}` }
    }

    const data = await response.json()

    // Deepgram returns the full transcript response for completed requests.
    // The response shape matches the callback payload when using pre-recorded.
    // If there are results with utterances, the transcription is done.
    if (data.results?.utterances && data.results.utterances.length > 0) {
      const payload: DeepgramCallbackPayload = {
        metadata: {
          request_id: requestId,
          duration: data.metadata?.duration ?? 0,
          channels: data.metadata?.channels ?? 1,
          models: data.metadata?.models ?? [],
        },
        results: {
          utterances: data.results.utterances,
        },
      }

      if (data.err_code) {
        payload.err_code = data.err_code
        payload.err_msg = data.err_msg
      }

      return { status: "completed", payload }
    }

    // If no utterances but no error, it may still be processing
    // or it completed with empty results
    if (data.err_code) {
      return { status: "failed", error: `Deepgram error: [${data.err_code}] ${data.err_msg}` }
    }

    // No utterances and no error — likely still processing
    return { status: "processing" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn(`[pollTranscriptionResult] Failed for ${requestId}: ${msg}`)
    return { status: "failed", error: msg }
  }
}

/** Convert seconds to MM:SS or H:MM:SS */
function formatSeconds(totalSecondsRaw: number): string {
  const totalSeconds = Math.floor(totalSecondsRaw)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

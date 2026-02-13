/**
 * @module podcast-resolver
 * @description Resolves podcast platform URLs to RSS feed URLs and metadata.
 *
 * Handles multiple URL formats:
 *   - Apple Podcasts URLs (podcasts.apple.com) → iTunes Lookup API → feedUrl
 *   - Direct RSS/XML feed URLs → validated via fetchAndParseFeed()
 *   - Generic website URLs → scrape for <link rel="alternate" type="application/rss+xml">
 *   - Spotify URLs → returns error (Spotify doesn't expose RSS feeds)
 *
 * @see {@link lib/youtube-resolver.ts} for the YouTube equivalent
 * @see {@link lib/rss-parser.ts} for parsing the resulting RSS feed
 * @see {@link app/api/podcast-subscriptions/route.ts} for the subscription API
 */

import { fetchAndParseFeed } from "./rss-parser"

export interface PodcastFeedInfo {
  feedUrl: string
  podcastName: string
  podcastImageUrl: string | null
}

/**
 * Resolves any podcast-related URL to an RSS feed URL with metadata.
 *
 * @param inputUrl - A podcast URL (Apple Podcasts, RSS feed, or website)
 * @returns Feed info including the canonical RSS feed URL
 * @throws Error if the URL cannot be resolved to a valid podcast feed
 */
export async function resolvePodcastFeed(inputUrl: string): Promise<PodcastFeedInfo> {
  let url: URL
  try {
    url = new URL(inputUrl)
  } catch {
    throw new Error("Invalid URL")
  }

  const hostname = url.hostname.replace("www.", "")

  // Case 1: Spotify — no RSS feeds available
  if (hostname === "open.spotify.com" || hostname === "spotify.com") {
    throw new Error(
      "Spotify doesn't expose RSS feeds publicly. " +
      "Paste the podcast's RSS feed URL instead, or use an Apple Podcasts link."
    )
  }

  // Case 2: Apple Podcasts — resolve via iTunes Lookup API
  if (hostname === "podcasts.apple.com" || hostname === "itunes.apple.com") {
    return resolveApplePodcasts(url)
  }

  // Case 3: Direct RSS feed URL (common patterns)
  if (looksLikeRssFeed(url)) {
    return resolveDirectFeed(inputUrl)
  }

  // Case 4: Generic website — try to discover RSS feed from HTML
  return resolveFromWebsite(inputUrl)
}

/**
 * Checks if a URL looks like a direct RSS feed based on common patterns.
 */
function looksLikeRssFeed(url: URL): boolean {
  const path = url.pathname.toLowerCase()
  const fullUrl = url.href.toLowerCase()

  return (
    path.endsWith(".xml") ||
    path.endsWith(".rss") ||
    path.endsWith(".atom") ||
    path.includes("/feed") ||
    path.includes("/rss") ||
    fullUrl.includes("feeds.") ||
    fullUrl.includes("anchor.fm") ||
    fullUrl.includes("feeds.buzzsprout.com") ||
    fullUrl.includes("feeds.transistor.fm") ||
    fullUrl.includes("feeds.megaphone.fm") ||
    fullUrl.includes("feeds.simplecast.com") ||
    fullUrl.includes("feeds.libsyn.com") ||
    fullUrl.includes("feeds.soundcloud.com") ||
    fullUrl.includes("feeds.acast.com") ||
    fullUrl.includes("feeds.podbean.com")
  )
}

/**
 * Resolves an Apple Podcasts URL via the iTunes Lookup API.
 *
 * Apple Podcasts URLs follow the pattern:
 *   https://podcasts.apple.com/{country}/podcast/{name}/id{numeric_id}
 *
 * The Lookup API returns the RSS feed URL in the feedUrl field.
 */
async function resolveApplePodcasts(url: URL): Promise<PodcastFeedInfo> {
  // Extract numeric podcast ID from the URL
  const idMatch = url.pathname.match(/\/id(\d+)/)
  if (!idMatch) {
    throw new Error("Could not extract podcast ID from Apple Podcasts URL. Expected format: podcasts.apple.com/.../idNUMBER")
  }

  const podcastId = idMatch[1]
  const lookupUrl = `https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(lookupUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Clarus/1.0 (Podcast Feed Resolver)",
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Apple Lookup API returned HTTP ${response.status}`)
    }

    const data = await response.json() as {
      resultCount: number
      results: Array<{
        feedUrl?: string
        collectionName?: string
        artworkUrl600?: string
        artworkUrl100?: string
      }>
    }

    if (!data.results || data.results.length === 0) {
      throw new Error("Podcast not found on Apple Podcasts")
    }

    const result = data.results[0]
    if (!result.feedUrl) {
      throw new Error("Apple Podcasts listing doesn't include an RSS feed URL")
    }

    // Validate the feed is actually fetchable
    const feedData = await fetchAndParseFeed(result.feedUrl)

    return {
      feedUrl: result.feedUrl,
      podcastName: feedData.feed.title || result.collectionName || "Unknown Podcast",
      podcastImageUrl: feedData.feed.imageUrl || result.artworkUrl600 || result.artworkUrl100 || null,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Validates and resolves a direct RSS feed URL.
 */
async function resolveDirectFeed(feedUrl: string): Promise<PodcastFeedInfo> {
  const feedData = await fetchAndParseFeed(feedUrl)

  return {
    feedUrl,
    podcastName: feedData.feed.title || "Unknown Podcast",
    podcastImageUrl: feedData.feed.imageUrl,
  }
}

/**
 * Discovers an RSS feed from a generic website by scraping for
 * <link rel="alternate" type="application/rss+xml"> tags.
 */
async function resolveFromWebsite(websiteUrl: string): Promise<PodcastFeedInfo> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Clarus/1.0; +https://clarusapp.io)",
        Accept: "text/html",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch website: HTTP ${response.status}`)
    }

    const html = await response.text()

    // Look for RSS feed link tags
    // <link rel="alternate" type="application/rss+xml" href="..." title="...">
    const feedLinkPatterns = [
      /<link[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/gi,
      /<link[^>]*href=["']([^"']+)["'][^>]*type=["']application\/rss\+xml["']/gi,
      /<link[^>]*type=["']application\/atom\+xml["'][^>]*href=["']([^"']+)["']/gi,
      /<link[^>]*href=["']([^"']+)["'][^>]*type=["']application\/atom\+xml["']/gi,
    ]

    const discoveredFeeds: string[] = []
    for (const pattern of feedLinkPatterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(html)) !== null) {
        let feedHref = match[1]

        // Resolve relative URLs
        if (feedHref.startsWith("/")) {
          const base = new URL(websiteUrl)
          feedHref = `${base.origin}${feedHref}`
        } else if (!feedHref.startsWith("http")) {
          const base = new URL(websiteUrl)
          feedHref = `${base.origin}/${feedHref}`
        }

        if (!discoveredFeeds.includes(feedHref)) {
          discoveredFeeds.push(feedHref)
        }
      }
    }

    if (discoveredFeeds.length === 0) {
      throw new Error(
        "No RSS feed found on this website. " +
        "Try pasting the direct RSS feed URL, or use an Apple Podcasts link."
      )
    }

    // Try each discovered feed until one works
    for (const feedUrl of discoveredFeeds) {
      try {
        const feedData = await fetchAndParseFeed(feedUrl)
        return {
          feedUrl,
          podcastName: feedData.feed.title || "Unknown Podcast",
          podcastImageUrl: feedData.feed.imageUrl,
        }
      } catch {
        // Try next feed
      }
    }

    throw new Error(
      "Found RSS link(s) on the website but could not parse them as valid podcast feeds. " +
      "Try pasting the direct RSS feed URL instead."
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

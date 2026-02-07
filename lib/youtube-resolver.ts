/**
 * @module youtube-resolver
 * @description Resolves YouTube channel URLs to channel IDs and RSS feed URLs.
 *
 * Handles multiple URL formats:
 *   - https://www.youtube.com/channel/UCxxxxxx
 *   - https://www.youtube.com/@handle
 *   - https://www.youtube.com/c/ChannelName
 *   - https://www.youtube.com/user/Username
 *   - https://www.youtube.com/watch?v=xxx (extracts channel from video page)
 *   - Direct RSS feed URL (youtube.com/feeds/videos.xml?channel_id=...)
 *
 * @see {@link lib/rss-parser.ts} for parsing the resulting Atom feed
 * @see {@link app/api/youtube-subscriptions/route.ts} for the subscription API
 */

export interface YouTubeChannelInfo {
  channelId: string
  channelName: string
  channelImageUrl: string | null
  feedUrl: string
}

/**
 * Builds the canonical YouTube RSS feed URL from a channel ID.
 */
export function buildFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
}

/**
 * Extracts a YouTube video ID from a watch URL.
 */
function extractVideoId(url: URL): string | null {
  // youtube.com/watch?v=xxx
  const v = url.searchParams.get("v")
  if (v) return v

  // youtu.be/xxx
  if (url.hostname === "youtu.be") {
    return url.pathname.slice(1).split("/")[0] || null
  }

  // youtube.com/embed/xxx or youtube.com/v/xxx
  const embedMatch = url.pathname.match(/^\/(embed|v)\/([^/?]+)/)
  if (embedMatch) return embedMatch[2]

  return null
}

/**
 * Fetches a YouTube page and extracts the channel ID from meta tags or page data.
 */
async function scrapeChannelId(pageUrl: string): Promise<{ channelId: string; channelName: string; imageUrl: string | null }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Clarus/1.0; +https://clarusapp.io)",
        Accept: "text/html",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch YouTube page: HTTP ${response.status}`)
    }

    const html = await response.text()

    // Extract channel ID from meta tag: <meta itemprop="channelId" content="UCxxxx">
    const channelIdMatch = html.match(/<meta\s+itemprop="channelId"\s+content="([^"]+)"/)
      ?? html.match(/"channelId":"([^"]+)"/)
      ?? html.match(/channel_id=([A-Za-z0-9_-]{24})/)

    if (!channelIdMatch) {
      throw new Error("Could not find channel ID on this YouTube page")
    }

    const channelId = channelIdMatch[1]

    // Extract channel name
    const nameMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)
      ?? html.match(/<meta\s+name="title"\s+content="([^"]+)"/)
      ?? html.match(/"ownerChannelName":"([^"]+)"/)
    const channelName = nameMatch ? decodeHtmlEntities(nameMatch[1]) : "Unknown Channel"

    // Extract channel image
    const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/)
    const imageUrl = imageMatch ? imageMatch[1] : null

    return { channelId, channelName, imageUrl }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Decodes basic HTML entities in a string.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

/**
 * Resolves any YouTube URL to channel info and RSS feed URL.
 *
 * @param inputUrl - Any YouTube URL (channel, handle, video, or feed)
 * @returns Channel info including the RSS feed URL
 * @throws Error if the URL is not a valid YouTube URL or channel cannot be resolved
 */
export async function resolveYouTubeChannel(inputUrl: string): Promise<YouTubeChannelInfo> {
  let url: URL
  try {
    url = new URL(inputUrl)
  } catch {
    throw new Error("Invalid URL")
  }

  const hostname = url.hostname.replace("www.", "").replace("m.", "")
  if (hostname !== "youtube.com" && hostname !== "youtu.be") {
    throw new Error("Not a YouTube URL")
  }

  const pathname = url.pathname

  // Case 1: Direct feed URL — youtube.com/feeds/videos.xml?channel_id=UC...
  if (pathname === "/feeds/videos.xml") {
    const channelId = url.searchParams.get("channel_id")
    if (!channelId) throw new Error("Feed URL is missing channel_id parameter")

    // Fetch the feed to get channel name
    const { feed } = await fetchFeedForInfo(buildFeedUrl(channelId))
    return {
      channelId,
      channelName: feed.title,
      channelImageUrl: feed.imageUrl,
      feedUrl: buildFeedUrl(channelId),
    }
  }

  // Case 2: Direct channel ID URL — youtube.com/channel/UCxxxxxx
  const channelMatch = pathname.match(/^\/channel\/([A-Za-z0-9_-]+)/)
  if (channelMatch) {
    const channelId = channelMatch[1]
    const { feed } = await fetchFeedForInfo(buildFeedUrl(channelId))
    return {
      channelId,
      channelName: feed.title,
      channelImageUrl: feed.imageUrl,
      feedUrl: buildFeedUrl(channelId),
    }
  }

  // Case 3: Handle URL — youtube.com/@handle
  if (pathname.startsWith("/@")) {
    const info = await scrapeChannelId(inputUrl)
    return {
      channelId: info.channelId,
      channelName: info.channelName,
      channelImageUrl: info.imageUrl,
      feedUrl: buildFeedUrl(info.channelId),
    }
  }

  // Case 4: Legacy custom URL — youtube.com/c/ChannelName or youtube.com/user/Username
  if (pathname.startsWith("/c/") || pathname.startsWith("/user/")) {
    const info = await scrapeChannelId(inputUrl)
    return {
      channelId: info.channelId,
      channelName: info.channelName,
      channelImageUrl: info.imageUrl,
      feedUrl: buildFeedUrl(info.channelId),
    }
  }

  // Case 5: Video URL — extract channel from the video page
  const videoId = extractVideoId(url)
  if (videoId) {
    const info = await scrapeChannelId(`https://www.youtube.com/watch?v=${videoId}`)
    return {
      channelId: info.channelId,
      channelName: info.channelName,
      channelImageUrl: info.imageUrl,
      feedUrl: buildFeedUrl(info.channelId),
    }
  }

  throw new Error("Could not determine YouTube channel from this URL. Try pasting a channel URL or @handle.")
}

/**
 * Fetches a YouTube RSS feed just for channel metadata (name + image).
 */
async function fetchFeedForInfo(feedUrl: string): Promise<{ feed: { title: string; imageUrl: string | null } }> {
  // Reuse the existing RSS parser for Atom feeds
  const { fetchAndParseFeed } = await import("./rss-parser")
  const parsed = await fetchAndParseFeed(feedUrl)
  return {
    feed: {
      title: parsed.feed.title,
      imageUrl: parsed.feed.imageUrl,
    },
  }
}

/**
 * Extracts the YouTube video ID from a video watch URL.
 * Returns null if the URL is not a video URL.
 */
export function extractYouTubeVideoId(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl)
    return extractVideoId(url)
  } catch {
    return null
  }
}

/**
 * @module rss-parser
 * @description Lightweight RSS/Atom feed parser for podcast feeds.
 *
 * Parses podcast RSS 2.0 and Atom feeds to extract podcast metadata
 * (title, image) and episode information (title, enclosure URL,
 * publication date, duration, description).
 *
 * Uses the built-in DOMParser-compatible approach via regex extraction
 * for serverless compatibility (no native DOM in Node.js).
 *
 * @see {@link app/api/podcast-subscriptions/route.ts} for feed validation
 * @see {@link app/api/crons/check-podcast-feeds/route.ts} for episode polling
 */

/** Metadata extracted from a podcast feed's channel/feed element. */
export interface PodcastFeedInfo {
  title: string
  imageUrl: string | null
  description: string | null
  feedUrl: string
}

/** A single episode parsed from the feed. */
export interface PodcastEpisode {
  title: string
  url: string
  pubDate: Date | null
  durationSeconds: number | null
  description: string | null
}

/** Result of parsing a podcast feed. */
export interface ParsedFeed {
  feed: PodcastFeedInfo
  episodes: PodcastEpisode[]
}

/**
 * Extracts the text content between an XML tag.
 * Handles CDATA sections and returns null if tag is not found.
 */
function extractTag(xml: string, tagName: string): string | null {
  // Try with namespace prefix first (e.g., itunes:duration)
  const patterns = [
    new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>`, "i"),
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"),
  ]

  for (const pattern of patterns) {
    const match = xml.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

/**
 * Extracts an attribute value from a self-closing or opening XML tag.
 */
function extractAttribute(xml: string, tagName: string, attrName: string): string | null {
  const pattern = new RegExp(`<${tagName}[^>]*\\s${attrName}\\s*=\\s*["']([^"']*)["']`, "i")
  const match = xml.match(pattern)
  return match ? match[1].trim() : null
}

/**
 * Parses an iTunes-style duration string into seconds.
 * Supports formats: "HH:MM:SS", "MM:SS", "SS", or plain seconds.
 */
function parseDuration(durationStr: string): number | null {
  if (!durationStr) return null

  const trimmed = durationStr.trim()

  // Plain seconds
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10)
  }

  // HH:MM:SS or MM:SS
  const parts = trimmed.split(":").map(Number)
  if (parts.some(isNaN)) return null

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }

  return null
}

/**
 * Strips HTML tags from a string for plain-text descriptions.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Parses an RSS 2.0 podcast feed.
 */
function parseRss2(xml: string, feedUrl: string): ParsedFeed {
  // Extract channel-level info
  const channelMatch = xml.match(/<channel>([\s\S]*?)<\/channel>/i)
  const channelXml = channelMatch ? channelMatch[1] : xml

  const title = extractTag(channelXml.split("<item")[0], "title") ?? "Unknown Podcast"

  // Podcast image: try itunes:image href, then <image><url>, then <channel> image
  let imageUrl = extractAttribute(channelXml.split("<item")[0], "itunes:image", "href")
  if (!imageUrl) {
    const imageBlock = channelXml.split("<item")[0].match(/<image>([\s\S]*?)<\/image>/i)
    if (imageBlock) {
      imageUrl = extractTag(imageBlock[1], "url")
    }
  }

  const description = extractTag(channelXml.split("<item")[0], "description")

  // Extract items
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  const episodes: PodcastEpisode[] = []
  let itemMatch: RegExpExecArray | null

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1]

    const episodeTitle = extractTag(itemXml, "title") ?? "Untitled Episode"

    // Episode URL: prefer enclosure url attribute (the audio file), fallback to link
    let episodeUrl = extractAttribute(itemXml, "enclosure", "url")
    if (!episodeUrl) {
      episodeUrl = extractTag(itemXml, "link")
    }
    if (!episodeUrl) continue // Skip episodes with no URL

    // Publication date
    const pubDateStr = extractTag(itemXml, "pubDate")
    let pubDate: Date | null = null
    if (pubDateStr) {
      const parsed = new Date(pubDateStr)
      if (!isNaN(parsed.getTime())) {
        pubDate = parsed
      }
    }

    // Duration from itunes:duration
    const durationStr = extractTag(itemXml, "itunes:duration")
    const durationSeconds = durationStr ? parseDuration(durationStr) : null

    // Description
    const rawDescription = extractTag(itemXml, "description") ??
      extractTag(itemXml, "itunes:summary")
    const episodeDescription = rawDescription ? stripHtml(rawDescription).slice(0, 1000) : null

    episodes.push({
      title: episodeTitle,
      url: episodeUrl,
      pubDate,
      durationSeconds,
      description: episodeDescription,
    })
  }

  return {
    feed: {
      title,
      imageUrl: imageUrl ?? null,
      description: description ? stripHtml(description).slice(0, 500) : null,
      feedUrl,
    },
    episodes,
  }
}

/**
 * Parses an Atom feed.
 */
function parseAtom(xml: string, feedUrl: string): ParsedFeed {
  const title = extractTag(xml.split("<entry")[0], "title") ?? "Unknown Podcast"

  // Atom image: try logo, then icon
  const imageUrl = extractTag(xml, "logo") ?? extractTag(xml, "icon")

  const description = extractTag(xml.split("<entry")[0], "subtitle")

  // Extract entries
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi
  const episodes: PodcastEpisode[] = []
  let entryMatch: RegExpExecArray | null

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const entryXml = entryMatch[1]

    const episodeTitle = extractTag(entryXml, "title") ?? "Untitled Episode"

    // Link: prefer enclosure, then alternate link
    let episodeUrl = extractAttribute(entryXml, "link[^>]*rel\\s*=\\s*[\"']enclosure[\"']", "href")
    if (!episodeUrl) {
      episodeUrl = extractAttribute(entryXml, "link", "href")
    }
    if (!episodeUrl) continue

    // Publication date
    const pubDateStr = extractTag(entryXml, "published") ?? extractTag(entryXml, "updated")
    let pubDate: Date | null = null
    if (pubDateStr) {
      const parsed = new Date(pubDateStr)
      if (!isNaN(parsed.getTime())) {
        pubDate = parsed
      }
    }

    // Description
    const rawDescription = extractTag(entryXml, "summary") ?? extractTag(entryXml, "content")
    const episodeDescription = rawDescription ? stripHtml(rawDescription).slice(0, 1000) : null

    episodes.push({
      title: episodeTitle,
      url: episodeUrl,
      pubDate,
      durationSeconds: null,
      description: episodeDescription,
    })
  }

  return {
    feed: {
      title,
      imageUrl: imageUrl ?? null,
      description: description ? stripHtml(description).slice(0, 500) : null,
      feedUrl,
    },
    episodes,
  }
}

/**
 * Fetches and parses a podcast RSS or Atom feed.
 *
 * @param feedUrl - The URL of the podcast RSS feed
 * @returns The parsed feed with podcast metadata and episodes
 * @throws Error if the feed cannot be fetched or is not a valid podcast feed
 */
export async function fetchAndParseFeed(feedUrl: string): Promise<ParsedFeed> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Clarus/1.0 (Podcast Feed Reader)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: HTTP ${response.status}`)
    }

    const text = await response.text()

    // Validate it's XML
    if (!text.trim().startsWith("<?xml") && !text.trim().startsWith("<rss") && !text.trim().startsWith("<feed")) {
      // Check if it might be XML without the declaration
      if (!text.includes("<channel>") && !text.includes("<entry>")) {
        throw new Error("Response is not a valid RSS or Atom feed")
      }
    }

    return parseFeedXml(text, feedUrl)
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Parses raw XML content as either RSS 2.0 or Atom.
 *
 * @param xml - The raw XML string
 * @param feedUrl - The original feed URL (for metadata)
 * @returns The parsed feed
 * @throws Error if the XML is not a recognized feed format
 */
export function parseFeedXml(xml: string, feedUrl: string): ParsedFeed {
  if (xml.includes("<rss") || xml.includes("<channel>")) {
    return parseRss2(xml, feedUrl)
  }

  if (xml.includes("<feed") && xml.includes("xmlns=\"http://www.w3.org/2005/Atom\"")) {
    return parseAtom(xml, feedUrl)
  }

  // Try RSS 2.0 as default if it has items
  if (xml.includes("<item>")) {
    return parseRss2(xml, feedUrl)
  }

  // Try Atom as fallback if it has entries
  if (xml.includes("<entry>")) {
    return parseAtom(xml, feedUrl)
  }

  throw new Error("Unrecognized feed format. Only RSS 2.0 and Atom feeds are supported.")
}

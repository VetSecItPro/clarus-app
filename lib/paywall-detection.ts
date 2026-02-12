/**
 * @module paywall-detection
 * @description Paywall detection for scraped web content.
 *
 * Identifies when an article may be behind a paywall by checking the
 * URL against a list of known paywalled domains and analyzing whether
 * the scraped text is suspiciously short (indicating truncation).
 *
 * When a paywall is detected, a warning message is included in the
 * analysis so users understand the analysis may be based on incomplete text.
 */

/** Domains known to have paywalls on most content */
const PAYWALLED_DOMAINS = new Set([
  // Major newspapers
  "nytimes.com",
  "wsj.com",
  "washingtonpost.com",
  "ft.com",
  "economist.com",
  "bloomberg.com",
  "barrons.com",
  "telegraph.co.uk",
  "thetimes.co.uk",
  "latimes.com",
  "bostonglobe.com",
  "theatlantic.com",
  "newyorker.com",
  "wired.com",
  // Business / Finance
  "hbr.org",
  "businessinsider.com",
  "seekingalpha.com",
  "theathletic.com",
  // Tech
  "theinformation.com",
  "stratechery.com",
  // Substack (some are free, some paywalled)
  // Not included — handled by content length check instead
])

/** Minimum content length (characters) to consider an article fully scraped */
const MIN_ARTICLE_LENGTH = 500

/**
 * Checks whether a URL belongs to a domain known to paywall most of its content.
 */
function isPaywalledDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "")
    return PAYWALLED_DOMAINS.has(hostname)
  } catch {
    return false
  }
}

/**
 * Detects whether scraped content is likely truncated by a paywall.
 *
 * Combines domain knowledge (is this a known paywalled site?) with
 * content length heuristics (is the scraped text suspiciously short?)
 * to produce a user-facing warning message.
 *
 * Skips detection for content types that are not web articles
 * (YouTube, PDF, documents).
 *
 * @param url - The source URL of the content
 * @param scrapedText - The text extracted from the page, or null
 * @param contentType - The content type string (e.g., `"article"`, `"youtube"`)
 * @returns A warning message string if paywall is likely, or `null` if no concerns
 *
 * @example
 * ```ts
 * const warning = detectPaywallTruncation(content.url, fullText, "article")
 * if (warning) {
 *   // Include warning in the analysis output for the user
 * }
 * ```
 */
export function detectPaywallTruncation(
  url: string,
  scrapedText: string | null,
  contentType: string
): string | null {
  if (!scrapedText || contentType === "youtube" || contentType === "pdf" || contentType === "document") {
    return null
  }

  const textLength = scrapedText.length
  const knownPaywall = isPaywalledDomain(url)

  // Known paywalled domain + short content = very likely paywalled
  if (knownPaywall && textLength < 2000) {
    return "This content is from a paywalled source. The analysis is based on the publicly available preview, which may not include the full article."
  }

  // Any domain + very short content for an article = possibly paywalled or scraping issue
  if (textLength < MIN_ARTICLE_LENGTH && contentType === "article") {
    return "The scraped content is shorter than expected. This may be due to a paywall, login wall, or content that requires JavaScript to render. The analysis may be incomplete."
  }

  // Known paywalled domain but content seems full = mild warning
  if (knownPaywall && textLength >= 2000) {
    return "This content is from a source that sometimes requires a subscription. If the analysis seems incomplete, the full article may be behind a paywall."
  }

  return null
}

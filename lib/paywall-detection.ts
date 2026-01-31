/**
 * Paywall detection for scraped content.
 * Detects known paywalled domains and suspiciously short scraped content.
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
 * Check if a URL belongs to a known paywalled domain.
 */
export function isPaywalledDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "")
    return PAYWALLED_DOMAINS.has(hostname)
  } catch {
    return false
  }
}

/**
 * Detect if scraped content is likely truncated by a paywall.
 * Returns a warning message if paywall is detected, null otherwise.
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

/**
 * @module source-classification
 * @description Classifies source domains into credibility categories
 * for display as badges next to truth check citations.
 */

export type SourceType = "academic" | "news" | "government" | "blog" | "social" | "wiki" | "unknown"

interface SourceClassification {
  type: SourceType
  label: string
  color: string    // Tailwind text color
  bg: string       // Tailwind bg color
  border: string   // Tailwind border color
}

// Known domain patterns for classification
const ACADEMIC_DOMAINS = [
  ".edu", ".ac.uk", ".ac.jp", "scholar.google", "pubmed.ncbi", "arxiv.org",
  "researchgate.net", "springer.com", "sciencedirect.com", "nature.com",
  "science.org", "thelancet.com", "nejm.org", "bmj.com", "plos.org",
  "frontiersin.org", "ieee.org", "acm.org", "jstor.org", "ssrn.com",
]

const NEWS_DOMAINS = [
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "nytimes.com",
  "washingtonpost.com", "theguardian.com", "wsj.com", "bloomberg.com",
  "cnbc.com", "cnn.com", "npr.org", "pbs.org", "abcnews.go.com",
  "nbcnews.com", "cbsnews.com", "politico.com", "thehill.com",
  "ft.com", "economist.com", "arstechnica.com", "wired.com",
  "techcrunch.com", "theverge.com", "engadget.com",
]

const GOVERNMENT_DOMAINS = [
  ".gov", ".gov.uk", ".gov.au", ".gc.ca", "who.int", "un.org",
  "europa.eu", "cdc.gov", "fda.gov", "nih.gov", "nasa.gov",
  "sec.gov", "fbi.gov", "irs.gov",
]

const SOCIAL_DOMAINS = [
  "twitter.com", "x.com", "reddit.com", "facebook.com", "instagram.com",
  "tiktok.com", "youtube.com", "threads.net", "mastodon.social",
  "linkedin.com",
]

const WIKI_DOMAINS = [
  "wikipedia.org", "wikimedia.org", "wiktionary.org", "wikihow.com",
]

const BLOG_PATTERNS = [
  "medium.com", "substack.com", "dev.to", "hashnode.dev",
  "wordpress.com", "blogger.com", "ghost.io", "beehiiv.com",
  "mirror.xyz",
]

const SOURCE_STYLES: Record<SourceType, Omit<SourceClassification, "type">> = {
  academic: {
    label: "Academic",
    color: "text-violet-400",
    bg: "bg-violet-500/15",
    border: "border-violet-500/25",
  },
  news: {
    label: "News",
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    border: "border-blue-500/25",
  },
  government: {
    label: "Gov",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/25",
  },
  wiki: {
    label: "Wiki",
    color: "text-cyan-400",
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/25",
  },
  blog: {
    label: "Blog",
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    border: "border-orange-500/25",
  },
  social: {
    label: "Social",
    color: "text-pink-400",
    bg: "bg-pink-500/15",
    border: "border-pink-500/25",
  },
  unknown: {
    label: "Web",
    color: "text-white/50",
    bg: "bg-white/[0.06]",
    border: "border-white/[0.1]",
  },
}

function matchesDomain(hostname: string, patterns: string[]): boolean {
  const lower = hostname.toLowerCase()
  return patterns.some(pattern => {
    if (pattern.startsWith(".")) {
      // TLD match: ".edu" matches "mit.edu", "cs.stanford.edu"
      return lower.endsWith(pattern)
    }
    // Exact domain match or subdomain match
    return lower === pattern || lower.endsWith("." + pattern)
  })
}

export function classifySource(url: string): SourceClassification {
  let hostname: string
  try {
    hostname = new URL(url).hostname.replace("www.", "")
  } catch {
    return { type: "unknown", ...SOURCE_STYLES.unknown }
  }

  if (matchesDomain(hostname, ACADEMIC_DOMAINS)) {
    return { type: "academic", ...SOURCE_STYLES.academic }
  }
  if (matchesDomain(hostname, GOVERNMENT_DOMAINS)) {
    return { type: "government", ...SOURCE_STYLES.government }
  }
  if (matchesDomain(hostname, NEWS_DOMAINS)) {
    return { type: "news", ...SOURCE_STYLES.news }
  }
  if (matchesDomain(hostname, WIKI_DOMAINS)) {
    return { type: "wiki", ...SOURCE_STYLES.wiki }
  }
  if (matchesDomain(hostname, SOCIAL_DOMAINS)) {
    return { type: "social", ...SOURCE_STYLES.social }
  }
  if (matchesDomain(hostname, BLOG_PATTERNS)) {
    return { type: "blog", ...SOURCE_STYLES.blog }
  }

  return { type: "unknown", ...SOURCE_STYLES.unknown }
}

export function getSourceStyles(type: SourceType): Omit<SourceClassification, "type"> {
  return SOURCE_STYLES[type]
}

import { describe, it, expect } from "vitest"
import {
  cn,
  formatDuration,
  getYouTubeVideoId,
  isPdfUrl,
  isXUrl,
  isPodcastUrl,
  getDomainFromUrl,
  normalizeUrl,
} from "@/lib/utils"

// =============================================================================
// cn (class name merger)
// =============================================================================

describe("cn", () => {
  it("merges simple class names", () => {
    const result = cn("px-2", "py-1")
    expect(result).toContain("px-2")
    expect(result).toContain("py-1")
  })

  it("resolves Tailwind conflicts (last one wins)", () => {
    const result = cn("px-2", "px-4")
    expect(result).toContain("px-4")
    expect(result).not.toContain("px-2")
  })

  it("handles conditional classes", () => {
    const isActive = true
    const result = cn("base", isActive && "active")
    expect(result).toContain("base")
    expect(result).toContain("active")
  })

  it("filters out falsy values", () => {
    const result = cn("base", false, null, undefined, "end")
    expect(result).toBe("base end")
  })

  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("")
  })
})

// =============================================================================
// formatDuration
// =============================================================================

describe("formatDuration", () => {
  it("returns N/A for null", () => {
    expect(formatDuration(null)).toBe("N/A")
  })

  it("returns N/A for undefined", () => {
    expect(formatDuration(undefined)).toBe("N/A")
  })

  it("returns 0:00 for zero seconds", () => {
    expect(formatDuration(0)).toBe("0:00")
  })

  it("formats seconds-only correctly", () => {
    expect(formatDuration(30)).toBe("0:30")
  })

  it("formats minutes and seconds", () => {
    expect(formatDuration(90)).toBe("1:30")
  })

  it("formats hours, minutes, and seconds", () => {
    expect(formatDuration(5400)).toBe("1:30:00")
  })

  it("pads seconds with leading zero", () => {
    expect(formatDuration(61)).toBe("1:01")
  })

  it("pads minutes with leading zero when hours are present", () => {
    expect(formatDuration(3665)).toBe("1:01:05")
  })
})

// =============================================================================
// getYouTubeVideoId
// =============================================================================

describe("getYouTubeVideoId", () => {
  it("extracts video ID from standard watch URL", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("extracts video ID from youtu.be short URL", () => {
    expect(getYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("extracts video ID from shorts URL", () => {
    expect(getYouTubeVideoId("https://youtube.com/shorts/abc123")).toBe("abc123")
  })

  it("returns null for non-YouTube URLs", () => {
    expect(getYouTubeVideoId("https://example.com/")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(getYouTubeVideoId("")).toBeNull()
  })

  it("returns null for invalid URLs", () => {
    expect(getYouTubeVideoId("not-a-url")).toBeNull()
  })
})

// =============================================================================
// isPdfUrl
// =============================================================================

describe("isPdfUrl", () => {
  it("returns true for .pdf URLs", () => {
    expect(isPdfUrl("https://example.com/document.pdf")).toBe(true)
  })

  it("returns true for .PDF (case-insensitive)", () => {
    expect(isPdfUrl("https://example.com/document.PDF")).toBe(true)
  })

  it("returns false for non-PDF URLs", () => {
    expect(isPdfUrl("https://example.com/page.html")).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(isPdfUrl("")).toBe(false)
  })

  it("returns false for invalid URL", () => {
    expect(isPdfUrl("not-a-url")).toBe(false)
  })
})

// =============================================================================
// isXUrl
// =============================================================================

describe("isXUrl", () => {
  it("returns true for x.com URLs", () => {
    expect(isXUrl("https://x.com/user/status/123")).toBe(true)
  })

  it("returns true for twitter.com URLs", () => {
    expect(isXUrl("https://twitter.com/user/status/123")).toBe(true)
  })

  it("returns false for other URLs", () => {
    expect(isXUrl("https://example.com/")).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(isXUrl("")).toBe(false)
  })
})

// =============================================================================
// isPodcastUrl
// =============================================================================

describe("isPodcastUrl", () => {
  it("detects direct mp3 links", () => {
    expect(isPodcastUrl("https://example.com/episode.mp3")).toBe(true)
  })

  it("detects direct m4a links", () => {
    expect(isPodcastUrl("https://example.com/episode.m4a")).toBe(true)
  })

  it("detects Spotify episode URLs", () => {
    expect(isPodcastUrl("https://open.spotify.com/episode/abc123")).toBe(true)
  })

  it("does not flag Spotify non-episode URLs", () => {
    expect(isPodcastUrl("https://open.spotify.com/track/abc123")).toBe(false)
  })

  it("detects known podcast platforms", () => {
    expect(isPodcastUrl("https://anchor.fm/show/episode")).toBe(true)
    expect(isPodcastUrl("https://podcasts.apple.com/podcast/123")).toBe(true)
    expect(isPodcastUrl("https://overcast.fm/+abc123")).toBe(true)
  })

  it("returns false for regular article URLs", () => {
    expect(isPodcastUrl("https://example.com/article")).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(isPodcastUrl("")).toBe(false)
  })

  it("returns false for invalid URL", () => {
    expect(isPodcastUrl("not-a-url")).toBe(false)
  })
})

// =============================================================================
// getDomainFromUrl
// =============================================================================

describe("getDomainFromUrl", () => {
  it("extracts domain from URL", () => {
    expect(getDomainFromUrl("https://www.nytimes.com/article")).toBe("nytimes.com")
  })

  it("strips www. prefix", () => {
    expect(getDomainFromUrl("https://www.example.com/")).toBe("example.com")
  })

  it("returns domain without www for URLs without www", () => {
    expect(getDomainFromUrl("https://example.com/")).toBe("example.com")
  })

  it("returns unknown.com for null", () => {
    expect(getDomainFromUrl(null)).toBe("unknown.com")
  })

  it("returns unknown.com for invalid URL", () => {
    expect(getDomainFromUrl("not-a-url")).toBe("unknown.com")
  })
})

// =============================================================================
// normalizeUrl
// =============================================================================

describe("normalizeUrl", () => {
  describe("tracking parameter removal", () => {
    it("strips utm_source", () => {
      const result = normalizeUrl("https://example.com/article?utm_source=twitter")
      expect(result).not.toContain("utm_source")
    })

    it("strips utm_medium", () => {
      const result = normalizeUrl("https://example.com/article?utm_medium=social")
      expect(result).not.toContain("utm_medium")
    })

    it("strips utm_campaign", () => {
      const result = normalizeUrl("https://example.com/article?utm_campaign=launch")
      expect(result).not.toContain("utm_campaign")
    })

    it("strips fbclid", () => {
      const result = normalizeUrl("https://example.com/?fbclid=abc123")
      expect(result).not.toContain("fbclid")
    })

    it("strips si parameter", () => {
      const result = normalizeUrl("https://example.com/?si=12345")
      expect(result).not.toContain("si=")
    })

    it("strips gclid", () => {
      const result = normalizeUrl("https://example.com/?gclid=xyz")
      expect(result).not.toContain("gclid")
    })

    it("preserves non-tracking parameters", () => {
      const result = normalizeUrl("https://example.com/search?q=hello&page=2&utm_source=twitter")
      expect(result).toContain("q=hello")
      expect(result).toContain("page=2")
      expect(result).not.toContain("utm_source")
    })
  })

  describe("hostname normalization", () => {
    it("lowercases the hostname", () => {
      const result = normalizeUrl("https://WWW.EXAMPLE.COM/path")
      expect(result).toContain("example.com")
      expect(result).not.toContain("WWW")
    })

    it("strips www. prefix", () => {
      const result = normalizeUrl("https://www.example.com/path")
      expect(result).toContain("example.com/path")
      expect(result).not.toContain("www.")
    })
  })

  describe("path normalization", () => {
    it("removes trailing slash from paths", () => {
      const result = normalizeUrl("https://example.com/article/")
      expect(result).toBe("https://example.com/article")
    })

    it("preserves root slash", () => {
      const result = normalizeUrl("https://example.com/")
      expect(result).toBe("https://example.com/")
    })
  })

  describe("hash fragment removal", () => {
    it("removes hash fragments", () => {
      const result = normalizeUrl("https://example.com/article#section-2")
      expect(result).not.toContain("#section-2")
    })
  })

  describe("query parameter sorting", () => {
    it("sorts remaining query parameters alphabetically", () => {
      const result = normalizeUrl("https://example.com/search?z=1&a=2&m=3")
      // Parameters should be sorted: a=2, m=3, z=1
      const urlObj = new URL(result)
      const keys = [...urlObj.searchParams.keys()]
      expect(keys).toEqual(["a", "m", "z"])
    })
  })

  describe("edge cases", () => {
    it("returns empty string for empty input", () => {
      expect(normalizeUrl("")).toBe("")
    })

    it("returns original for invalid URLs", () => {
      expect(normalizeUrl("not-a-url")).toBe("not-a-url")
    })

    it("does not normalize pdf:// scheme URLs", () => {
      const pdfUrl = "pdf://uploaded-file-abc123"
      expect(normalizeUrl(pdfUrl)).toBe(pdfUrl)
    })

    it("handles URL with only tracking params (all stripped)", () => {
      const result = normalizeUrl("https://example.com/article?utm_source=twitter&utm_medium=social")
      expect(result).toBe("https://example.com/article")
    })

    it("handles URL with no params", () => {
      const result = normalizeUrl("https://example.com/article")
      expect(result).toBe("https://example.com/article")
    })
  })
})

import { describe, it, expect } from "vitest"
import { detectPaywallTruncation } from "@/lib/paywall-detection"

// =============================================================================
// detectPaywallTruncation — Known paywalled domains with short text
// =============================================================================

describe("detectPaywallTruncation — paywalled domain + short text", () => {
  it("detects nytimes.com with short text as paywalled", () => {
    const warning = detectPaywallTruncation(
      "https://www.nytimes.com/2024/01/article",
      "Short preview text here.",
      "article"
    )
    expect(warning).not.toBeNull()
    expect(warning).toContain("paywalled source")
  })

  it("detects wsj.com with text under 2000 chars", () => {
    const warning = detectPaywallTruncation(
      "https://www.wsj.com/articles/something",
      "A".repeat(500),
      "article"
    )
    expect(warning).not.toBeNull()
    expect(warning).toContain("paywalled source")
  })

  it("detects bloomberg.com with short text", () => {
    const warning = detectPaywallTruncation(
      "https://www.bloomberg.com/news/article",
      "Brief content",
      "article"
    )
    expect(warning).not.toBeNull()
    expect(warning).toContain("paywalled source")
  })

  it("detects ft.com with short text", () => {
    const warning = detectPaywallTruncation(
      "https://www.ft.com/content/article-id",
      "Partial article text",
      "article"
    )
    expect(warning).not.toBeNull()
  })

  it("detects economist.com with short text", () => {
    const warning = detectPaywallTruncation(
      "https://www.economist.com/leaders/2024/article",
      "Preview only",
      "article"
    )
    expect(warning).not.toBeNull()
  })

  it("detects theatlantic.com with short text", () => {
    const warning = detectPaywallTruncation(
      "https://www.theatlantic.com/ideas/archive/2024/article",
      "Opening paragraph only.",
      "article"
    )
    expect(warning).not.toBeNull()
  })
})

// =============================================================================
// detectPaywallTruncation — Known paywalled domains with full text
// =============================================================================

describe("detectPaywallTruncation — paywalled domain + full text", () => {
  it("returns mild warning for nytimes.com with long text", () => {
    const warning = detectPaywallTruncation(
      "https://www.nytimes.com/2024/01/article",
      "A".repeat(5000),
      "article"
    )
    expect(warning).not.toBeNull()
    expect(warning).toContain("sometimes requires a subscription")
  })

  it("returns mild warning for wsj.com with text >= 2000 chars", () => {
    const warning = detectPaywallTruncation(
      "https://www.wsj.com/articles/something",
      "B".repeat(3000),
      "article"
    )
    expect(warning).not.toBeNull()
    expect(warning).toContain("sometimes requires a subscription")
  })
})

// =============================================================================
// detectPaywallTruncation — Non-paywalled domains
// =============================================================================

describe("detectPaywallTruncation — non-paywalled domains", () => {
  it("returns null for non-paywalled domain with normal text", () => {
    const warning = detectPaywallTruncation(
      "https://www.example.com/blog/post",
      "A".repeat(2000),
      "article"
    )
    expect(warning).toBeNull()
  })

  it("returns null for free news site with enough text", () => {
    const warning = detectPaywallTruncation(
      "https://www.bbc.com/news/world",
      "A".repeat(5000),
      "article"
    )
    expect(warning).toBeNull()
  })

  it("detects very short text on any domain as potentially paywalled", () => {
    const warning = detectPaywallTruncation(
      "https://www.example.com/article",
      "Short.",
      "article"
    )
    expect(warning).not.toBeNull()
    expect(warning).toContain("shorter than expected")
  })

  it("detects text under 500 chars as short on non-paywalled article", () => {
    const warning = detectPaywallTruncation(
      "https://www.randomsite.com/blog",
      "A".repeat(400),
      "article"
    )
    expect(warning).not.toBeNull()
    expect(warning).toContain("shorter than expected")
  })

  it("returns null for non-paywalled domain with 500+ chars", () => {
    const warning = detectPaywallTruncation(
      "https://www.randomsite.com/blog",
      "A".repeat(501),
      "article"
    )
    expect(warning).toBeNull()
  })
})

// =============================================================================
// detectPaywallTruncation — Skipped content types
// =============================================================================

describe("detectPaywallTruncation — skipped content types", () => {
  it("returns null for youtube content", () => {
    const warning = detectPaywallTruncation(
      "https://www.youtube.com/watch?v=abc",
      "Short transcript",
      "youtube"
    )
    expect(warning).toBeNull()
  })

  it("returns null for pdf content", () => {
    const warning = detectPaywallTruncation(
      "https://example.com/file.pdf",
      "Short",
      "pdf"
    )
    expect(warning).toBeNull()
  })

  it("returns null for document content", () => {
    const warning = detectPaywallTruncation(
      "https://example.com/doc",
      "Short",
      "document"
    )
    expect(warning).toBeNull()
  })
})

// =============================================================================
// detectPaywallTruncation — Null/empty text
// =============================================================================

describe("detectPaywallTruncation — null/empty text", () => {
  it("returns null when scrapedText is null", () => {
    const warning = detectPaywallTruncation(
      "https://www.nytimes.com/article",
      null,
      "article"
    )
    expect(warning).toBeNull()
  })

  it("treats empty string as falsy (same as null), returns null", () => {
    // Empty string is falsy in JS, so !scrapedText is true => returns null
    const warning = detectPaywallTruncation(
      "https://www.nytimes.com/article",
      "",
      "article"
    )
    expect(warning).toBeNull()
  })
})

// =============================================================================
// detectPaywallTruncation — URL edge cases
// =============================================================================

describe("detectPaywallTruncation — URL edge cases", () => {
  it("handles URL with www prefix", () => {
    const warning = detectPaywallTruncation(
      "https://www.washingtonpost.com/article",
      "Short text.",
      "article"
    )
    expect(warning).not.toBeNull()
  })

  it("handles URL without www prefix", () => {
    const warning = detectPaywallTruncation(
      "https://washingtonpost.com/article",
      "Short text.",
      "article"
    )
    expect(warning).not.toBeNull()
  })

  it("handles invalid URL gracefully (returns null for domain check)", () => {
    // Invalid URL means isPaywalledDomain returns false
    // But short text on article type still triggers short-text warning
    const warning = detectPaywallTruncation(
      "not-a-valid-url",
      "Very short",
      "article"
    )
    // Should fall through to short text check
    expect(warning).not.toBeNull()
    expect(warning).toContain("shorter than expected")
  })
})

import { describe, it, expect } from "vitest"
import { screenUrl, screenText, detectAiRefusal, hashContent } from "@/lib/content-screening"

// =============================================================================
// screenUrl
// =============================================================================

describe("screenUrl", () => {
  it("returns null for normal URLs", () => {
    expect(screenUrl("https://example.com/article")).toBeNull()
    expect(screenUrl("https://nytimes.com/2024/01/01/news")).toBeNull()
    expect(screenUrl("https://youtube.com/watch?v=abc")).toBeNull()
  })

  it("flags .onion. proxy domains", () => {
    const result = screenUrl("https://something.onion.ws/page")
    expect(result).not.toBeNull()
    expect(result?.source).toBe("url_screening")
    expect(result?.severity).toBe("critical")
    expect(result?.categories).toContain("csam")
  })

  it("flags darknet-related domains", () => {
    const result = screenUrl("https://darknet-market.com/something")
    expect(result).not.toBeNull()
    expect(result?.severity).toBe("critical")
  })

  it("flags hidden wiki domains", () => {
    const result = screenUrl("https://hidden.wiki.example.com/")
    expect(result).not.toBeNull()
    expect(result?.severity).toBe("critical")
  })

  it("returns null for invalid URLs (graceful handling)", () => {
    expect(screenUrl("not-a-url")).toBeNull()
    expect(screenUrl("")).toBeNull()
  })
})

// =============================================================================
// screenText
// =============================================================================

describe("screenText", () => {
  it("returns empty array for normal content", () => {
    const normalText = "This is a perfectly normal article about technology. It discusses various aspects of software development, including best practices for code review and testing. The article covers many important topics that are relevant to modern engineering."
    const result = screenText(normalText)
    expect(result).toEqual([])
  })

  it("returns empty array for empty string", () => {
    expect(screenText("")).toEqual([])
  })

  it("returns empty array for very short text (below 50 chars)", () => {
    expect(screenText("Short text")).toEqual([])
  })

  it("returns empty array for whitespace-only text below 50 chars", () => {
    expect(screenText("   ")).toEqual([])
  })

  it("returns flags for CSAM indicators (co-occurrence pattern)", () => {
    // This uses the co-occurrence pattern: age-indicator + exploitation term within 200 chars
    const flaggedText = "This document contains concerning material about child exploitation and abuse that should be reported to authorities. " + "a".repeat(100)
    const result = screenText(flaggedText)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].categories).toContain("csam")
    expect(result[0].severity).toBe("critical")
    expect(result[0].source).toBe("keyword_screening")
  })

  it("deduplicates flags for the same category", () => {
    // Both CSAM patterns should match but produce only one flag due to dedup
    const flaggedText = "child exploitation and abuse of minor " + "a".repeat(200)
    const result = screenText(flaggedText)
    // Should have at most one CSAM flag even if multiple patterns match
    const csamFlags = result.filter(f => f.categories.includes("csam"))
    expect(csamFlags.length).toBeLessThanOrEqual(1)
  })

  it("does not flag news-style reporting with isolated keywords", () => {
    // Single words without co-occurrence should not trigger
    const newsText = "The child went to school. The teacher was nice. They learned about science and mathematics. " + "a".repeat(100)
    const result = screenText(newsText)
    expect(result).toEqual([])
  })
})

// =============================================================================
// detectAiRefusal
// =============================================================================

describe("detectAiRefusal", () => {
  it("returns null for normal JSON analysis output", () => {
    const result = detectAiRefusal({ summary: "This article discusses...", score: 8 })
    expect(result).toBeNull()
  })

  it("returns null for null input", () => {
    expect(detectAiRefusal(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(detectAiRefusal(undefined)).toBeNull()
  })

  it("detects JSON refusal format", () => {
    const result = detectAiRefusal({ refused: true, reason: "This content contains child exploitation material" })
    expect(result).not.toBeNull()
    expect(result?.source).toBe("ai_refusal")
    expect(result?.severity).toBe("high")
    expect(result?.categories).toContain("csam")
  })

  it("detects text refusal format", () => {
    const result = detectAiRefusal("CONTENT_REFUSED: This content discusses terrorism planning")
    expect(result).not.toBeNull()
    expect(result?.source).toBe("ai_refusal")
    expect(result?.categories).toContain("terrorism")
    expect(result?.reason).toContain("terrorism planning")
  })

  it("handles JSON refusal without specific category (defaults to terrorism)", () => {
    const result = detectAiRefusal({ refused: true, reason: "I cannot analyze this content" })
    expect(result).not.toBeNull()
    expect(result?.categories).toContain("terrorism")
  })

  it("detects weapons category in reason text", () => {
    const result = detectAiRefusal({ refused: true, reason: "Content about weapon manufacturing" })
    expect(result).not.toBeNull()
    expect(result?.categories).toContain("weapons")
  })

  it("detects trafficking category in reason text", () => {
    const result = detectAiRefusal({ refused: true, reason: "Content about human trafficking" })
    expect(result).not.toBeNull()
    expect(result?.categories).toContain("trafficking")
  })

  it("does not flag normal strings", () => {
    expect(detectAiRefusal("This is a normal analysis response")).toBeNull()
  })

  it("does not flag objects without refused:true", () => {
    expect(detectAiRefusal({ refused: false, reason: "test" })).toBeNull()
  })
})

// =============================================================================
// hashContent
// =============================================================================

describe("hashContent", () => {
  it("produces a hex string", () => {
    const hash = hashContent("test content")
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("produces consistent hashes for the same input", () => {
    const hash1 = hashContent("hello world")
    const hash2 = hashContent("hello world")
    expect(hash1).toBe(hash2)
  })

  it("produces different hashes for different input", () => {
    const hash1 = hashContent("input A")
    const hash2 = hashContent("input B")
    expect(hash1).not.toBe(hash2)
  })

  it("handles empty string", () => {
    const hash = hashContent("")
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

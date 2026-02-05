import { describe, it, expect } from "vitest"
import { generateShareToken } from "@/lib/share-token"

describe("generateShareToken", () => {
  it("generates a 12-character token", () => {
    const token = generateShareToken()
    expect(token).toHaveLength(12)
  })

  it("generates only alphanumeric characters (base62)", () => {
    const token = generateShareToken()
    expect(token).toMatch(/^[0-9A-Za-z]{12}$/)
  })

  it("generates different tokens on successive calls", () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 100; i++) {
      tokens.add(generateShareToken())
    }
    // With 62^12 possible combinations, 100 tokens should all be unique
    expect(tokens.size).toBe(100)
  })

  it("generates tokens with consistent format across multiple calls", () => {
    for (let i = 0; i < 20; i++) {
      const token = generateShareToken()
      expect(token).toHaveLength(12)
      expect(token).toMatch(/^[0-9A-Za-z]+$/)
    }
  })

  it("generates URL-safe tokens (no special characters)", () => {
    for (let i = 0; i < 50; i++) {
      const token = generateShareToken()
      // Should not contain any URL-unsafe characters
      expect(token).not.toMatch(/[^0-9A-Za-z]/)
      // Should be encodable in a URL without percent-encoding
      expect(encodeURIComponent(token)).toBe(token)
    }
  })
})

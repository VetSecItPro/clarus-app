import { describe, it, expect, beforeEach } from "vitest"
import { checkRateLimit } from "@/lib/rate-limit"

// ---------------------------------------------------------------------------
// In-memory fallback path tests (no UPSTASH_REDIS_* env vars in test env)
// ---------------------------------------------------------------------------

describe("checkRateLimit", () => {
  // Use a unique prefix per test to avoid cross-test pollution from the
  // in-memory Map that persists across calls within the same process.
  let id: string
  beforeEach(() => {
    id = `test:${Date.now()}:${Math.random()}`
  })

  // =========================================================================
  // Basic behavior
  // =========================================================================

  describe("first request", () => {
    it("allows the first request", async () => {
      const result = await checkRateLimit(id, 5, 60_000)
      expect(result.allowed).toBe(true)
    })

    it("reports remaining as maxRequests - 1 on first call", async () => {
      const result = await checkRateLimit(id, 5, 60_000)
      expect(result.remaining).toBe(4)
    })

    it("reports a positive resetIn on first call", async () => {
      const result = await checkRateLimit(id, 5, 60_000)
      expect(result.resetIn).toBeGreaterThan(0)
      expect(result.resetIn).toBeLessThanOrEqual(60_000)
    })
  })

  // =========================================================================
  // Within-limit behavior
  // =========================================================================

  describe("requests within limit", () => {
    it("allows multiple requests under the cap", async () => {
      const limit = 5
      for (let i = 0; i < limit; i++) {
        const result = await checkRateLimit(id, limit, 60_000)
        expect(result.allowed).toBe(true)
      }
    })

    it("decrements remaining with each request", async () => {
      const limit = 5
      for (let i = 0; i < limit; i++) {
        const result = await checkRateLimit(id, limit, 60_000)
        expect(result.remaining).toBe(limit - 1 - i)
      }
    })
  })

  // =========================================================================
  // Exceeding the limit
  // =========================================================================

  describe("blocking when limit exceeded", () => {
    it("blocks the request that exceeds maxRequests", async () => {
      const limit = 3
      // Exhaust the limit
      for (let i = 0; i < limit; i++) {
        await checkRateLimit(id, limit, 60_000)
      }
      // Next request should be blocked
      const blocked = await checkRateLimit(id, limit, 60_000)
      expect(blocked.allowed).toBe(false)
    })

    it("reports remaining as 0 when blocked", async () => {
      const limit = 2
      await checkRateLimit(id, limit, 60_000)
      await checkRateLimit(id, limit, 60_000)
      const blocked = await checkRateLimit(id, limit, 60_000)
      expect(blocked.remaining).toBe(0)
    })

    it("continues blocking subsequent requests after limit is hit", async () => {
      const limit = 1
      await checkRateLimit(id, limit, 60_000)
      const b1 = await checkRateLimit(id, limit, 60_000)
      const b2 = await checkRateLimit(id, limit, 60_000)
      expect(b1.allowed).toBe(false)
      expect(b2.allowed).toBe(false)
    })
  })

  // =========================================================================
  // resetIn timing
  // =========================================================================

  describe("resetIn timing", () => {
    it("resetIn is <= windowMs", async () => {
      const windowMs = 10_000
      const result = await checkRateLimit(id, 5, windowMs)
      expect(result.resetIn).toBeLessThanOrEqual(windowMs)
    })

    it("resetIn decreases between calls", async () => {
      const windowMs = 60_000
      const first = await checkRateLimit(id, 5, windowMs)
      // Small delay to let clock advance
      await new Promise((r) => setTimeout(r, 15))
      const second = await checkRateLimit(id, 5, windowMs)
      expect(second.resetIn).toBeLessThanOrEqual(first.resetIn)
    })

    it("resetIn is positive when blocked", async () => {
      const limit = 1
      await checkRateLimit(id, limit, 60_000)
      const blocked = await checkRateLimit(id, limit, 60_000)
      expect(blocked.resetIn).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // Default parameters
  // =========================================================================

  describe("default parameters", () => {
    it("uses defaults of 100 maxRequests and 60000 windowMs", async () => {
      const result = await checkRateLimit(id)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(99) // 100 - 1
      expect(result.resetIn).toBeLessThanOrEqual(60_000)
    })
  })

  // =========================================================================
  // Identifier isolation
  // =========================================================================

  describe("identifier isolation", () => {
    it("different identifiers have independent limits", async () => {
      const idA = `${id}:a`
      const idB = `${id}:b`
      const limit = 1

      await checkRateLimit(idA, limit, 60_000)
      const blockedA = await checkRateLimit(idA, limit, 60_000)
      const allowedB = await checkRateLimit(idB, limit, 60_000)

      expect(blockedA.allowed).toBe(false)
      expect(allowedB.allowed).toBe(true)
    })

    it("different identifiers maintain separate remaining counts", async () => {
      const idA = `${id}:x`
      const idB = `${id}:y`

      await checkRateLimit(idA, 10, 60_000)
      await checkRateLimit(idA, 10, 60_000)
      await checkRateLimit(idA, 10, 60_000)

      const resultA = await checkRateLimit(idA, 10, 60_000)
      const resultB = await checkRateLimit(idB, 10, 60_000)

      expect(resultA.remaining).toBe(6) // 10 - 4
      expect(resultB.remaining).toBe(9) // 10 - 1
    })
  })

  // =========================================================================
  // Concurrent calls
  // =========================================================================

  describe("concurrent calls", () => {
    it("handles concurrent calls to the same identifier correctly", async () => {
      const limit = 5
      const results = await Promise.all(
        Array.from({ length: limit + 2 }, () => checkRateLimit(id, limit, 60_000))
      )

      const allowed = results.filter((r) => r.allowed)
      const blocked = results.filter((r) => !r.allowed)

      expect(allowed.length).toBe(limit)
      expect(blocked.length).toBe(2)
    })
  })

  // =========================================================================
  // Return type shape
  // =========================================================================

  describe("return value shape", () => {
    it("returns an object with allowed, remaining, and resetIn", async () => {
      const result = await checkRateLimit(id, 5, 60_000)
      expect(result).toHaveProperty("allowed")
      expect(result).toHaveProperty("remaining")
      expect(result).toHaveProperty("resetIn")
      expect(typeof result.allowed).toBe("boolean")
      expect(typeof result.remaining).toBe("number")
      expect(typeof result.resetIn).toBe("number")
    })
  })
})

import { describe, it, expect, beforeEach } from "vitest"
import { validateUrl, validateUUID, validateContentId, validateChatMessage, checkRateLimit } from "@/lib/validation"

// =============================================================================
// validateUrl
// =============================================================================

describe("validateUrl", () => {
  describe("valid URLs", () => {
    it("accepts a standard HTTPS URL", () => {
      const result = validateUrl("https://example.com/article")
      expect(result.isValid).toBe(true)
      expect(result.sanitized).toBe("https://example.com/article")
    })

    it("accepts an HTTP URL", () => {
      const result = validateUrl("http://example.com/page")
      expect(result.isValid).toBe(true)
      expect(result.sanitized).toBe("http://example.com/page")
    })

    it("accepts a YouTube URL", () => {
      const result = validateUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
      expect(result.isValid).toBe(true)
      expect(result.sanitized).toContain("youtube.com")
    })

    it("accepts a Twitter/X URL", () => {
      const result = validateUrl("https://x.com/user/status/123456")
      expect(result.isValid).toBe(true)
      expect(result.sanitized).toContain("x.com")
    })

    it("accepts a URL with query parameters", () => {
      const result = validateUrl("https://example.com/search?q=hello&page=2")
      expect(result.isValid).toBe(true)
      expect(result.sanitized).toContain("q=hello")
    })

    it("trims whitespace from input", () => {
      const result = validateUrl("  https://example.com  ")
      expect(result.isValid).toBe(true)
      expect(result.sanitized).toBe("https://example.com/")
    })
  })

  describe("invalid URLs", () => {
    it("rejects empty string", () => {
      const result = validateUrl("")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("URL is required")
    })

    it("rejects null-like values", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = validateUrl(null as any)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("URL is required")
    })

    it("rejects malformed URLs", () => {
      const result = validateUrl("not-a-url")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Invalid URL format")
    })

    it("rejects javascript: scheme", () => {
      const result = validateUrl("javascript:alert('xss')")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Invalid URL scheme")
    })

    it("rejects data: scheme", () => {
      const result = validateUrl("data:text/html,<script>alert(1)</script>")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Invalid URL scheme")
    })

    it("rejects vbscript: scheme", () => {
      const result = validateUrl("vbscript:msgbox('xss')")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Invalid URL scheme")
    })

    it("rejects file: scheme", () => {
      const result = validateUrl("file:///etc/passwd")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Invalid URL scheme")
    })

    it("rejects ftp: protocol", () => {
      const result = validateUrl("ftp://example.com/file")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Only HTTP and HTTPS URLs are allowed")
    })

    it("rejects URLs longer than 2048 characters", () => {
      const longUrl = "https://example.com/" + "a".repeat(2048)
      const result = validateUrl(longUrl)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("URL is too long (max 2048 characters)")
    })
  })

  describe("SSRF prevention", () => {
    it("blocks localhost", () => {
      const result = validateUrl("http://localhost:3000/api/secret")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks 127.0.0.1", () => {
      const result = validateUrl("http://127.0.0.1/admin")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks 0.0.0.0", () => {
      const result = validateUrl("http://0.0.0.0/")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks 10.x.x.x private range", () => {
      const result = validateUrl("http://10.0.0.1/internal")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks 192.168.x.x private range", () => {
      const result = validateUrl("http://192.168.1.1/router")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks 172.16-31.x.x private range", () => {
      const result16 = validateUrl("http://172.16.0.1/")
      expect(result16.isValid).toBe(false)

      const result31 = validateUrl("http://172.31.255.255/")
      expect(result31.isValid).toBe(false)
    })

    it("allows 172.15.x.x and 172.32.x.x (not in private range)", () => {
      const result15 = validateUrl("http://172.15.0.1/")
      expect(result15.isValid).toBe(true)

      const result32 = validateUrl("http://172.32.0.1/")
      expect(result32.isValid).toBe(true)
    })

    it("blocks AWS metadata endpoint 169.254.169.254", () => {
      const result = validateUrl("http://169.254.169.254/latest/meta-data/")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks GCP metadata endpoint", () => {
      const result = validateUrl("http://metadata.google.internal/computeMetadata/v1/")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks link-local range 169.254.x.x", () => {
      const result = validateUrl("http://169.254.1.1/")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks IPv6 loopback ::1", () => {
      const result = validateUrl("http://[::1]/")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks IPv6-mapped IPv4 addresses", () => {
      const result = validateUrl("http://[::ffff:127.0.0.1]/")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks decimal IP notation (2130706433 = 127.0.0.1)", () => {
      const result = validateUrl("http://2130706433/")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks hex IP notation", () => {
      const result = validateUrl("http://0x7f000001/")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })

    it("blocks octal IP notation", () => {
      const result = validateUrl("http://0177.0.0.1/")
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Internal URLs are not allowed")
    })
  })
})

// =============================================================================
// validateUUID
// =============================================================================

describe("validateUUID", () => {
  it("accepts a valid UUID v4", () => {
    const result = validateUUID("550e8400-e29b-41d4-a716-446655440000")
    expect(result.isValid).toBe(true)
    expect(result.sanitized).toBe("550e8400-e29b-41d4-a716-446655440000")
  })

  it("accepts uppercase UUID and lowercases it", () => {
    const result = validateUUID("550E8400-E29B-41D4-A716-446655440000")
    expect(result.isValid).toBe(true)
    expect(result.sanitized).toBe("550e8400-e29b-41d4-a716-446655440000")
  })

  it("trims whitespace", () => {
    const result = validateUUID("  550e8400-e29b-41d4-a716-446655440000  ")
    expect(result.isValid).toBe(true)
    expect(result.sanitized).toBe("550e8400-e29b-41d4-a716-446655440000")
  })

  it("rejects empty string", () => {
    const result = validateUUID("")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("ID is required")
  })

  it("rejects non-UUID strings", () => {
    const result = validateUUID("not-a-uuid")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Invalid ID format")
  })

  it("rejects UUID v1 format (wrong version digit)", () => {
    const result = validateUUID("550e8400-e29b-11d4-a716-446655440000")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Invalid ID format")
  })
})

// =============================================================================
// validateContentId
// =============================================================================

describe("validateContentId", () => {
  it("delegates to validateUUID", () => {
    const result = validateContentId("550e8400-e29b-41d4-a716-446655440000")
    expect(result.isValid).toBe(true)
    expect(result.sanitized).toBe("550e8400-e29b-41d4-a716-446655440000")
  })

  it("rejects invalid content IDs", () => {
    const result = validateContentId("bad-id")
    expect(result.isValid).toBe(false)
  })
})

// =============================================================================
// validateChatMessage
// =============================================================================

describe("validateChatMessage", () => {
  it("accepts a normal message", () => {
    const result = validateChatMessage("What is the main argument?")
    expect(result.isValid).toBe(true)
    expect(result.sanitized).toBe("What is the main argument?")
  })

  it("rejects empty string", () => {
    const result = validateChatMessage("")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Message is required")
  })

  it("rejects whitespace-only string", () => {
    const result = validateChatMessage("   ")
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Message cannot be empty")
  })

  it("rejects messages over 10000 characters", () => {
    const longMsg = "a".repeat(10001)
    const result = validateChatMessage(longMsg)
    expect(result.isValid).toBe(false)
    expect(result.error).toBe("Message is too long (max 10000 characters)")
  })

  it("strips script tags", () => {
    const result = validateChatMessage('Hello <script>alert("xss")</script> world')
    expect(result.isValid).toBe(true)
    expect(result.sanitized).not.toContain("<script>")
    expect(result.sanitized).toContain("Hello")
    expect(result.sanitized).toContain("world")
  })

  it("strips inline event handlers", () => {
    const result = validateChatMessage('Click <div onmouseover="steal()">here</div>')
    expect(result.isValid).toBe(true)
    expect(result.sanitized).not.toMatch(/onmouseover\s*=/)
  })
})

// =============================================================================
// checkRateLimit
// =============================================================================

describe("checkRateLimit", () => {
  // Use unique identifiers per test to avoid cross-test contamination
  // since the rate limit map is module-level state

  it("allows the first request", () => {
    const id = `test-first-${Date.now()}-${Math.random()}`
    const result = checkRateLimit(id, 5, 60000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("allows requests within the limit", () => {
    const id = `test-within-${Date.now()}-${Math.random()}`
    for (let i = 0; i < 4; i++) {
      const result = checkRateLimit(id, 5, 60000)
      expect(result.allowed).toBe(true)
    }
  })

  it("blocks requests when limit is exceeded", () => {
    const id = `test-exceed-${Date.now()}-${Math.random()}`
    // Use up all 3 allowed requests
    for (let i = 0; i < 3; i++) {
      checkRateLimit(id, 3, 60000)
    }
    // 4th request should be blocked
    const result = checkRateLimit(id, 3, 60000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.resetIn).toBeGreaterThan(0)
  })

  it("tracks remaining count correctly", () => {
    const id = `test-remaining-${Date.now()}-${Math.random()}`
    const r1 = checkRateLimit(id, 5, 60000)
    expect(r1.remaining).toBe(4)
    const r2 = checkRateLimit(id, 5, 60000)
    expect(r2.remaining).toBe(3)
    const r3 = checkRateLimit(id, 5, 60000)
    expect(r3.remaining).toBe(2)
  })

  it("provides resetIn in milliseconds", () => {
    const id = `test-reset-${Date.now()}-${Math.random()}`
    const result = checkRateLimit(id, 5, 30000)
    expect(result.resetIn).toBeLessThanOrEqual(30000)
    expect(result.resetIn).toBeGreaterThan(0)
  })

  it("uses default values (100 requests, 60s window)", () => {
    const id = `test-defaults-${Date.now()}-${Math.random()}`
    const result = checkRateLimit(id)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(99)
  })
})

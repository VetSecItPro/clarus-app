import { describe, it, expect } from "vitest"
import {
  uuidSchema,
  safeUrlSchema,
  emailSchema,
  chatMessageSchema,
  safeTextSchema,
  processContentSchema,
  chatRequestSchema,
  searchSchema,
  tagsUpdateSchema,
  bookmarkUpdateSchema,
  updateNameSchema,
  contactFormSchema,
  digestPreferencesSchema,
  exportSchema,
  updatePreferencesSchema,
  createCollectionSchema,
  compareContentSchema,
  translateContentSchema,
  polarCheckoutSchema,
  parseBody,
  parseQuery,
  COLLECTION_COLORS,
} from "@/lib/schemas"

// =============================================================================
// uuidSchema
// =============================================================================

describe("uuidSchema", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

  it("accepts a valid UUID v4", () => {
    const result = uuidSchema.safeParse(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(VALID_UUID)
  })

  it("accepts uppercase UUID and lowercases it", () => {
    const result = uuidSchema.safeParse("550E8400-E29B-41D4-A716-446655440000")
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(VALID_UUID)
  })

  it("trims whitespace", () => {
    const result = uuidSchema.safeParse("  550e8400-e29b-41d4-a716-446655440000  ")
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(VALID_UUID)
  })

  it("rejects UUID v1 (wrong version digit)", () => {
    const result = uuidSchema.safeParse("550e8400-e29b-11d4-a716-446655440000")
    expect(result.success).toBe(false)
  })

  it("rejects non-UUID strings", () => {
    const result = uuidSchema.safeParse("not-a-uuid")
    expect(result.success).toBe(false)
  })

  it("rejects empty string", () => {
    const result = uuidSchema.safeParse("")
    expect(result.success).toBe(false)
  })

  it("rejects UUID with wrong variant bits", () => {
    // variant bits should be 8, 9, a, or b in position 19
    const result = uuidSchema.safeParse("550e8400-e29b-41d4-0716-446655440000")
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// safeUrlSchema
// =============================================================================

describe("safeUrlSchema", () => {
  it("accepts a valid HTTPS URL", () => {
    const result = safeUrlSchema.safeParse("https://example.com/article")
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toContain("example.com")
  })

  it("accepts an HTTP URL", () => {
    const result = safeUrlSchema.safeParse("http://example.com/page")
    expect(result.success).toBe(true)
  })

  it("normalizes URL via URL constructor (adds trailing slash)", () => {
    const result = safeUrlSchema.safeParse("https://example.com")
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe("https://example.com/")
  })

  it("rejects javascript: scheme", () => {
    const result = safeUrlSchema.safeParse("javascript:alert('xss')")
    expect(result.success).toBe(false)
  })

  it("rejects data: scheme", () => {
    const result = safeUrlSchema.safeParse("data:text/html,<h1>hi</h1>")
    expect(result.success).toBe(false)
  })

  it("rejects vbscript: scheme", () => {
    const result = safeUrlSchema.safeParse("vbscript:msgbox('x')")
    expect(result.success).toBe(false)
  })

  it("rejects file: scheme", () => {
    const result = safeUrlSchema.safeParse("file:///etc/passwd")
    expect(result.success).toBe(false)
  })

  it("rejects ftp: protocol", () => {
    const result = safeUrlSchema.safeParse("ftp://example.com/file")
    expect(result.success).toBe(false)
  })

  it("rejects URLs longer than 2048 characters", () => {
    const longUrl = "https://example.com/" + "a".repeat(2048)
    const result = safeUrlSchema.safeParse(longUrl)
    expect(result.success).toBe(false)
  })

  it("blocks localhost (SSRF)", () => {
    const result = safeUrlSchema.safeParse("http://localhost:3000/api/secret")
    expect(result.success).toBe(false)
  })

  it("blocks 127.0.0.1 (SSRF)", () => {
    const result = safeUrlSchema.safeParse("http://127.0.0.1/admin")
    expect(result.success).toBe(false)
  })

  it("blocks 10.x.x.x private range", () => {
    const result = safeUrlSchema.safeParse("http://10.0.0.1/internal")
    expect(result.success).toBe(false)
  })

  it("blocks 192.168.x.x private range", () => {
    const result = safeUrlSchema.safeParse("http://192.168.1.1/router")
    expect(result.success).toBe(false)
  })

  it("blocks 172.16-31.x.x private range", () => {
    expect(safeUrlSchema.safeParse("http://172.16.0.1/").success).toBe(false)
    expect(safeUrlSchema.safeParse("http://172.31.255.255/").success).toBe(false)
  })

  it("allows 172.15.x.x and 172.32.x.x (not private)", () => {
    expect(safeUrlSchema.safeParse("http://172.15.0.1/").success).toBe(true)
    expect(safeUrlSchema.safeParse("http://172.32.0.1/").success).toBe(true)
  })

  it("blocks AWS metadata endpoint 169.254.169.254", () => {
    const result = safeUrlSchema.safeParse("http://169.254.169.254/latest/meta-data/")
    expect(result.success).toBe(false)
  })

  it("blocks GCP metadata endpoint", () => {
    const result = safeUrlSchema.safeParse("http://metadata.google.internal/computeMetadata/v1/")
    expect(result.success).toBe(false)
  })

  it("blocks IPv6 loopback ::1", () => {
    const result = safeUrlSchema.safeParse("http://[::1]/")
    expect(result.success).toBe(false)
  })

  it("blocks IPv6-mapped IPv4", () => {
    const result = safeUrlSchema.safeParse("http://[::ffff:127.0.0.1]/")
    expect(result.success).toBe(false)
  })

  it("blocks decimal IP notation (2130706433)", () => {
    const result = safeUrlSchema.safeParse("http://2130706433/")
    expect(result.success).toBe(false)
  })

  it("blocks hex IP notation (0x7f000001)", () => {
    const result = safeUrlSchema.safeParse("http://0x7f000001/")
    expect(result.success).toBe(false)
  })

  it("blocks octal dotted IP notation (0177.0.0.1)", () => {
    const result = safeUrlSchema.safeParse("http://0177.0.0.1/")
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// emailSchema
// =============================================================================

describe("emailSchema", () => {
  it("accepts a valid email", () => {
    const result = emailSchema.safeParse("user@example.com")
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe("user@example.com")
  })

  it("trims whitespace", () => {
    const result = emailSchema.safeParse("  user@example.com  ")
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe("user@example.com")
  })

  it("rejects invalid email format", () => {
    const result = emailSchema.safeParse("not-an-email")
    expect(result.success).toBe(false)
  })

  it("rejects email with newline (header injection)", () => {
    const result = emailSchema.safeParse("user@example.com\nBcc: evil@hacker.com")
    expect(result.success).toBe(false)
  })

  it("rejects email with carriage return (header injection)", () => {
    const result = emailSchema.safeParse("user@example.com\rBcc: evil@hacker.com")
    expect(result.success).toBe(false)
  })

  it("rejects email longer than 254 characters", () => {
    const longEmail = "a".repeat(250) + "@b.com"
    const result = emailSchema.safeParse(longEmail)
    expect(result.success).toBe(false)
  })

  it("rejects empty string", () => {
    const result = emailSchema.safeParse("")
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// chatMessageSchema
// =============================================================================

describe("chatMessageSchema", () => {
  it("accepts a normal message", () => {
    const result = chatMessageSchema.safeParse("What is the main argument?")
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe("What is the main argument?")
  })

  it("rejects empty string", () => {
    const result = chatMessageSchema.safeParse("")
    expect(result.success).toBe(false)
  })

  it("rejects messages over 10000 characters", () => {
    const result = chatMessageSchema.safeParse("a".repeat(10001))
    expect(result.success).toBe(false)
  })

  it("strips script tags from message", () => {
    const result = chatMessageSchema.safeParse('Hello <script>alert("xss")</script> world')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toContain("<script>")
      expect(result.data).toContain("Hello")
      expect(result.data).toContain("world")
    }
  })

  it("strips inline event handlers", () => {
    const result = chatMessageSchema.safeParse('Click <div onmouseover="steal()">here</div>')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).not.toMatch(/onmouseover\s*=/)
  })

  it("strips javascript: protocol references", () => {
    const result = chatMessageSchema.safeParse("Visit javascript:void(0) now")
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).not.toContain("javascript:")
  })
})

// =============================================================================
// safeTextSchema
// =============================================================================

describe("safeTextSchema", () => {
  it("accepts normal text", () => {
    const result = safeTextSchema.safeParse("Normal text content")
    expect(result.success).toBe(true)
  })

  it("rejects text over 10000 characters", () => {
    const result = safeTextSchema.safeParse("x".repeat(10001))
    expect(result.success).toBe(false)
  })

  it("strips XSS patterns", () => {
    const result = safeTextSchema.safeParse('<script>alert(1)</script>Safe text')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toContain("<script>")
      expect(result.data).toContain("Safe text")
    }
  })
})

// =============================================================================
// processContentSchema
// =============================================================================

describe("processContentSchema", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

  it("accepts valid content_id with defaults", () => {
    const result = processContentSchema.safeParse({ content_id: VALID_UUID })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.content_id).toBe(VALID_UUID)
      expect(result.data.force_regenerate).toBe(false)
      expect(result.data.language).toBe("en")
      expect(result.data.skipScraping).toBe(false)
    }
  })

  it("accepts all optional fields", () => {
    const result = processContentSchema.safeParse({
      content_id: VALID_UUID,
      force_regenerate: true,
      language: "fr",
      skipScraping: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.force_regenerate).toBe(true)
      expect(result.data.language).toBe("fr")
      expect(result.data.skipScraping).toBe(true)
    }
  })

  it("rejects invalid content_id", () => {
    const result = processContentSchema.safeParse({ content_id: "bad" })
    expect(result.success).toBe(false)
  })

  it("rejects missing content_id", () => {
    const result = processContentSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// chatRequestSchema
// =============================================================================

describe("chatRequestSchema", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

  it("accepts valid request with required fields", () => {
    const result = chatRequestSchema.safeParse({
      message: "Tell me more",
      summary_id: VALID_UUID,
    })
    expect(result.success).toBe(true)
  })

  it("accepts optional thread_id", () => {
    const result = chatRequestSchema.safeParse({
      message: "Tell me more",
      summary_id: VALID_UUID,
      thread_id: VALID_UUID,
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty message", () => {
    const result = chatRequestSchema.safeParse({
      message: "",
      summary_id: VALID_UUID,
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing summary_id", () => {
    const result = chatRequestSchema.safeParse({
      message: "Hello",
    })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// searchSchema
// =============================================================================

describe("searchSchema", () => {
  it("accepts valid search with defaults", () => {
    const result = searchSchema.safeParse({ q: "climate change" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(20)
      expect(result.data.offset).toBe(0)
    }
  })

  it("accepts content_type filter", () => {
    const result = searchSchema.safeParse({ q: "test", content_type: "youtube" })
    expect(result.success).toBe(true)
  })

  it("rejects empty query", () => {
    const result = searchSchema.safeParse({ q: "" })
    expect(result.success).toBe(false)
  })

  it("coerces numeric limit and offset", () => {
    const result = searchSchema.safeParse({ q: "test", limit: "10", offset: "5" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(10)
      expect(result.data.offset).toBe(5)
    }
  })

  it("rejects limit over 100", () => {
    const result = searchSchema.safeParse({ q: "test", limit: 101 })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// updatePreferencesSchema
// =============================================================================

describe("updatePreferencesSchema", () => {
  it("accepts valid analysis mode", () => {
    const result = updatePreferencesSchema.safeParse({ analysis_mode: "learn" })
    expect(result.success).toBe(true)
  })

  it("accepts valid expertise level", () => {
    const result = updatePreferencesSchema.safeParse({ expertise_level: "expert" })
    expect(result.success).toBe(true)
  })

  it("accepts valid focus areas (up to 3, no duplicates)", () => {
    const result = updatePreferencesSchema.safeParse({
      focus_areas: ["accuracy", "depth", "bias"],
    })
    expect(result.success).toBe(true)
  })

  it("rejects more than 3 focus areas", () => {
    const result = updatePreferencesSchema.safeParse({
      focus_areas: ["accuracy", "depth", "bias", "novelty"],
    })
    expect(result.success).toBe(false)
  })

  it("rejects duplicate focus areas", () => {
    const result = updatePreferencesSchema.safeParse({
      focus_areas: ["accuracy", "accuracy"],
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid analysis mode", () => {
    const result = updatePreferencesSchema.safeParse({ analysis_mode: "invalid" })
    expect(result.success).toBe(false)
  })

  it("accepts is_active boolean", () => {
    const result = updatePreferencesSchema.safeParse({ is_active: true })
    expect(result.success).toBe(true)
  })
})

// =============================================================================
// createCollectionSchema
// =============================================================================

describe("createCollectionSchema", () => {
  it("accepts valid collection with name only", () => {
    const result = createCollectionSchema.safeParse({ name: "My Collection" })
    expect(result.success).toBe(true)
  })

  it("accepts valid preset color", () => {
    const result = createCollectionSchema.safeParse({ name: "Test", color: "#1d9bf0" })
    expect(result.success).toBe(true)
  })

  it("rejects non-preset color", () => {
    const result = createCollectionSchema.safeParse({ name: "Test", color: "#ff0000" })
    expect(result.success).toBe(false)
  })

  it("rejects empty name", () => {
    const result = createCollectionSchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
  })

  it("strips XSS from collection name", () => {
    const result = createCollectionSchema.safeParse({
      name: 'My <script>alert(1)</script> Collection',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).not.toContain("<script>")
    }
  })

  it("rejects name over 100 characters", () => {
    const result = createCollectionSchema.safeParse({ name: "x".repeat(101) })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// contactFormSchema
// =============================================================================

describe("contactFormSchema", () => {
  it("accepts valid contact form data", () => {
    const result = contactFormSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      subject: "Bug report",
      message: "I found a bug in the application that needs fixing.",
    })
    expect(result.success).toBe(true)
  })

  it("rejects message shorter than 10 characters", () => {
    const result = contactFormSchema.safeParse({
      name: "John",
      email: "john@example.com",
      subject: "Bug",
      message: "Short",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing name", () => {
    const result = contactFormSchema.safeParse({
      email: "john@example.com",
      subject: "Bug",
      message: "This is a valid message length for testing.",
    })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// polarCheckoutSchema
// =============================================================================

describe("polarCheckoutSchema", () => {
  it("accepts valid tier", () => {
    const result = polarCheckoutSchema.safeParse({ tier: "pro" })
    expect(result.success).toBe(true)
  })

  it("accepts tier with interval", () => {
    const result = polarCheckoutSchema.safeParse({ tier: "starter", interval: "annual" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid tier", () => {
    const result = polarCheckoutSchema.safeParse({ tier: "enterprise" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid interval", () => {
    const result = polarCheckoutSchema.safeParse({ tier: "pro", interval: "weekly" })
    expect(result.success).toBe(false)
  })

  it("accepts day_pass tier", () => {
    const result = polarCheckoutSchema.safeParse({ tier: "day_pass" })
    expect(result.success).toBe(true)
  })
})

// =============================================================================
// compareContentSchema
// =============================================================================

describe("compareContentSchema", () => {
  const UUID_1 = "550e8400-e29b-41d4-a716-446655440000"
  const UUID_2 = "660e8400-e29b-41d4-a716-446655440000"
  const UUID_3 = "770e8400-e29b-41d4-a716-446655440000"

  it("accepts 2 content IDs", () => {
    const result = compareContentSchema.safeParse({ contentIds: [UUID_1, UUID_2] })
    expect(result.success).toBe(true)
  })

  it("accepts 3 content IDs", () => {
    const result = compareContentSchema.safeParse({ contentIds: [UUID_1, UUID_2, UUID_3] })
    expect(result.success).toBe(true)
  })

  it("rejects 1 content ID (minimum 2)", () => {
    const result = compareContentSchema.safeParse({ contentIds: [UUID_1] })
    expect(result.success).toBe(false)
  })

  it("rejects 4 content IDs (maximum 3)", () => {
    const result = compareContentSchema.safeParse({
      contentIds: [UUID_1, UUID_2, UUID_3, "880e8400-e29b-41d4-a716-446655440000"],
    })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// parseBody
// =============================================================================

describe("parseBody", () => {
  it("returns success with parsed data for valid input", () => {
    const result = parseBody(processContentSchema, {
      content_id: "550e8400-e29b-41d4-a716-446655440000",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.content_id).toBe("550e8400-e29b-41d4-a716-446655440000")
    }
  })

  it("returns failure with error message for invalid input", () => {
    const result = parseBody(processContentSchema, { content_id: "bad" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTruthy()
      expect(typeof result.error).toBe("string")
    }
  })

  it("returns failure for completely wrong shape", () => {
    const result = parseBody(processContentSchema, { wrong_field: 123 })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// parseQuery
// =============================================================================

describe("parseQuery", () => {
  it("parses URLSearchParams correctly", () => {
    const params = new URLSearchParams("q=hello&limit=10")
    const result = parseQuery(searchSchema, params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.q).toBe("hello")
      expect(result.data.limit).toBe(10)
    }
  })

  it("returns failure for invalid query params", () => {
    const params = new URLSearchParams("q=&limit=abc")
    const result = parseQuery(searchSchema, params)
    expect(result.success).toBe(false)
  })

  it("uses default values when params are missing", () => {
    const params = new URLSearchParams("q=test")
    const result = parseQuery(searchSchema, params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(20)
      expect(result.data.offset).toBe(0)
    }
  })
})

// =============================================================================
// Additional schema quick checks
// =============================================================================

describe("tagsUpdateSchema", () => {
  it("accepts valid tags array", () => {
    const result = tagsUpdateSchema.safeParse({ tags: ["tag1", "tag2"] })
    expect(result.success).toBe(true)
  })

  it("rejects more than 20 tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`)
    const result = tagsUpdateSchema.safeParse({ tags })
    expect(result.success).toBe(false)
  })
})

describe("bookmarkUpdateSchema", () => {
  it("accepts boolean is_bookmarked", () => {
    expect(bookmarkUpdateSchema.safeParse({ is_bookmarked: true }).success).toBe(true)
    expect(bookmarkUpdateSchema.safeParse({ is_bookmarked: false }).success).toBe(true)
  })

  it("rejects non-boolean", () => {
    expect(bookmarkUpdateSchema.safeParse({ is_bookmarked: "yes" }).success).toBe(false)
  })
})

describe("digestPreferencesSchema", () => {
  it("accepts boolean digest_enabled", () => {
    expect(digestPreferencesSchema.safeParse({ digest_enabled: true }).success).toBe(true)
  })

  it("rejects non-boolean", () => {
    expect(digestPreferencesSchema.safeParse({ digest_enabled: 1 }).success).toBe(false)
  })
})

describe("exportSchema", () => {
  it("accepts valid UUID id", () => {
    const result = exportSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid id", () => {
    expect(exportSchema.safeParse({ id: "bad" }).success).toBe(false)
  })
})

describe("updateNameSchema", () => {
  it("accepts valid username", () => {
    const result = updateNameSchema.safeParse({ name: "john_doe" })
    expect(result.success).toBe(true)
  })

  it("rejects username shorter than 3 chars", () => {
    expect(updateNameSchema.safeParse({ name: "ab" }).success).toBe(false)
  })

  it("rejects username with special characters", () => {
    expect(updateNameSchema.safeParse({ name: "john@doe" }).success).toBe(false)
  })
})

describe("translateContentSchema", () => {
  it("accepts valid language code", () => {
    expect(translateContentSchema.safeParse({ language: "es" }).success).toBe(true)
  })

  it("rejects too-short language code", () => {
    expect(translateContentSchema.safeParse({ language: "a" }).success).toBe(false)
  })
})

describe("COLLECTION_COLORS", () => {
  it("exports 8 preset colors", () => {
    expect(COLLECTION_COLORS).toHaveLength(8)
  })

  it("all colors are valid hex strings", () => {
    for (const color of COLLECTION_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

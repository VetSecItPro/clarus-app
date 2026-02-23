import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

// Rate limiting — always allow by default
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Auth — controllable per test
let mockAuthSuccess = true
const mockUser = { id: "user-abc-123", email: "test@clarusapp.io" }

vi.mock("@/lib/auth", async () => {
  const { NextResponse } = await import("next/server")
  return {
    authenticateRequest: vi.fn(async () => {
      if (!mockAuthSuccess) {
        return {
          success: false,
          response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
        }
      }
      return { success: true, user: mockUser, supabase: {} }
    }),
    AuthErrors: {
      rateLimit: (resetIn: number) =>
        NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
        ),
    },
  }
})

// URL validation — used for SSRF redirect protection
const mockValidateUrl = vi.fn()
vi.mock("@/lib/validation", () => ({
  validateUrl: (...args: unknown[]) => mockValidateUrl(...args),
}))

// =============================================================================
// Import handler AFTER mocks are in place
// =============================================================================

import { POST } from "@/app/api/fetch-title/route"

// =============================================================================
// Helpers
// =============================================================================

const VALID_URL = "https://example.com/article"

// Mock global fetch for outbound HTTP requests
const mockFetch = vi.fn()
global.fetch = mockFetch

function createRequest(body: unknown, ip = "1.2.3.4") {
  return new NextRequest("https://clarusapp.io/api/fetch-title", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  })
}

/**
 * Build a fake streaming response that returns HTML with a <title>.
 */
function buildStreamResponse(html: string, status = 200, ok = true) {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(html)

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded)
      controller.close()
    },
  })

  return {
    ok,
    status,
    body: stream,
    headers: new Headers({ "content-type": "text/html" }),
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/fetch-title", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })

    // Default: URL validation passes
    mockValidateUrl.mockReturnValue({ isValid: true, sanitized: VALID_URL })

    // Default: outbound fetch returns HTML with title
    mockFetch.mockResolvedValue(
      buildStreamResponse("<html><head><title>Test Page Title</title></head></html>")
    )
  })

  // ---------------------------------------------------------------------------
  // Rate limiting — 429 (checked BEFORE auth in this route)
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 60000 })

    const req = createRequest({ url: VALID_URL })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
    expect(response.headers.get("Retry-After")).toBe("60")
  })

  it("uses the client IP for rate limit key", async () => {
    const req = createRequest({ url: VALID_URL }, "5.6.7.8")
    await POST(req)

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "fetch-title:5.6.7.8",
      30,
      60000
    )
  })

  it("uses 'unknown' as IP key when no forwarded-for header is present", async () => {
    const req = new NextRequest("https://clarusapp.io/api/fetch-title", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: VALID_URL }),
    })
    await POST(req)

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "fetch-title:unknown",
      30,
      60000
    )
  })

  // ---------------------------------------------------------------------------
  // Authentication — 401 (checked AFTER rate limit)
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const req = createRequest({ url: VALID_URL })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Request body validation — 400
  // ---------------------------------------------------------------------------

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("https://clarusapp.io/api/fetch-title", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
      body: "not valid json{{",
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid JSON")
  })

  it("returns 400 when url field is missing", async () => {
    const req = createRequest({})
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when url is an internal/SSRF URL (blocked by safeUrlSchema)", async () => {
    const req = createRequest({ url: "http://localhost/admin" })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when url uses a dangerous scheme (javascript:)", async () => {
    const req = createRequest({ url: "javascript:alert(1)" })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Title extraction — 200
  // ---------------------------------------------------------------------------

  it("returns 200 with extracted title from HTML", async () => {
    mockFetch.mockResolvedValue(
      buildStreamResponse("<html><head><title>My Article Title</title></head></html>")
    )

    const req = createRequest({ url: VALID_URL })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBe("My Article Title")
  })

  it("returns 200 with null title when page has no <title> tag", async () => {
    mockFetch.mockResolvedValue(
      buildStreamResponse("<html><head></head><body>No title here</body></html>")
    )

    const req = createRequest({ url: VALID_URL })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBeNull()
  })

  it("returns 200 with null title when the remote page returns a non-OK status", async () => {
    mockFetch.mockResolvedValue(buildStreamResponse("", 404, false))

    const req = createRequest({ url: VALID_URL })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBeNull()
  })

  it("normalizes whitespace in extracted title", async () => {
    mockFetch.mockResolvedValue(
      buildStreamResponse("<html><head><title>  Article  With  Spaces  </title></head></html>")
    )

    const req = createRequest({ url: VALID_URL })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBe("Article With Spaces")
  })

  it("decodes HTML entities in title (&amp; &lt; &gt; &quot;)", async () => {
    mockFetch.mockResolvedValue(
      buildStreamResponse('<html><head><title>A &amp; B &lt;test&gt; &quot;quoted&quot;</title></head></html>')
    )

    const req = createRequest({ url: VALID_URL })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBe('A & B <test> "quoted"')
  })

  it("returns 200 with null title when fetch throws (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("Network connection refused"))

    const req = createRequest({ url: VALID_URL })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Redirect handling
  // ---------------------------------------------------------------------------

  it("returns 200 with null title when redirect has no location header", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 301,
      headers: new Headers({}),
      body: null,
    })

    const req = createRequest({ url: VALID_URL })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBeNull()
  })

  it("returns 200 with null title when redirect target fails SSRF validation", async () => {
    // First call: redirect to internal IP
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: new Headers({ location: "http://169.254.169.254/metadata" }),
      body: null,
    })
    mockValidateUrl.mockReturnValueOnce({ isValid: false, error: "Internal URLs are not allowed" })

    const req = createRequest({ url: VALID_URL })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBeNull()
  })

  it("follows a valid redirect and extracts title from final destination", async () => {
    // First call: 301 redirect
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 301,
      headers: new Headers({ location: "https://example.com/final-page" }),
      body: null,
    })
    mockValidateUrl.mockReturnValueOnce({
      isValid: true,
      sanitized: "https://example.com/final-page",
    })

    // Second call: actual page
    mockFetch.mockResolvedValueOnce(
      buildStreamResponse("<html><head><title>Redirected Page</title></head></html>")
    )

    const req = createRequest({ url: VALID_URL })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBe("Redirected Page")
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

// Rate limiting — allow all by default
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Auth — controllable per test
let mockAuthSuccess = true
const mockUser = { id: "user-podcast-123", email: "podcast@clarusapp.io" }

vi.mock("@/lib/auth", () => ({
  authenticateRequest: vi.fn(async () => {
    if (!mockAuthSuccess) {
      const { NextResponse } = await import("next/server")
      return {
        success: false,
        response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      }
    }
    return { success: true, user: mockUser, supabase: {} }
  }),
  AuthErrors: {
    badRequest: (message = "Invalid request") => {
      const { NextResponse } = require("next/server")
      return NextResponse.json({ error: message }, { status: 400 })
    },
    rateLimit: (resetIn: number) => {
      const { NextResponse } = require("next/server")
      const retryAfter = Math.ceil(resetIn / 1000)
      const res = NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
      res.headers.set("Retry-After", String(retryAfter))
      return res
    },
  },
}))

// Podcast resolver — mocked entirely to avoid network calls
const mockResolvePodcastFeed = vi.fn()
vi.mock("@/lib/podcast-resolver", () => ({
  resolvePodcastFeed: (...args: unknown[]) => mockResolvePodcastFeed(...args),
}))

// =============================================================================
// Import handler AFTER mocks are in place
// =============================================================================

import { POST } from "@/app/api/resolve-podcast-feed/route"

// =============================================================================
// Helpers
// =============================================================================

function createRequest(body: unknown): Request {
  return new Request("https://clarusapp.io/api/resolve-podcast-feed", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

// =============================================================================
// Tests
// =============================================================================

const APPLE_PODCAST_URL = "https://podcasts.apple.com/us/podcast/example/id123456"
const RSS_FEED_RESULT = {
  feedUrl: "https://feeds.example.com/podcast.rss",
  podcastName: "Example Podcast",
  podcastImageUrl: "https://cdn.example.com/image.jpg",
}

describe("POST /api/resolve-podcast-feed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockResolvePodcastFeed.mockResolvedValue(RSS_FEED_RESULT)
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await POST(createRequest({ url: APPLE_PODCAST_URL }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })

    const response = await POST(createRequest({ url: APPLE_PODCAST_URL }))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
    expect(response.headers.get("Retry-After")).toBe("30")
  })

  // ---------------------------------------------------------------------------
  // Request body validation
  // ---------------------------------------------------------------------------

  it("returns 400 for invalid JSON body", async () => {
    const request = new Request("https://clarusapp.io/api/resolve-podcast-feed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-valid-json{{",
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/invalid json/i)
  })

  it("returns 400 when url is missing from body", async () => {
    const response = await POST(createRequest({}))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when url is not a valid URL", async () => {
    const response = await POST(createRequest({ url: "not-a-url" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when url is a dangerous javascript: scheme", async () => {
    const response = await POST(createRequest({ url: "javascript:alert(1)" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when url points to an internal/private IP (SSRF protection)", async () => {
    const response = await POST(createRequest({ url: "http://169.254.169.254/metadata" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Success case
  // ---------------------------------------------------------------------------

  it("returns 200 with feed info on valid podcast URL", async () => {
    const response = await POST(createRequest({ url: APPLE_PODCAST_URL }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.feedUrl).toBe(RSS_FEED_RESULT.feedUrl)
    expect(body.podcastName).toBe(RSS_FEED_RESULT.podcastName)
    expect(body.podcastImageUrl).toBe(RSS_FEED_RESULT.podcastImageUrl)
  })

  it("calls resolvePodcastFeed with the normalized URL", async () => {
    await POST(createRequest({ url: APPLE_PODCAST_URL }))

    expect(mockResolvePodcastFeed).toHaveBeenCalledWith(APPLE_PODCAST_URL)
  })

  // ---------------------------------------------------------------------------
  // Resolution errors
  // ---------------------------------------------------------------------------

  it("returns 422 when podcast feed cannot be resolved", async () => {
    mockResolvePodcastFeed.mockRejectedValue(new Error("No RSS feed found for this URL"))

    const response = await POST(createRequest({ url: APPLE_PODCAST_URL }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toMatch(/no rss feed found/i)
  })

  it("returns 422 with generic message for non-Error rejections", async () => {
    mockResolvePodcastFeed.mockRejectedValue("unknown failure")

    const response = await POST(createRequest({ url: APPLE_PODCAST_URL }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toMatch(/failed to resolve podcast feed/i)
  })

  // ---------------------------------------------------------------------------
  // Rate limit key is user-scoped
  // ---------------------------------------------------------------------------

  it("uses user ID in rate limit key (not IP)", async () => {
    await POST(createRequest({ url: APPLE_PODCAST_URL }))

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.stringContaining(mockUser.id),
      expect.any(Number),
      expect.any(Number)
    )
  })
})

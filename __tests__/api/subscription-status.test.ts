import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — declared before imports
// =============================================================================

// Auth — controllable per test
let mockAuthSuccess = true
const mockUser = { id: "user-sub-123", email: "sub@clarusapp.io" }

// Supabase mock — controls what DB queries return
const mockMaybeSingle = vi.fn()

const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mockMaybeSingle,
  })),
}

vi.mock("@/lib/auth", () => ({
  authenticateRequest: vi.fn(async () => {
    if (!mockAuthSuccess) {
      const { NextResponse } = await import("next/server")
      return {
        success: false,
        response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      }
    }
    return { success: true, user: mockUser, supabase: mockSupabaseClient }
  }),
  AuthErrors: {
    badRequest: (message: string) => {
      const { NextResponse } = require("next/server")
      return NextResponse.json({ error: message }, { status: 400 })
    },
  },
}))

// logger — silence noise
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// =============================================================================
// Import handler AFTER mocks
// =============================================================================

import { NextRequest } from "next/server"
import { GET } from "@/app/api/subscription-status/route"

// =============================================================================
// Helpers
// =============================================================================

function createRequest(params: Record<string, string> = {}) {
  const url = new URL("https://clarusapp.io/api/subscription-status")
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString())
}

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/subscription-status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    mockSupabaseClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    }))
  })

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await GET(createRequest({ type: "youtube", channel_id: "UCxxx" }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // -------------------------------------------------------------------------
  // YouTube subscriptions
  // -------------------------------------------------------------------------

  it("returns 400 when type=youtube but channel_id is missing", async () => {
    const response = await GET(createRequest({ type: "youtube" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/channel_id is required/i)
  })

  it("returns subscribed=false when youtube subscription does not exist", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const response = await GET(createRequest({ type: "youtube", channel_id: "UCxxx" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.subscribed).toBe(false)
  })

  it("returns subscribed=true with subscriptionId when youtube subscription exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "sub-yt-abc" }, error: null })

    const response = await GET(createRequest({ type: "youtube", channel_id: "UCxxx" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.subscribed).toBe(true)
    expect(body.subscriptionId).toBe("sub-yt-abc")
  })

  it("sets Cache-Control: private header for youtube response", async () => {
    const response = await GET(createRequest({ type: "youtube", channel_id: "UCxxx" }))

    expect(response.headers.get("Cache-Control")).toMatch(/private/)
  })

  // -------------------------------------------------------------------------
  // Podcast subscriptions
  // -------------------------------------------------------------------------

  it("returns 400 when type=podcast but feed_url is missing", async () => {
    const response = await GET(createRequest({ type: "podcast" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/feed_url is required/i)
  })

  it("returns subscribed=false when podcast subscription does not exist", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const response = await GET(
      createRequest({ type: "podcast", feed_url: "https://feeds.example.com/podcast.xml" })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.subscribed).toBe(false)
  })

  it("returns subscribed=true with subscriptionId when podcast subscription exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "sub-pod-xyz" }, error: null })

    const response = await GET(
      createRequest({ type: "podcast", feed_url: "https://feeds.example.com/podcast.xml" })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.subscribed).toBe(true)
    expect(body.subscriptionId).toBe("sub-pod-xyz")
  })

  it("sets Cache-Control: private header for podcast response", async () => {
    const response = await GET(
      createRequest({ type: "podcast", feed_url: "https://feeds.example.com/podcast.xml" })
    )

    expect(response.headers.get("Cache-Control")).toMatch(/private/)
  })

  // -------------------------------------------------------------------------
  // Invalid type
  // -------------------------------------------------------------------------

  it("returns 400 when type is not 'youtube' or 'podcast'", async () => {
    const response = await GET(createRequest({ type: "rss" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/type must be/i)
  })

  it("returns 400 when type param is absent entirely", async () => {
    const response = await GET(createRequest({}))

    expect(response.status).toBe(400)
  })
})

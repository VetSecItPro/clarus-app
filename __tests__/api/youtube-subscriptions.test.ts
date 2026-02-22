import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before any imports (Vitest hoists vi.mock)
// =============================================================================

// ---------------------------------------------------------------------------
// Auth — controllable per test
// ---------------------------------------------------------------------------
let mockAuthSuccess = true
const mockUser = { id: "user-abc-123", email: "test@clarusapp.io" }

// Supabase instance shared via auth mock — tests replace .from per test
let mockSupabaseFrom: ReturnType<typeof vi.fn>

vi.mock("@/lib/auth", async (importOriginal) => {
  // Re-export the REAL AuthErrors so routes get valid NextResponse objects.
  const real = await importOriginal<typeof import("@/lib/auth")>()
  return {
    ...real,
    authenticateRequest: vi.fn(async () => {
      if (!mockAuthSuccess) {
        const { NextResponse } = await import("next/server")
        return {
          success: false,
          response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
        }
      }
      return {
        success: true,
        user: mockUser,
        supabase: {
          from: (...args: unknown[]) => mockSupabaseFrom(...args),
        },
      }
    }),
  }
})

// ---------------------------------------------------------------------------
// Rate limit mock — allow all requests by default
// ---------------------------------------------------------------------------
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// ---------------------------------------------------------------------------
// Usage mock — allow by default
// ---------------------------------------------------------------------------
const mockCheckUsageLimit = vi.fn()
const mockGetUserTierAndAdmin = vi.fn()
vi.mock("@/lib/usage", () => ({
  checkUsageLimit: (...args: unknown[]) => mockCheckUsageLimit(...args),
  getUserTierAndAdmin: (...args: unknown[]) => mockGetUserTierAndAdmin(...args),
}))

// ---------------------------------------------------------------------------
// Tier-limits mock
// ---------------------------------------------------------------------------
const mockGetEffectiveLimits = vi.fn()
vi.mock("@/lib/tier-limits", () => ({
  getEffectiveLimits: (...args: unknown[]) => mockGetEffectiveLimits(...args),
}))

// ---------------------------------------------------------------------------
// YouTube resolver mock
// ---------------------------------------------------------------------------
const mockResolveYouTubeChannel = vi.fn()
vi.mock("@/lib/youtube-resolver", () => ({
  resolveYouTubeChannel: (...args: unknown[]) => mockResolveYouTubeChannel(...args),
}))

// ---------------------------------------------------------------------------
// processContent mock — silence actual pipeline
// ---------------------------------------------------------------------------
const mockProcessContent = vi.fn()
vi.mock("@/lib/process-content", () => ({
  processContent: (...args: unknown[]) => mockProcessContent(...args),
  ProcessContentError: class ProcessContentError extends Error {
    status: number
    upgradeRequired: boolean
    tier: string | undefined
    constructor(message: string, status = 500, upgradeRequired = false, tier?: string) {
      super(message)
      this.name = "ProcessContentError"
      this.status = status
      this.upgradeRequired = upgradeRequired
      this.tier = tier
    }
  },
}))

// ---------------------------------------------------------------------------
// Schemas mock — mock parseQuery so videos route doesn't crash on nextUrl
// ---------------------------------------------------------------------------
const mockParseQuery = vi.fn()
vi.mock("@/lib/schemas", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/schemas")>()
  return {
    ...real,
    parseQuery: (...args: unknown[]) => mockParseQuery(...args),
  }
})

// ---------------------------------------------------------------------------
// Validation — real UUID format check
// ---------------------------------------------------------------------------
vi.mock("@/lib/validation", () => ({
  validateUUID: vi.fn((id: string) => {
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!id || !UUID_REGEX.test(id)) {
      return { isValid: false, error: "Invalid UUID format" }
    }
    return { isValid: true, sanitized: id.toLowerCase() }
  }),
}))

// ---------------------------------------------------------------------------
// logger — suppress noise
// ---------------------------------------------------------------------------
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

// =============================================================================
// Import route handlers AFTER all mocks are declared
// =============================================================================
import {
  GET as listSubscriptions,
  POST as createSubscription,
} from "@/app/api/youtube-subscriptions/route"
import { DELETE as deleteSubscription } from "@/app/api/youtube-subscriptions/[id]/route"
import { GET as listVideos } from "@/app/api/youtube-subscriptions/[id]/videos/route"
import { POST as analyzeVideo } from "@/app/api/youtube-subscriptions/[id]/videos/[videoId]/analyze/route"
import type { NextRequest } from "next/server"

// =============================================================================
// Helpers
// =============================================================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"
const VALID_UUID_2 = "660f9511-f3ac-42e5-8827-557766551111"
const INVALID_ID = "not-a-uuid"

function makeRequest(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const { method = "GET", body, headers = {} } = options
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", ...headers },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new Request(url, init) as unknown as NextRequest
}

/**
 * Creates a minimal NextRequest-like object with nextUrl.searchParams.
 * Required by any route that calls request.nextUrl.searchParams.
 */
function makeNextRequest(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  const { method = "GET", body, headers = {} } = options
  const parsedUrl = new URL(url)
  const req = new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  Object.defineProperty(req, "nextUrl", {
    value: parsedUrl,
    writable: false,
    configurable: true,
  })
  return req as unknown as NextRequest
}

/**
 * Builds a fluent Supabase query chain that resolves to `result` at any terminal point.
 */
function makeChain(result: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject)
      }
      if (prop === "catch") {
        return (onRej: (v: unknown) => unknown) => Promise.resolve(result).catch(onRej)
      }
      if (prop === "finally") {
        return (onFin: () => void) => Promise.resolve(result).finally(onFin)
      }
      if (prop === Symbol.toStringTag) return "Promise"
      if (prop === Symbol.iterator) return undefined
      if (prop === "single") return () => Promise.resolve(result)
      return () => proxy
    },
  }
  const proxy = new Proxy({}, handler)
  return proxy
}

function dbOk<T>(data: T, count?: number) {
  return { data, error: null, count: count ?? null }
}

function dbErr(message: string, code = "PGRST") {
  return { data: null, error: { message, code }, count: null }
}

// =============================================================================
// GET /api/youtube-subscriptions — list subscriptions
// =============================================================================

describe("GET /api/youtube-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockSupabaseFrom = vi.fn()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false

    const response = await listSubscriptions()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("returns 200 with empty subscriptions when user has none", async () => {
    mockSupabaseFrom.mockImplementation(() => makeChain(dbOk([])))

    const response = await listSubscriptions()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.subscriptions).toEqual([])
  })

  it("returns 200 with enriched subscriptions including latest video info", async () => {
    const mockSubs = [
      {
        id: VALID_UUID,
        user_id: mockUser.id,
        channel_id: "UC_test_channel_id",
        channel_name: "Test Channel",
        channel_image_url: null,
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC_test",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]

    const mockVideos = [
      {
        subscription_id: VALID_UUID,
        video_title: "Test Video 1",
        published_date: "2026-01-15T00:00:00Z",
      },
    ]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") return makeChain(dbOk(mockSubs))
      if (table === "youtube_videos") return makeChain(dbOk(mockVideos))
      return makeChain(dbOk([]))
    })

    const response = await listSubscriptions()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.subscriptions).toHaveLength(1)
    expect(body.subscriptions[0].id).toBe(VALID_UUID)
    expect(body.subscriptions[0].channel_name).toBe("Test Channel")
    // Latest video should be attached
    expect(body.subscriptions[0].latest_video).toEqual({
      video_title: "Test Video 1",
      published_date: "2026-01-15T00:00:00Z",
    })
  })

  it("returns null latest_video when subscription has no videos", async () => {
    const mockSubs = [
      {
        id: VALID_UUID,
        user_id: mockUser.id,
        channel_id: "UC_test",
        channel_name: "Empty Channel",
        channel_image_url: null,
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC_test",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") return makeChain(dbOk(mockSubs))
      if (table === "youtube_videos") return makeChain(dbOk([]))
      return makeChain(dbOk([]))
    })

    const response = await listSubscriptions()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.subscriptions[0].latest_video).toBeNull()
  })

  it("returns 500 when database query fails", async () => {
    mockSupabaseFrom.mockImplementation(() => makeChain(dbErr("DB connection failed")))

    const response = await listSubscriptions()
    void (await response.json())

    expect(response.status).toBe(500)
  })

  it("returns a Cache-Control private header", async () => {
    mockSupabaseFrom.mockImplementation(() => makeChain(dbOk([])))

    const response = await listSubscriptions()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toContain("private")
  })

  it("only picks the first video per subscription for latest_video", async () => {
    const mockSubs = [
      { id: VALID_UUID, channel_name: "Channel A", created_at: "2026-01-01T00:00:00Z" },
    ]

    // Two videos for same subscription — first one (by published_date desc) should be picked
    const mockVideos = [
      { subscription_id: VALID_UUID, video_title: "Newest Video", published_date: "2026-02-01T00:00:00Z" },
      { subscription_id: VALID_UUID, video_title: "Older Video", published_date: "2026-01-01T00:00:00Z" },
    ]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") return makeChain(dbOk(mockSubs))
      if (table === "youtube_videos") return makeChain(dbOk(mockVideos))
      return makeChain(dbOk([]))
    })

    const response = await listSubscriptions()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.subscriptions[0].latest_video?.video_title).toBe("Newest Video")
  })
})

// =============================================================================
// POST /api/youtube-subscriptions — subscribe to a channel
// =============================================================================

describe("POST /api/youtube-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockSupabaseFrom = vi.fn()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "starter", isAdmin: false })
    mockGetEffectiveLimits.mockReturnValue({ youtubeSubscriptions: 5, library: 500 })
    mockResolveYouTubeChannel.mockResolvedValue({
      channelId: "UC_test_channel_id",
      channelName: "Test Channel",
      channelImageUrl: "https://yt3.ggpht.com/test.jpg",
      feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC_test_channel_id",
    })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false

    const request = makeRequest("https://clarusapp.io/api/youtube-subscriptions", {
      method: "POST",
      body: { channel_url: "https://www.youtube.com/@TestChannel" },
    })
    const response = await createSubscription(request as unknown as Request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })

    const request = makeRequest("https://clarusapp.io/api/youtube-subscriptions", {
      method: "POST",
      body: { channel_url: "https://www.youtube.com/@TestChannel" },
    })
    const response = await createSubscription(request as unknown as Request)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
  })

  it("returns 400 for invalid JSON body", async () => {
    const request = new Request("https://clarusapp.io/api/youtube-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-valid-json{{",
    })
    const response = await createSubscription(request)
    void (await response.json())

    expect(response.status).toBe(400)
  })

  it("returns 400 when channel_url is missing", async () => {
    const request = new Request("https://clarusapp.io/api/youtube-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 403 when tier has no YouTube subscription access (free tier)", async () => {
    mockGetEffectiveLimits.mockReturnValue({ youtubeSubscriptions: 0 })
    mockSupabaseFrom.mockImplementation(() =>
      makeChain({ data: null, error: null, count: 0 })
    )

    const request = new Request("https://clarusapp.io/api/youtube-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel_url: "https://www.youtube.com/@TestChannel" }),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/free tier/i)
  })

  it("returns 403 when subscription limit is reached for the tier", async () => {
    mockGetEffectiveLimits.mockReturnValue({ youtubeSubscriptions: 5 })
    // Count equals limit
    mockSupabaseFrom.mockImplementation(() =>
      makeChain({ data: null, error: null, count: 5 })
    )

    const request = new Request("https://clarusapp.io/api/youtube-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel_url: "https://www.youtube.com/@TestChannel" }),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/limit/i)
  })

  it("returns 400 when channel resolution fails", async () => {
    mockGetEffectiveLimits.mockReturnValue({ youtubeSubscriptions: 5 })
    mockSupabaseFrom.mockImplementation(() =>
      makeChain({ data: null, error: null, count: 0 })
    )
    mockResolveYouTubeChannel.mockRejectedValue(new Error("Channel not found"))

    const request = new Request("https://clarusapp.io/api/youtube-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel_url: "https://www.youtube.com/@NonExistentChannel" }),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/invalid youtube url/i)
  })

  it("returns 201 on successful subscription", async () => {
    mockGetEffectiveLimits.mockReturnValue({ youtubeSubscriptions: 5 })

    const newSubscription = {
      id: VALID_UUID,
      channel_id: "UC_test_channel_id",
      channel_name: "Test Channel",
      channel_image_url: "https://yt3.ggpht.com/test.jpg",
      feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC_test_channel_id",
      created_at: "2026-01-01T00:00:00Z",
    }

    let fromCallCount = 0
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        fromCallCount++
        if (fromCallCount === 1) {
          // Count query inside Promise.all
          return makeChain({ data: null, error: null, count: 0 })
        }
        // Insert call
        return makeChain(dbOk(newSubscription))
      }
      return makeChain(dbOk(null))
    })

    const request = new Request("https://clarusapp.io/api/youtube-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel_url: "https://www.youtube.com/@TestChannel" }),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.subscription).toBeDefined()
    expect(body.subscription.channel_name).toBe("Test Channel")
  })

  it("returns 400 when subscribing to a duplicate channel", async () => {
    mockGetEffectiveLimits.mockReturnValue({ youtubeSubscriptions: 5 })

    let fromCallCount = 0
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        fromCallCount++
        if (fromCallCount === 1) {
          return makeChain({ data: null, error: null, count: 0 })
        }
        // Insert fails with unique constraint violation
        return makeChain({ data: null, error: { message: "duplicate key", code: "23505" }, count: null })
      }
      return makeChain(dbOk([]))
    })

    const request = new Request("https://clarusapp.io/api/youtube-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel_url: "https://www.youtube.com/@TestChannel" }),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/already subscribed/i)
  })

  it("returns 500 when insert fails with non-constraint error", async () => {
    mockGetEffectiveLimits.mockReturnValue({ youtubeSubscriptions: 5 })

    let fromCallCount = 0
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        fromCallCount++
        if (fromCallCount === 1) {
          return makeChain({ data: null, error: null, count: 0 })
        }
        return makeChain(dbErr("Database connection failed"))
      }
      return makeChain(dbOk([]))
    })

    const request = new Request("https://clarusapp.io/api/youtube-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel_url: "https://www.youtube.com/@TestChannel" }),
    })
    const response = await createSubscription(request)
    void (await response.json())

    expect(response.status).toBe(500)
  })
})

// =============================================================================
// DELETE /api/youtube-subscriptions/[id] — unsubscribe
// =============================================================================

describe("DELETE /api/youtube-subscriptions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockSupabaseFrom = vi.fn()
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false

    const request = makeRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}`,
      { method: "DELETE" }
    )
    const response = await deleteSubscription(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("returns 400 for an invalid UUID param", async () => {
    const request = makeRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${INVALID_ID}`,
      { method: "DELETE" }
    )
    const response = await deleteSubscription(request, {
      params: Promise.resolve({ id: INVALID_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/uuid/i)
  })

  it("returns 404 when subscription does not exist or belongs to another user", async () => {
    // delete() returns count: 0 — nothing was deleted
    mockSupabaseFrom.mockImplementation(() =>
      makeChain({ data: null, error: null, count: 0 })
    )

    const request = makeRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}`,
      { method: "DELETE" }
    )
    const response = await deleteSubscription(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/not found/i)
  })

  it("returns 200 on successful deletion", async () => {
    mockSupabaseFrom.mockImplementation(() =>
      makeChain({ data: null, error: null, count: 1 })
    )

    const request = makeRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}`,
      { method: "DELETE" }
    )
    const response = await deleteSubscription(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("returns 500 when database delete fails", async () => {
    mockSupabaseFrom.mockImplementation(() =>
      makeChain(dbErr("DB error"))
    )

    const request = makeRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}`,
      { method: "DELETE" }
    )
    const response = await deleteSubscription(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    void (await response.json())

    expect(response.status).toBe(500)
  })
})

// =============================================================================
// GET /api/youtube-subscriptions/[id]/videos — list videos
// =============================================================================

describe("GET /api/youtube-subscriptions/[id]/videos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockSupabaseFrom = vi.fn()
    mockParseQuery.mockReturnValue({ success: true, data: { limit: 50, offset: 0 } })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false

    const request = makeNextRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}/videos`
    )
    const response = await listVideos(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("returns 400 for an invalid subscription UUID param", async () => {
    const request = makeNextRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${INVALID_ID}/videos`
    )
    const response = await listVideos(request, {
      params: Promise.resolve({ id: INVALID_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/uuid/i)
  })

  it("returns 400 when query params are invalid", async () => {
    mockParseQuery.mockReturnValue({ success: false, error: "limit must be a positive integer" })

    const request = makeNextRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}/videos?limit=-1`
    )
    const response = await listVideos(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/limit/i)
  })

  it("returns 404 when subscription not found or not owned by user", async () => {
    // Ownership check: .single() returns error
    mockSupabaseFrom.mockImplementation(() =>
      makeChain({ data: null, error: { message: "not found", code: "PGRST116" }, count: null })
    )

    const request = makeNextRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}/videos`
    )
    const response = await listVideos(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/not found/i)
  })

  it("returns 200 with paginated videos on success", async () => {
    const mockVideos = [
      {
        id: VALID_UUID_2,
        subscription_id: VALID_UUID,
        video_title: "Test Video",
        video_url: "https://www.youtube.com/watch?v=test123",
        published_date: "2026-01-15T00:00:00Z",
        content_id: null,
        thumbnail_url: null,
        description: "A test video",
      },
    ]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return makeChain(dbOk({ id: VALID_UUID }))
      }
      if (table === "youtube_videos") {
        return makeChain({ data: mockVideos, error: null, count: 1 })
      }
      return makeChain(dbOk([]))
    })

    const request = makeNextRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}/videos`
    )
    const response = await listVideos(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.videos).toHaveLength(1)
    expect(body.videos[0].video_title).toBe("Test Video")
    expect(body.total).toBe(1)
    expect(body.limit).toBe(50)
    expect(body.offset).toBe(0)
  })

  it("returns 200 with empty videos array when subscription has no videos", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") return makeChain(dbOk({ id: VALID_UUID }))
      if (table === "youtube_videos") return makeChain({ data: [], error: null, count: 0 })
      return makeChain(dbOk([]))
    })

    const request = makeNextRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}/videos`
    )
    const response = await listVideos(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.videos).toEqual([])
    expect(body.total).toBe(0)
  })

  it("returns 500 when video fetch fails", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") return makeChain(dbOk({ id: VALID_UUID }))
      if (table === "youtube_videos") return makeChain(dbErr("DB error"))
      return makeChain(dbOk([]))
    })

    const request = makeNextRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}/videos`
    )
    const response = await listVideos(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    void (await response.json())

    expect(response.status).toBe(500)
  })

  it("returns 200 with Cache-Control private header", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") return makeChain(dbOk({ id: VALID_UUID }))
      if (table === "youtube_videos") return makeChain({ data: [], error: null, count: 0 })
      return makeChain(dbOk([]))
    })

    const request = makeNextRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}/videos`
    )
    const response = await listVideos(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toContain("private")
  })

  it("respects pagination offset from query params", async () => {
    mockParseQuery.mockReturnValue({ success: true, data: { limit: 10, offset: 20 } })

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") return makeChain(dbOk({ id: VALID_UUID }))
      if (table === "youtube_videos") return makeChain({ data: [], error: null, count: 50 })
      return makeChain(dbOk([]))
    })

    const request = makeNextRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${VALID_UUID}/videos?limit=10&offset=20`
    )
    const response = await listVideos(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.limit).toBe(10)
    expect(body.offset).toBe(20)
    expect(body.total).toBe(50)
  })
})

// =============================================================================
// POST /api/youtube-subscriptions/[id]/videos/[videoId]/analyze
// =============================================================================

describe("POST /api/youtube-subscriptions/[id]/videos/[videoId]/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockSupabaseFrom = vi.fn()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockCheckUsageLimit.mockResolvedValue({
      allowed: true,
      currentCount: 2,
      limit: 50,
      tier: "starter",
    })
    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "starter", isAdmin: false })
    mockGetEffectiveLimits.mockReturnValue({ library: 500 })
    mockProcessContent.mockResolvedValue({ success: true })
  })

  function makeAnalyzeRequest(
    subId: string,
    videoId: string,
    extraHeaders: Record<string, string> = {}
  ): NextRequest {
    return makeNextRequest(
      `https://clarusapp.io/api/youtube-subscriptions/${subId}/videos/${videoId}/analyze`,
      {
        method: "POST",
        headers: {
          "x-forwarded-for": "1.2.3.4",
          ...extraHeaders,
        },
      }
    )
  }

  function analyzeParams(subId: string, videoId: string) {
    return { params: Promise.resolve({ id: subId, videoId }) }
  }

  /**
   * Wires the supabase mock for the happy path through the analyze route.
   *
   * The route does:
   *   1. Promise.all([youtube_subscriptions.single(), youtube_videos.single()])
   *   2. checkUsageLimit (already mocked)
   *   3. getUserTierAndAdmin (already mocked)
   *   4. content.select(count)
   *   5. content.insert().select().single()
   *   6. youtube_videos.update().eq()
   */
  function wireSuccessfulAnalyzeMock(overrides: {
    contentId?: string
    videoContentId?: null | string
    libraryCount?: number
  } = {}) {
    const {
      contentId = VALID_UUID_2,
      videoContentId = null,
      libraryCount = 5,
    } = overrides

    const subscription = {
      id: VALID_UUID,
      user_id: mockUser.id,
    }
    const video = {
      id: VALID_UUID_2,
      video_title: "Test YouTube Video",
      video_url: "https://www.youtube.com/watch?v=testVideoId",
      content_id: videoContentId,
      subscription_id: VALID_UUID,
    }
    const newContent = { id: contentId }

    const tableCalls: Record<string, number> = {}

    mockSupabaseFrom.mockImplementation((table: string) => {
      tableCalls[table] = (tableCalls[table] ?? 0) + 1
      const callNum = tableCalls[table]

      if (table === "youtube_subscriptions") {
        if (callNum === 1) return makeChain(dbOk(subscription))
        return makeChain(dbOk(null))
      }

      if (table === "youtube_videos") {
        if (callNum === 1) return makeChain(dbOk(video))
        // 2nd call: update content_id link
        return makeChain(dbOk(null))
      }

      if (table === "content") {
        if (callNum === 1) {
          // Library count check
          return makeChain({ data: null, error: null, count: libraryCount })
        }
        // Insert new content entry
        return makeChain(dbOk(newContent))
      }

      return makeChain(dbOk(null))
    })
  }

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
  })

  it("returns 400 for invalid subscription UUID", async () => {
    const request = makeAnalyzeRequest(INVALID_ID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(INVALID_ID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/uuid/i)
  })

  it("returns 400 for invalid video UUID", async () => {
    const request = makeAnalyzeRequest(VALID_UUID, INVALID_ID)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, INVALID_ID))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/uuid/i)
  })

  it("returns 404 when subscription is not found", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return makeChain({ data: null, error: { message: "not found", code: "PGRST116" } })
      }
      if (table === "youtube_videos") {
        return makeChain(dbOk({
          id: VALID_UUID_2,
          video_title: "Test Video",
          video_url: "https://www.youtube.com/watch?v=test",
          content_id: null,
          subscription_id: VALID_UUID,
        }))
      }
      return makeChain(dbOk(null))
    })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/not found/i)
  })

  it("returns 404 when video is not found", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return makeChain(dbOk({
          id: VALID_UUID,
          user_id: mockUser.id,
        }))
      }
      if (table === "youtube_videos") {
        return makeChain({ data: null, error: { message: "not found", code: "PGRST116" } })
      }
      return makeChain(dbOk(null))
    })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/not found/i)
  })

  it("returns 404 when video does not belong to the subscription", async () => {
    const DIFFERENT_SUB_UUID = "770f9511-f3ac-42e5-8827-557766552222"

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return makeChain(dbOk({
          id: VALID_UUID,
          user_id: mockUser.id,
        }))
      }
      if (table === "youtube_videos") {
        return makeChain(dbOk({
          id: VALID_UUID_2,
          video_title: "Test Video",
          video_url: "https://www.youtube.com/watch?v=test",
          content_id: null,
          subscription_id: DIFFERENT_SUB_UUID, // different subscription!
        }))
      }
      return makeChain(dbOk(null))
    })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/not found/i)
  })

  it("returns 409 when video has already been analyzed", async () => {
    const existingContentId = VALID_UUID_2

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return makeChain(dbOk({
          id: VALID_UUID,
          user_id: mockUser.id,
        }))
      }
      if (table === "youtube_videos") {
        return makeChain(dbOk({
          id: VALID_UUID_2,
          video_title: "Test Video",
          video_url: "https://www.youtube.com/watch?v=test",
          content_id: existingContentId, // already analyzed
          subscription_id: VALID_UUID,
        }))
      }
      return makeChain(dbOk(null))
    })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toMatch(/already been analyzed/i)
    expect(body.content_id).toBe(existingContentId)
  })

  it("returns 403 when analyses quota is exhausted", async () => {
    mockCheckUsageLimit.mockResolvedValue({
      allowed: false,
      currentCount: 50,
      limit: 50,
      tier: "starter",
    })

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return makeChain(dbOk({
          id: VALID_UUID,
          user_id: mockUser.id,
        }))
      }
      if (table === "youtube_videos") {
        return makeChain(dbOk({
          id: VALID_UUID_2,
          video_title: "Test Video",
          video_url: "https://www.youtube.com/watch?v=test",
          content_id: null,
          subscription_id: VALID_UUID,
        }))
      }
      return makeChain(dbOk(null))
    })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/analyses/i)
  })

  it("returns 403 when library limit is reached", async () => {
    mockGetEffectiveLimits.mockReturnValue({ library: 25 })

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return makeChain(dbOk({
          id: VALID_UUID,
          user_id: mockUser.id,
        }))
      }
      if (table === "youtube_videos") {
        return makeChain(dbOk({
          id: VALID_UUID_2,
          video_title: "Test Video",
          video_url: "https://www.youtube.com/watch?v=test",
          content_id: null,
          subscription_id: VALID_UUID,
        }))
      }
      if (table === "content") {
        // Library at full capacity
        return makeChain({ data: null, error: null, count: 25 })
      }
      return makeChain(dbOk(null))
    })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/library limit/i)
  })

  it("returns 200 with content_id and success message on successful analysis", async () => {
    wireSuccessfulAnalyzeMock()

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toMatch(/analysis started/i)
    expect(body.content_id).toBeDefined()
  })

  it("returns 200 even when processContent throws (non-fatal processing error)", async () => {
    mockProcessContent.mockRejectedValue(new Error("Processing timeout"))
    wireSuccessfulAnalyzeMock()

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    // processContent errors are non-fatal — content entry was created, processing can retry
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("returns 500 when content insert fails", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return makeChain(dbOk({ id: VALID_UUID, user_id: mockUser.id }))
      }
      if (table === "youtube_videos") {
        return makeChain(dbOk({
          id: VALID_UUID_2,
          video_title: "Test Video",
          video_url: "https://www.youtube.com/watch?v=test",
          content_id: null,
          subscription_id: VALID_UUID,
        }))
      }
      if (table === "content") {
        const tableCalls: Record<string, number> = {}
        tableCalls["content"] = (tableCalls["content"] ?? 0) + 1
        if (tableCalls["content"] === 1) {
          // Library count check passes
          return makeChain({ data: null, error: null, count: 5 })
        }
        // Insert fails
        return makeChain(dbErr("DB insert error"))
      }
      return makeChain(dbOk(null))
    })

    // Wire specifically: first content call is count, second is insert failure
    const contentCallTracker = { count: 0 }
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return makeChain(dbOk({ id: VALID_UUID, user_id: mockUser.id }))
      }
      if (table === "youtube_videos") {
        return makeChain(dbOk({
          id: VALID_UUID_2,
          video_title: "Test Video",
          video_url: "https://www.youtube.com/watch?v=test",
          content_id: null,
          subscription_id: VALID_UUID,
        }))
      }
      if (table === "content") {
        contentCallTracker.count++
        if (contentCallTracker.count === 1) {
          return makeChain({ data: null, error: null, count: 5 })
        }
        return makeChain(dbErr("DB insert error"))
      }
      return makeChain(dbOk(null))
    })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeVideo(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    void (await response.json())

    expect(response.status).toBe(500)
  })
})

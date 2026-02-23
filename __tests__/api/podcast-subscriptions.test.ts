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
  // We only override authenticateRequest to make it controllable per test.
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
  TIER_FEATURES: {
    free: { privateFeedCredentials: false },
    starter: { privateFeedCredentials: false },
    pro: { privateFeedCredentials: true },
    day_pass: { privateFeedCredentials: false },
  },
}))

// ---------------------------------------------------------------------------
// RSS parser mock
// ---------------------------------------------------------------------------
const mockFetchAndParseFeed = vi.fn()
vi.mock("@/lib/rss-parser", () => ({
  fetchAndParseFeed: (...args: unknown[]) => mockFetchAndParseFeed(...args),
}))

// ---------------------------------------------------------------------------
// Feed encryption mock
// ---------------------------------------------------------------------------
const mockEncryptFeedCredential = vi.fn()
const mockDecryptFeedCredential = vi.fn()
vi.mock("@/lib/feed-encryption", () => ({
  encryptFeedCredential: (...args: unknown[]) => mockEncryptFeedCredential(...args),
  decryptFeedCredential: (...args: unknown[]) => mockDecryptFeedCredential(...args),
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
// Schemas mock — mock parseQuery so episodes route doesn't crash on nextUrl
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
import { GET as listSubscriptions, POST as createSubscription } from "@/app/api/podcast-subscriptions/route"
import { DELETE as deleteSubscription } from "@/app/api/podcast-subscriptions/[id]/route"
import { GET as listEpisodes } from "@/app/api/podcast-subscriptions/[id]/episodes/route"
import { POST as analyzeEpisode } from "@/app/api/podcast-subscriptions/[id]/episodes/[episodeId]/analyze/route"
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
  // Attach nextUrl shim so routes using request.nextUrl.searchParams work
  Object.defineProperty(req, "nextUrl", {
    value: parsedUrl,
    writable: false,
    configurable: true,
  })
  return req as unknown as NextRequest
}

/**
 * Builds a fluent Supabase query chain that resolves to `result` at any terminal point.
 *
 * Every method returns the same proxy, so chains like:
 *   .select().eq().eq().order().limit()
 * all just return a thennable that resolves to `result`.
 *
 * .single() also returns a Promise resolving to `result` directly.
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
      // .single() resolves immediately to result
      if (prop === "single") return () => Promise.resolve(result)
      // Every other method returns the same chain
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
// GET /api/podcast-subscriptions — list subscriptions
// =============================================================================

describe("GET /api/podcast-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockSupabaseFrom = vi.fn()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    // parseQuery not called by list route
    mockParseQuery.mockReturnValue({ success: true, data: { limit: 50, offset: 0 } })
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

  it("returns 200 with enriched subscriptions including latest episode info", async () => {
    const mockSubs = [
      {
        id: VALID_UUID,
        user_id: mockUser.id,
        feed_url: "https://example.com/feed.rss",
        podcast_name: "Test Podcast",
        podcast_image_url: null,
        feed_auth_header_encrypted: null,
        credentials_updated_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]

    const mockEpisodes = [
      {
        subscription_id: VALID_UUID,
        episode_title: "Episode 1",
        episode_date: "2026-01-15T00:00:00Z",
      },
    ]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") return makeChain(dbOk(mockSubs))
      if (table === "podcast_episodes") return makeChain(dbOk(mockEpisodes))
      return makeChain(dbOk([]))
    })

    const response = await listSubscriptions()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.subscriptions).toHaveLength(1)
    expect(body.subscriptions[0].id).toBe(VALID_UUID)
    expect(body.subscriptions[0].podcast_name).toBe("Test Podcast")
    // Encrypted credentials must be stripped from response
    expect(body.subscriptions[0].feed_auth_header_encrypted).toBeUndefined()
    expect(body.subscriptions[0].has_credentials).toBe(false)
    // Latest episode should be attached
    expect(body.subscriptions[0].latest_episode).toEqual({
      episode_title: "Episode 1",
      episode_date: "2026-01-15T00:00:00Z",
    })
  })

  it("marks has_credentials=true when feed_auth_header_encrypted is set", async () => {
    const mockSubs = [
      {
        id: VALID_UUID,
        user_id: mockUser.id,
        feed_url: "https://private.example.com/feed.rss",
        podcast_name: "Private Podcast",
        podcast_image_url: null,
        feed_auth_header_encrypted: "encrypted-value",
        credentials_updated_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") return makeChain(dbOk(mockSubs))
      if (table === "podcast_episodes") return makeChain(dbOk([]))
      return makeChain(dbOk([]))
    })

    const response = await listSubscriptions()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.subscriptions[0].has_credentials).toBe(true)
    // Encrypted value must NOT appear in response
    expect(body.subscriptions[0].feed_auth_header_encrypted).toBeUndefined()
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
})

// =============================================================================
// POST /api/podcast-subscriptions — subscribe to a podcast
// =============================================================================

describe("POST /api/podcast-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockSupabaseFrom = vi.fn()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "starter", isAdmin: false })
    mockGetEffectiveLimits.mockReturnValue({
      podcastSubscriptions: 3,
      library: 500,
      podcastAnalyses: 10,
    })
    mockFetchAndParseFeed.mockResolvedValue({
      feed: { title: "Test Podcast", imageUrl: null },
      episodes: [
        {
          title: "Episode 1",
          url: "https://example.com/ep1.mp3",
          pubDate: new Date("2026-01-15"),
          durationSeconds: 3600,
          description: "First episode",
        },
      ],
    })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false

    const request = makeRequest("https://clarusapp.io/api/podcast-subscriptions", {
      method: "POST",
      body: { feed_url: "https://example.com/feed.rss" },
    })
    const response = await createSubscription(request as unknown as Request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })

    const request = makeRequest("https://clarusapp.io/api/podcast-subscriptions", {
      method: "POST",
      body: { feed_url: "https://example.com/feed.rss" },
    })
    const response = await createSubscription(request as unknown as Request)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
  })

  it("returns 400 for invalid JSON body", async () => {
    const request = new Request("https://clarusapp.io/api/podcast-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-valid-json{{",
    })
    const response = await createSubscription(request)
    void (await response.json())

    expect(response.status).toBe(400)
  })

  it("returns 400 when feed_url is missing", async () => {
    const request = new Request("https://clarusapp.io/api/podcast-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 403 when tier has no podcast subscription access (free tier)", async () => {
    // Free tier: podcastSubscriptions limit is 0
    mockGetEffectiveLimits.mockReturnValue({ podcastSubscriptions: 0 })
    // Supabase count query (used in Promise.all alongside getUserTierAndAdmin)
    mockSupabaseFrom.mockImplementation(() =>
      makeChain({ data: null, error: null, count: 0 })
    )

    const request = new Request("https://clarusapp.io/api/podcast-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feed_url: "https://example.com/feed.rss" }),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/free tier/i)
  })

  it("returns 403 when subscription limit is reached for the tier", async () => {
    mockGetEffectiveLimits.mockReturnValue({ podcastSubscriptions: 3 })
    // Count equals limit
    mockSupabaseFrom.mockImplementation(() =>
      makeChain({ data: null, error: null, count: 3 })
    )

    const request = new Request("https://clarusapp.io/api/podcast-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feed_url: "https://example.com/feed.rss" }),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/limit/i)
  })

  it("returns 400 when RSS feed fails to parse", async () => {
    mockGetEffectiveLimits.mockReturnValue({ podcastSubscriptions: 3 })
    mockSupabaseFrom.mockImplementation(() =>
      makeChain({ data: null, error: null, count: 0 })
    )
    mockFetchAndParseFeed.mockRejectedValue(new Error("Invalid RSS feed"))

    const request = new Request("https://clarusapp.io/api/podcast-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feed_url: "https://example.com/bad-feed.rss" }),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/invalid podcast feed/i)
  })

  it("returns 400 when feed has no title", async () => {
    mockGetEffectiveLimits.mockReturnValue({ podcastSubscriptions: 3 })
    mockSupabaseFrom.mockImplementation(() =>
      makeChain({ data: null, error: null, count: 0 })
    )
    mockFetchAndParseFeed.mockResolvedValue({
      feed: { title: null, imageUrl: null },
      episodes: [],
    })

    const request = new Request("https://clarusapp.io/api/podcast-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feed_url: "https://example.com/feed.rss" }),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/title/i)
  })

  it("returns 201 on successful subscription with episodes inserted", async () => {
    mockGetEffectiveLimits.mockReturnValue({ podcastSubscriptions: 3 })

    const newSubscription = {
      id: VALID_UUID,
      feed_url: "https://example.com/feed.rss",
      podcast_name: "Test Podcast",
      podcast_image_url: null,
      created_at: "2026-01-01T00:00:00Z",
    }

    // The route runs two phases in sequence:
    // Phase 1 (Promise.all): getUserTierAndAdmin + supabase count query
    // Phase 2: insert subscription → upsert episodes → update last_episode_date
    let fromCallCount = 0
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        fromCallCount++
        if (fromCallCount === 1) {
          // Count query inside Promise.all
          return makeChain({ data: null, error: null, count: 0 })
        }
        // Insert or update calls
        return makeChain(dbOk(newSubscription))
      }
      if (table === "podcast_episodes") {
        return makeChain(dbOk([{ id: "ep-1" }]))
      }
      return makeChain(dbOk(null))
    })

    const request = new Request("https://clarusapp.io/api/podcast-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feed_url: "https://example.com/feed.rss" }),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.subscription).toBeDefined()
    expect(body.subscription.podcast_name).toBe("Test Podcast")
    expect(typeof body.episodes_inserted).toBe("number")
  })

  it("returns 400 when subscribing to a duplicate feed URL", async () => {
    mockGetEffectiveLimits.mockReturnValue({ podcastSubscriptions: 3 })

    let fromCallCount = 0
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        fromCallCount++
        if (fromCallCount === 1) {
          return makeChain({ data: null, error: null, count: 0 })
        }
        // Insert fails with unique constraint violation
        return makeChain({ data: null, error: { message: "duplicate key", code: "23505" }, count: null })
      }
      return makeChain(dbOk([]))
    })

    const request = new Request("https://clarusapp.io/api/podcast-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feed_url: "https://example.com/feed.rss" }),
    })
    const response = await createSubscription(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/already subscribed/i)
  })
})

// =============================================================================
// DELETE /api/podcast-subscriptions/[id] — unsubscribe
// =============================================================================

describe("DELETE /api/podcast-subscriptions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockSupabaseFrom = vi.fn()
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false

    const request = makeRequest(
      `https://clarusapp.io/api/podcast-subscriptions/${VALID_UUID}`,
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
      `https://clarusapp.io/api/podcast-subscriptions/${INVALID_ID}`,
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
      `https://clarusapp.io/api/podcast-subscriptions/${VALID_UUID}`,
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
      `https://clarusapp.io/api/podcast-subscriptions/${VALID_UUID}`,
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
      `https://clarusapp.io/api/podcast-subscriptions/${VALID_UUID}`,
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
// GET /api/podcast-subscriptions/[id]/episodes — list episodes
// =============================================================================

describe("GET /api/podcast-subscriptions/[id]/episodes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockSupabaseFrom = vi.fn()
    // Default: parseQuery succeeds with default pagination
    mockParseQuery.mockReturnValue({ success: true, data: { limit: 50, offset: 0 } })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false

    const request = makeNextRequest(
      `https://clarusapp.io/api/podcast-subscriptions/${VALID_UUID}/episodes`
    )
    const response = await listEpisodes(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("returns 400 for an invalid subscription UUID param", async () => {
    const request = makeNextRequest(
      `https://clarusapp.io/api/podcast-subscriptions/${INVALID_ID}/episodes`
    )
    const response = await listEpisodes(request, {
      params: Promise.resolve({ id: INVALID_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/uuid/i)
  })

  it("returns 400 when query params are invalid", async () => {
    mockParseQuery.mockReturnValue({ success: false, error: "limit must be a positive integer" })

    const request = makeNextRequest(
      `https://clarusapp.io/api/podcast-subscriptions/${VALID_UUID}/episodes?limit=-1`
    )
    const response = await listEpisodes(request, {
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
      `https://clarusapp.io/api/podcast-subscriptions/${VALID_UUID}/episodes`
    )
    const response = await listEpisodes(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/not found/i)
  })

  it("returns 200 with paginated episodes on success", async () => {
    const mockEpisodes = [
      {
        id: VALID_UUID_2,
        subscription_id: VALID_UUID,
        episode_title: "Episode 1",
        episode_url: "https://example.com/ep1.mp3",
        episode_date: "2026-01-15T00:00:00Z",
        duration_seconds: 3600,
        description: "First episode",
        content_id: null,
        is_notified: true,
      },
    ]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return makeChain(dbOk({ id: VALID_UUID }))
      }
      if (table === "podcast_episodes") {
        return makeChain({ data: mockEpisodes, error: null, count: 1 })
      }
      return makeChain(dbOk([]))
    })

    const request = makeNextRequest(
      `https://clarusapp.io/api/podcast-subscriptions/${VALID_UUID}/episodes`
    )
    const response = await listEpisodes(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.episodes).toHaveLength(1)
    expect(body.episodes[0].episode_title).toBe("Episode 1")
    expect(body.total).toBe(1)
    expect(body.limit).toBe(50)
    expect(body.offset).toBe(0)
  })

  it("returns 200 with empty episodes array when subscription has no episodes", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") return makeChain(dbOk({ id: VALID_UUID }))
      if (table === "podcast_episodes") return makeChain({ data: [], error: null, count: 0 })
      return makeChain(dbOk([]))
    })

    const request = makeNextRequest(
      `https://clarusapp.io/api/podcast-subscriptions/${VALID_UUID}/episodes`
    )
    const response = await listEpisodes(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.episodes).toEqual([])
    expect(body.total).toBe(0)
  })

  it("returns 200 with Cache-Control private header", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") return makeChain(dbOk({ id: VALID_UUID }))
      if (table === "podcast_episodes") return makeChain({ data: [], error: null, count: 0 })
      return makeChain(dbOk([]))
    })

    const request = makeNextRequest(
      `https://clarusapp.io/api/podcast-subscriptions/${VALID_UUID}/episodes`
    )
    const response = await listEpisodes(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toContain("private")
  })
})

// =============================================================================
// POST /api/podcast-subscriptions/[id]/episodes/[episodeId]/analyze
// =============================================================================

describe("POST /api/podcast-subscriptions/[id]/episodes/[episodeId]/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockSupabaseFrom = vi.fn()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockCheckUsageLimit.mockResolvedValue({
      allowed: true,
      currentCount: 2,
      limit: 10,
      tier: "starter",
    })
    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "starter", isAdmin: false })
    mockGetEffectiveLimits.mockReturnValue({ library: 500 })
    mockProcessContent.mockResolvedValue({ success: true })
    mockDecryptFeedCredential.mockReturnValue("Bearer token-123")
  })

  /**
   * Helper to build analyze requests.
   * Uses makeNextRequest so x-forwarded-for header resolves cleanly.
   */
  function makeAnalyzeRequest(
    subId: string,
    episodeId: string,
    extraHeaders: Record<string, string> = {}
  ): NextRequest {
    return makeNextRequest(
      `https://clarusapp.io/api/podcast-subscriptions/${subId}/episodes/${episodeId}/analyze`,
      {
        method: "POST",
        headers: {
          "x-forwarded-for": "1.2.3.4",
          ...extraHeaders,
        },
      }
    )
  }

  function analyzeParams(subId: string, episodeId: string) {
    return { params: Promise.resolve({ id: subId, episodeId }) }
  }

  /**
   * Wires the supabase mock for the happy path through the analyze route.
   *
   * The route does:
   *   1. Promise.all([subscriptions.single(), episodes.single()])
   *   2. getUserTierAndAdmin (already mocked via mockGetUserTierAndAdmin)
   *   3. content.select(count)
   *   4. content.insert().select().single()
   *   5. podcast_episodes.update().eq()
   */
  function wireSuccessfulAnalyzeMock(overrides: {
    contentId?: string
    episodeContentId?: null | string
    subscriptionEncryptedHeader?: string | null
    libraryCount?: number
  } = {}) {
    const {
      contentId = VALID_UUID_2,
      episodeContentId = null,
      subscriptionEncryptedHeader = null,
      libraryCount = 5,
    } = overrides

    const subscription = {
      id: VALID_UUID,
      user_id: mockUser.id,
      feed_auth_header_encrypted: subscriptionEncryptedHeader,
    }
    const episode = {
      id: VALID_UUID_2,
      episode_title: "Test Episode",
      episode_url: "https://example.com/ep1.mp3",
      content_id: episodeContentId,
      subscription_id: VALID_UUID,
    }
    const newContent = { id: contentId }

    // Track how many times each table has been called
    const tableCalls: Record<string, number> = {}

    mockSupabaseFrom.mockImplementation((table: string) => {
      tableCalls[table] = (tableCalls[table] ?? 0) + 1
      const callNum = tableCalls[table]

      if (table === "podcast_subscriptions") {
        if (callNum === 1) return makeChain(dbOk(subscription))
        // 2nd call: update episode.content_id (returns nothing needed)
        return makeChain(dbOk(null))
      }

      if (table === "podcast_episodes") {
        if (callNum === 1) return makeChain(dbOk(episode))
        // 2nd call: update content_id link
        return makeChain(dbOk(null))
      }

      if (table === "content") {
        if (callNum === 1) {
          // Library count check: select("id", { count, head })
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
    const response = await analyzeEpisode(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeEpisode(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
  })

  it("returns 400 for invalid subscription UUID", async () => {
    const request = makeAnalyzeRequest(INVALID_ID, VALID_UUID_2)
    const response = await analyzeEpisode(request, analyzeParams(INVALID_ID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/uuid/i)
  })

  it("returns 400 for invalid episode UUID", async () => {
    const request = makeAnalyzeRequest(VALID_UUID, INVALID_ID)
    const response = await analyzeEpisode(request, analyzeParams(VALID_UUID, INVALID_ID))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/uuid/i)
  })

  it("returns 404 when subscription is not found", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return makeChain({ data: null, error: { message: "not found", code: "PGRST116" } })
      }
      if (table === "podcast_episodes") {
        return makeChain(dbOk({
          id: VALID_UUID_2,
          episode_title: "Episode 1",
          episode_url: "https://example.com/ep1.mp3",
          content_id: null,
          subscription_id: VALID_UUID,
        }))
      }
      return makeChain(dbOk(null))
    })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeEpisode(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/not found/i)
  })

  it("returns 404 when episode is not found", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return makeChain(dbOk({
          id: VALID_UUID,
          user_id: mockUser.id,
          feed_auth_header_encrypted: null,
        }))
      }
      if (table === "podcast_episodes") {
        return makeChain({ data: null, error: { message: "not found", code: "PGRST116" } })
      }
      return makeChain(dbOk(null))
    })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeEpisode(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/not found/i)
  })

  it("returns 409 when episode has already been analyzed", async () => {
    const existingContentId = VALID_UUID_2

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return makeChain(dbOk({
          id: VALID_UUID,
          user_id: mockUser.id,
          feed_auth_header_encrypted: null,
        }))
      }
      if (table === "podcast_episodes") {
        return makeChain(dbOk({
          id: VALID_UUID_2,
          episode_title: "Episode 1",
          episode_url: "https://example.com/ep1.mp3",
          content_id: existingContentId, // already analyzed
          subscription_id: VALID_UUID,
        }))
      }
      return makeChain(dbOk(null))
    })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeEpisode(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toMatch(/already been analyzed/i)
    expect(body.content_id).toBe(existingContentId)
  })

  it("returns 403 when podcast analysis quota is exhausted", async () => {
    mockCheckUsageLimit.mockResolvedValue({
      allowed: false,
      currentCount: 10,
      limit: 10,
      tier: "starter",
    })

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return makeChain(dbOk({
          id: VALID_UUID,
          user_id: mockUser.id,
          feed_auth_header_encrypted: null,
        }))
      }
      if (table === "podcast_episodes") {
        return makeChain(dbOk({
          id: VALID_UUID_2,
          episode_title: "Episode 1",
          episode_url: "https://example.com/ep1.mp3",
          content_id: null,
          subscription_id: VALID_UUID,
        }))
      }
      return makeChain(dbOk(null))
    })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeEpisode(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/podcast analyses/i)
  })

  it("returns 403 when library limit is reached", async () => {
    mockGetEffectiveLimits.mockReturnValue({ library: 25 })

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return makeChain(dbOk({
          id: VALID_UUID,
          user_id: mockUser.id,
          feed_auth_header_encrypted: null,
        }))
      }
      if (table === "podcast_episodes") {
        return makeChain(dbOk({
          id: VALID_UUID_2,
          episode_title: "Episode 1",
          episode_url: "https://example.com/ep1.mp3",
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
    const response = await analyzeEpisode(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/library limit/i)
  })

  it("returns 200 with content_id and success message on successful analysis", async () => {
    wireSuccessfulAnalyzeMock()

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeEpisode(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toMatch(/analysis started/i)
    expect(body.content_id).toBeDefined()
  })

  it("returns 200 even when processContent throws (non-fatal processing error)", async () => {
    mockProcessContent.mockRejectedValue(new Error("Deepgram timeout"))
    wireSuccessfulAnalyzeMock()

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    const response = await analyzeEpisode(request, analyzeParams(VALID_UUID, VALID_UUID_2))
    const body = await response.json()

    // processContent errors are non-fatal — content entry was created, processing can retry
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("decrypts private feed credentials when present on subscription", async () => {
    mockDecryptFeedCredential.mockReturnValue("Bearer private-token")
    wireSuccessfulAnalyzeMock({ subscriptionEncryptedHeader: "encrypted-auth-header" })

    const request = makeAnalyzeRequest(VALID_UUID, VALID_UUID_2)
    await analyzeEpisode(request, analyzeParams(VALID_UUID, VALID_UUID_2))

    expect(mockDecryptFeedCredential).toHaveBeenCalledWith("encrypted-auth-header")
  })
})

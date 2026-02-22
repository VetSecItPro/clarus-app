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

// Supabase user-scoped client for content/summaries queries
const mockUserFrom = vi.fn()
const mockUserSupabase = {
  from: (...args: unknown[]) => mockUserFrom(...args),
}

// Admin client for tier lookup
const mockAdminFrom = vi.fn()
const mockAdminClient = {
  from: (...args: unknown[]) => mockAdminFrom(...args),
}

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
      return { success: true, user: mockUser, supabase: mockUserSupabase }
    }),
    getAdminClient: () => mockAdminClient,
  }
})

// Tier limits — controllable
let mockComparativeAnalysis = true
vi.mock("@/lib/tier-limits", () => ({
  TIER_FEATURES: new Proxy(
    {},
    {
      get: () => ({ comparativeAnalysis: mockComparativeAnalysis }),
    }
  ),
  normalizeTier: vi.fn((_tier: unknown) => "pro"),
}))

// AI response parser
const mockParseAiResponseOrThrow = vi.fn()
vi.mock("@/lib/ai-response-parser", () => ({
  parseAiResponseOrThrow: (...args: unknown[]) => mockParseAiResponseOrThrow(...args),
}))

// API usage logging — fire-and-forget, silence
vi.mock("@/lib/api-usage", () => ({
  logApiUsage: vi.fn(),
  createTimer: vi.fn(() => ({ elapsed: vi.fn(() => 100) })),
}))

// logger — silence noise
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

// =============================================================================
// Import handler AFTER mocks are in place
// =============================================================================

import { POST } from "@/app/api/compare/route"

// =============================================================================
// Constants & helpers
// =============================================================================

const UUID_1 = "550e8400-e29b-41d4-a716-446655440001"
const UUID_2 = "550e8400-e29b-41d4-a716-446655440002"
const UUID_3 = "550e8400-e29b-41d4-a716-446655440003"

const MOCK_COMPARISON = {
  agreements: [{ topic: "Climate change", detail: "Both agree it is real." }],
  disagreements: [],
  unique_insights: [],
  reliability_assessment: "Both sources appear reliable.",
  key_takeaways: ["Takeaway 1"],
}

function createRequest(body: unknown) {
  return new NextRequest("https://clarusapp.io/api/compare", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeContentItem(id: string, title = "Test Article") {
  return { id, title, url: `https://example.com/${id}`, type: "article" }
}

function makeSummary(contentId: string) {
  return {
    content_id: contentId,
    brief_overview: "A brief overview of the content.",
    truth_check: { rating: "Accurate" },
    triage: { quality: "high" },
  }
}

function buildUserSupabaseMocks(
  contentData: unknown,
  summaryData: unknown,
  contentError: unknown = null,
  summaryError: unknown = null
) {
  // The route uses Promise.all with two parallel queries. We need to differentiate
  // by table name. Return a chain that resolves correctly for each.
  mockUserFrom.mockImplementation((table: string) => {
    if (table === "content") {
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: contentData, error: contentError }),
      }
    }
    if (table === "summaries") {
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: summaryData, error: summaryError }),
      }
    }
    return {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })
}

function buildAdminTierMock(tier = "pro", dayPassExpiresAt: string | null = null) {
  mockAdminFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { tier, day_pass_expires_at: dayPassExpiresAt },
      error: null,
    }),
  })
}

// Mock global fetch for OpenRouter calls
const mockFetch = vi.fn()
global.fetch = mockFetch

function mockSuccessfulAiResponse() {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(MOCK_COMPARISON) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 500 },
    }),
    text: vi.fn().mockResolvedValue(""),
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockComparativeAnalysis = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })

    // Default: pro tier user
    buildAdminTierMock("pro")

    // Default: content and summaries found
    buildUserSupabaseMocks(
      [makeContentItem(UUID_1), makeContentItem(UUID_2)],
      [makeSummary(UUID_1), makeSummary(UUID_2)]
    )

    // Default: AI responds successfully
    mockSuccessfulAiResponse()

    // Default: AI parser returns valid comparison
    mockParseAiResponseOrThrow.mockReturnValue(MOCK_COMPARISON)

    // Set OPENROUTER_API_KEY env var
    process.env.OPENROUTER_API_KEY = "test-key-123"
  })

  // ---------------------------------------------------------------------------
  // Authentication — 401
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Rate limiting — 429
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 60000 })

    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
    expect(response.headers.get("Retry-After")).toBe("60")
  })

  // ---------------------------------------------------------------------------
  // Request body validation — 400
  // ---------------------------------------------------------------------------

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("https://clarusapp.io/api/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not valid json{{",
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when contentIds is missing", async () => {
    const req = createRequest({})
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when only one contentId is provided (minimum 2)", async () => {
    const req = createRequest({ contentIds: [UUID_1] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when four contentIds are provided (maximum 3)", async () => {
    const UUID_4 = "550e8400-e29b-41d4-a716-446655440004"
    const req = createRequest({ contentIds: [UUID_1, UUID_2, UUID_3, UUID_4] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when contentIds contains invalid UUIDs", async () => {
    const req = createRequest({ contentIds: ["not-a-uuid", UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Tier check — 403
  // ---------------------------------------------------------------------------

  it("returns 403 when user is on free tier (no comparative analysis)", async () => {
    mockComparativeAnalysis = false

    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/pro.*day pass/i)
  })

  // ---------------------------------------------------------------------------
  // User / content not found
  // ---------------------------------------------------------------------------

  it("returns 404 when user record is not found in the database", async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
    })

    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/user not found/i)
  })

  it("returns 404 when a requested content item is not found or not owned", async () => {
    // Only UUID_1 returned — UUID_2 missing
    buildUserSupabaseMocks(
      [makeContentItem(UUID_1)],
      [makeSummary(UUID_1)]
    )

    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/content not found/i)
  })

  it("returns 500 when content fetch fails with a database error", async () => {
    buildUserSupabaseMocks(null, null, { message: "DB error" }, null)

    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to fetch content/i)
  })

  // ---------------------------------------------------------------------------
  // Missing analysis — 400
  // ---------------------------------------------------------------------------

  it("returns 400 when a content item has no analysis/summary yet", async () => {
    // UUID_2 has no summary
    buildUserSupabaseMocks(
      [makeContentItem(UUID_1), makeContentItem(UUID_2)],
      [makeSummary(UUID_1)] // no summary for UUID_2
    )

    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/has not been analyzed yet/i)
  })

  // ---------------------------------------------------------------------------
  // AI errors — 502
  // ---------------------------------------------------------------------------

  it("returns 502 when the OpenRouter API returns a non-OK status", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue("Service unavailable"),
    })

    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toMatch(/temporarily unavailable/i)
  })

  it("returns 502 when the AI returns an empty response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: null } }],
        usage: {},
      }),
      text: vi.fn().mockResolvedValue(""),
    })

    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toMatch(/empty response/i)
  })

  // ---------------------------------------------------------------------------
  // 200 success — shape validation
  // ---------------------------------------------------------------------------

  it("returns 200 with correct comparison shape on success", async () => {
    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.comparison).toBeDefined()
    expect(Array.isArray(body.comparison.agreements)).toBe(true)
    expect(Array.isArray(body.comparison.disagreements)).toBe(true)
    expect(Array.isArray(body.comparison.unique_insights)).toBe(true)
    expect(typeof body.comparison.reliability_assessment).toBe("string")
    expect(Array.isArray(body.comparison.key_takeaways)).toBe(true)
    expect(body.comparison.generated_at).toBeDefined()
  })

  it("returns 200 with sources array on success", async () => {
    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(body.sources)).toBe(true)
    expect(body.sources).toHaveLength(2)
    expect(body.sources[0]).toHaveProperty("id")
    expect(body.sources[0]).toHaveProperty("title")
    expect(body.sources[0]).toHaveProperty("url")
    expect(body.sources[0]).toHaveProperty("type")
  })

  it("accepts three content IDs and returns 200", async () => {
    buildUserSupabaseMocks(
      [makeContentItem(UUID_1), makeContentItem(UUID_2), makeContentItem(UUID_3)],
      [makeSummary(UUID_1), makeSummary(UUID_2), makeSummary(UUID_3)]
    )

    const req = createRequest({ contentIds: [UUID_1, UUID_2, UUID_3] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sources).toHaveLength(3)
  })

  it("normalizes missing AI arrays to empty arrays in response", async () => {
    mockParseAiResponseOrThrow.mockReturnValue({
      agreements: null,
      disagreements: undefined,
      unique_insights: "not an array",
      reliability_assessment: null,
      key_takeaways: null,
    })

    const req = createRequest({ contentIds: [UUID_1, UUID_2] })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.comparison.agreements).toEqual([])
    expect(body.comparison.disagreements).toEqual([])
    expect(body.comparison.unique_insights).toEqual([])
    expect(typeof body.comparison.reliability_assessment).toBe("string")
    expect(body.comparison.key_takeaways).toEqual([])
  })
})

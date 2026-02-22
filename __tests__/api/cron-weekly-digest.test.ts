import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

// Supabase admin client
const mockSupabaseFrom = vi.fn()
const mockSupabaseClient = {
  from: (...args: unknown[]) => mockSupabaseFrom(...args),
}
vi.mock("@/lib/auth", () => ({
  getAdminClient: vi.fn(() => mockSupabaseClient),
}))

// Email
const mockSendWeeklyDigestEmail = vi.fn()
vi.mock("@/lib/email", () => ({
  sendWeeklyDigestEmail: (...args: unknown[]) => mockSendWeeklyDigestEmail(...args),
}))

// AI response parser
const mockParseAiResponseOrThrow = vi.fn()
vi.mock("@/lib/ai-response-parser", () => ({
  parseAiResponseOrThrow: (...args: unknown[]) => mockParseAiResponseOrThrow(...args),
}))

// Logger — silence noise
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

import { GET } from "@/app/api/crons/weekly-digest/route"

// =============================================================================
// Helpers
// =============================================================================

const CRON_SECRET = "test-cron-secret-digest-789"

function createRequest(headers: Record<string, string> = {}) {
  return new Request("https://clarusapp.io/api/crons/weekly-digest", {
    method: "GET",
    headers,
  })
}

function createAuthedRequest() {
  return createRequest({ authorization: `Bearer ${CRON_SECRET}` })
}

/** A starter-tier user who has weekly digest enabled. */
const makeEligibleUser = (overrides: Record<string, unknown> = {}) => ({
  id: "user-starter-1",
  email: "user@clarusapp.io",
  name: "Test User",
  digest_enabled: true,
  tier: "starter",
  day_pass_expires_at: null,
  ...overrides,
})

/** Content record with a quality score in the triage JSON. */
function makeContent(userId: string, _qualityScore = 0.8) {
  return {
    id: `content-${userId}-1`,
    title: "An Interesting Article",
    url: "https://example.com/article",
    user_id: userId,
    full_text: "Lorem ipsum ".repeat(100),
    duration: null,
    tags: ["tech", "ai"],
    type: "article",
    // triage lives in the summaries table, not here
  }
}

function makeSummary(contentId: string, userId: string, qualityScore = 0.8) {
  return {
    content_id: contentId,
    user_id: userId,
    triage: {
      quality_score: qualityScore,
      content_category: "Technology",
      target_audience: ["developers"],
    },
    truth_check: {
      overall_rating: "mostly-true",
    },
  }
}

/** Build the standard "no stuck content" Supabase mock for the content table. */
function buildDefaultSupabaseMock({
  users = [makeEligibleUser()],
  content = [makeContent("user-starter-1")],
  summaries = [makeSummary("content-user-starter-1-1", "user-starter-1")],
  claims = [],
  emailResult = { success: true, messageId: "digest-msg-1" },
}: {
  users?: unknown[]
  content?: unknown[]
  summaries?: unknown[]
  claims?: unknown[]
  emailResult?: { success: boolean; messageId?: string; error?: string }
} = {}) {
  mockSendWeeklyDigestEmail.mockResolvedValue(emailResult)

  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "users") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: users, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }
    }
    if (table === "content") {
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: content, error: null }),
      }
    }
    if (table === "summaries") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: summaries, error: null }),
      }
    }
    if (table === "claims") {
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: claims, error: null }),
      }
    }
    return {}
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/crons/weekly-digest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET
    process.env.OPENROUTER_API_KEY = "test-openrouter-key"

    // Default: AI insights parse returns a valid structure
    mockParseAiResponseOrThrow.mockReturnValue({
      trending_topics: [{ topic: "AI", count: 3 }],
      contradictions: [],
      time_saved_minutes: 15,
      recommended_revisits: [],
    })

    // Mock global fetch for OpenRouter calls
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                trending_topics: [{ topic: "AI", count: 3 }],
                contradictions: [],
                time_saved_minutes: 15,
                recommended_revisits: [],
              }),
            },
          },
        ],
      }),
      text: async () => "",
    }))
  })

  // ---------------------------------------------------------------------------
  // Auth / secret verification
  // ---------------------------------------------------------------------------

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET

    const response = await GET(createRequest({ authorization: "Bearer anything" }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/server misconfigured/i)
  })

  it("returns 401 when authorization header is missing", async () => {
    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/unauthorized/i)
  })

  it("returns 401 when authorization header has wrong secret", async () => {
    const response = await GET(createRequest({ authorization: "Bearer wrong-secret" }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/unauthorized/i)
  })

  it("returns 401 when Bearer prefix is missing", async () => {
    const response = await GET(createRequest({ authorization: CRON_SECRET }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/unauthorized/i)
  })

  // ---------------------------------------------------------------------------
  // Database errors
  // ---------------------------------------------------------------------------

  it("returns 500 when fetching users fails", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: "DB connection error" } }),
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to fetch users/i)
  })

  // ---------------------------------------------------------------------------
  // No eligible users
  // ---------------------------------------------------------------------------

  it("returns 200 with sent=0 when there are no users with digest_enabled", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.sent).toBe(0)
  })

  it("returns 200 skipping all free-tier users since they do not have digest access", async () => {
    const freeUsers = [
      makeEligibleUser({ id: "user-free-1", email: "free@test.com", tier: "free" }),
    ]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: freeUsers, error: null }),
        }
      }
      if (table === "content") {
        return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      if (table === "summaries") {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      if (table === "claims") {
        return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      return {}
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.sent).toBe(0)
    expect(body.skipped).toBeGreaterThanOrEqual(1)
  })

  it("returns 200 skipping day_pass users since day_pass does not include weekly digest", async () => {
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const dayPassUsers = [
      makeEligibleUser({ id: "user-daypass-1", email: "daypass@test.com", tier: "day_pass", day_pass_expires_at: futureExpiry }),
    ]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: dayPassUsers, error: null }),
        }
      }
      if (table === "content") {
        return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      if (table === "summaries") {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      if (table === "claims") {
        return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      return {}
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sent).toBe(0)
    expect(body.skipped).toBeGreaterThanOrEqual(1)
  })

  // ---------------------------------------------------------------------------
  // User has no recent content
  // ---------------------------------------------------------------------------

  it("skips a user who has no content analyzed in the last 7 days", async () => {
    const users = [makeEligibleUser()]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: users, error: null }),
        }
      }
      if (table === "content") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }), // no content
        }
      }
      if (table === "summaries") {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      if (table === "claims") {
        return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      return {}
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sent).toBe(0)
    expect(mockSendWeeklyDigestEmail).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // Content with no quality scores gets skipped
  // ---------------------------------------------------------------------------

  it("skips a user when all content has quality_score=0 (no scored items)", async () => {
    const userId = "user-starter-1"
    const users = [makeEligibleUser({ id: userId })]
    const content = [makeContent(userId, 0)]
    const summaries = [makeSummary(`content-${userId}-1`, userId, 0)] // quality_score=0

    buildDefaultSupabaseMock({ users, content, summaries })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sent).toBe(0)
    expect(mockSendWeeklyDigestEmail).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // Successful digest send
  // ---------------------------------------------------------------------------

  it("returns 200 with sent=1 when digest is successfully sent to an eligible user", async () => {
    const userId = "user-starter-1"
    const users = [makeEligibleUser({ id: userId })]
    const content = [makeContent(userId, 0.8)]
    const summaries = [makeSummary(`content-${userId}-1`, userId, 0.8)]

    buildDefaultSupabaseMock({ users, content, summaries, emailResult: { success: true, messageId: "msg-1" } })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.sent).toBe(1)
    expect(mockSendWeeklyDigestEmail).toHaveBeenCalledOnce()
  })

  it("passes correct arguments to sendWeeklyDigestEmail", async () => {
    const userId = "user-starter-1"
    const users = [makeEligibleUser({ id: userId, email: "user@clarusapp.io", name: "Test User" })]
    const content = [makeContent(userId, 0.8)]
    const summaries = [makeSummary(`content-${userId}-1`, userId, 0.8)]

    buildDefaultSupabaseMock({ users, content, summaries })

    await GET(createAuthedRequest())

    expect(mockSendWeeklyDigestEmail).toHaveBeenCalledWith(
      "user@clarusapp.io",
      "Test User",
      expect.any(String),   // weekOf
      1,                    // itemCount
      expect.any(Array),    // topAnalyses
      expect.any(Number),   // avgScore
      expect.anything(),    // insights (can be null or object)
    )
  })

  // ---------------------------------------------------------------------------
  // Multi-user: sends one digest per eligible user
  // ---------------------------------------------------------------------------

  it("sends digests to multiple eligible users in the same run", async () => {
    const users = [
      makeEligibleUser({ id: "user-a", email: "a@test.com", name: "User A" }),
      makeEligibleUser({ id: "user-b", email: "b@test.com", name: "User B", tier: "pro" }),
    ]
    const content = [
      { ...makeContent("user-a", 0.9), user_id: "user-a", id: "content-a-1" },
      { ...makeContent("user-b", 0.7), user_id: "user-b", id: "content-b-1" },
    ]
    const summaries = [
      makeSummary("content-a-1", "user-a", 0.9),
      makeSummary("content-b-1", "user-b", 0.7),
    ]

    buildDefaultSupabaseMock({ users, content, summaries })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sent).toBe(2)
    expect(mockSendWeeklyDigestEmail).toHaveBeenCalledTimes(2)
  })

  // ---------------------------------------------------------------------------
  // Email send failure (graceful degradation)
  // ---------------------------------------------------------------------------

  it("increments skipped and not sent when email send fails for a user", async () => {
    const userId = "user-starter-1"
    const users = [makeEligibleUser({ id: userId })]
    const content = [makeContent(userId, 0.8)]
    const summaries = [makeSummary(`content-${userId}-1`, userId, 0.8)]

    buildDefaultSupabaseMock({
      users,
      content,
      summaries,
      emailResult: { success: false, error: "Resend API failure" },
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.sent).toBe(0)
    expect(body.skipped).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // AI insights: graceful degradation when OpenRouter fails
  // ---------------------------------------------------------------------------

  it("still sends digest when OpenRouter API call fails (graceful degradation)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    }))

    const userId = "user-starter-1"
    const users = [makeEligibleUser({ id: userId })]
    const content = [makeContent(userId, 0.8)]
    const summaries = [makeSummary(`content-${userId}-1`, userId, 0.8)]

    buildDefaultSupabaseMock({ users, content, summaries, emailResult: { success: true } })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    // Should still succeed even without AI insights
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.sent).toBe(1)
    // insights arg will be undefined (null from failed AI call)
    expect(mockSendWeeklyDigestEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.any(String),
      expect.any(Number),
      expect.any(Array),
      expect.any(Number),
      undefined, // insights degraded to null → passed as undefined
    )
  })

  it("still sends digest when OpenRouter fetch throws a network error (graceful degradation)", async () => {
    // Simulate a network-level error from the OpenRouter call
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")))

    const userId = "user-starter-1"
    const users = [makeEligibleUser({ id: userId })]
    const content = [makeContent(userId, 0.8)]
    const summaries = [makeSummary(`content-${userId}-1`, userId, 0.8)]

    buildDefaultSupabaseMock({ users, content, summaries, emailResult: { success: true } })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    // Digest should still be sent successfully with null insights
    expect(response.status).toBe(200)
    expect(body.sent).toBe(1)
    expect(mockSendWeeklyDigestEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.any(String),
      expect.any(Number),
      expect.any(Array),
      expect.any(Number),
      undefined, // insights degrade to null → passed as undefined
    )
  })

  // ---------------------------------------------------------------------------
  // Response shape
  // ---------------------------------------------------------------------------

  it("returns the correct response shape on success", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(body).toMatchObject({
      success: true,
      sent: expect.any(Number),
      skipped: expect.any(Number),
    })
  })

  // ---------------------------------------------------------------------------
  // last_digest_at is updated on successful send
  // ---------------------------------------------------------------------------

  it("updates last_digest_at for a user when their digest is sent successfully", async () => {
    const userId = "user-starter-1"
    const users = [makeEligibleUser({ id: userId })]
    const content = [makeContent(userId, 0.8)]
    const summaries = [makeSummary(`content-${userId}-1`, userId, 0.8)]

    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockSendWeeklyDigestEmail.mockResolvedValue({ success: true, messageId: "msg-1" })

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: users, error: null }),
          update: updateFn,
        }
      }
      if (table === "content") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: content, error: null }),
        }
      }
      if (table === "summaries") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ data: summaries, error: null }),
        }
      }
      if (table === "claims") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return {}
    })

    await GET(createAuthedRequest())

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ last_digest_at: expect.any(String) }),
    )
  })
})

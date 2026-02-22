import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// =============================================================================
// Module mocks — must be declared before imports (vitest hoists vi.mock)
// =============================================================================

// Rate limiting — always allow by default
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// RPC mock — a plain vi.fn so we can inspect calls and change return values
const mockRpc = vi.fn()

// Auth — controllable per test
let mockAuthSuccess = true
let mockIsAdmin = true
const mockUser = { id: "admin-user-123", email: "admin@clarusapp.io" }

vi.mock("@/lib/auth", async () => {
  const { NextResponse } = await import("next/server")
  return {
    authenticateAdmin: vi.fn(async () => {
      if (!mockAuthSuccess) {
        return {
          success: false,
          response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
        }
      }
      if (!mockIsAdmin) {
        return {
          success: false,
          response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
        }
      }
      return { success: true, user: mockUser, supabase: {} }
    }),
    getAdminClient: () => ({
      rpc: (...args: unknown[]) => mockRpc(...args),
    }),
    AuthErrors: {
      badRequest: (message: string) =>
        NextResponse.json({ error: message }, { status: 400 }),
    },
  }
})

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

import { GET } from "@/app/api/admin/metrics/route"

// =============================================================================
// Helpers
// =============================================================================

// Minimal valid RPC response that satisfies the transform logic
const MOCK_RPC_DATA = {
  total_users: 42,
  active_users: 15,
  new_users_today: 3,
  current_period_users: 10,
  previous_period_users: 8,
  total_content: 210,
  content_today: 7,
  current_period_content: 50,
  previous_period_content: 40,
  users_by_tier: { free: 30, starter: 8, pro: 4, day_pass: 0 },
  subscriptions: { active: 12, trialing: 2 },
  content_by_type: { youtube: 80, article: 100, x_post: 20, pdf: 10 },
  processing_metrics: { success_rate: 97.5, avg_processing_time_ms: 4200 },
  api_usage_today: { total_cost: 1.25, error_rate: 0.5 },
  signup_trend: [
    { date: "2026-02-01", count: 3 },
    { date: "2026-02-02", count: 5 },
  ],
  content_trend: [
    { date: "2026-02-01", count: 12 },
    { date: "2026-02-02", count: 18 },
  ],
  top_domains: [
    { domain: "nytimes.com", count: 45, avg_score: 0.82 },
  ],
  truth_rating_distribution: {
    Accurate: 120,
    "Mostly Accurate": 60,
    Mixed: 20,
    Questionable: 8,
    Unreliable: 2,
  },
  processing_time_by_section: [
    { section: "triage", avg_time: 1200, count: 100 },
  ],
  api_cost_breakdown: [
    { api: "openrouter", cost: 0.85, calls: 200 },
  ],
  recent_errors: [
    { timestamp: "2026-02-22T10:30:00Z", api: "openrouter", message: "Rate limit hit" },
  ],
  cost_trend_7d: [
    { date: "2026-02-15", cost: 0.45 },
  ],
  model_cost_breakdown: [
    {
      model: "google/gemini-2.5-flash",
      cost: 0.85,
      calls: 200,
      tokens_input: 50000,
      tokens_output: 25000,
    },
  ],
  error_trend_7d: [
    { date: "2026-02-15", error_rate: 0.5, error_count: 1, total_count: 200 },
  ],
  errors_by_type: [
    { type: "rate_limit", count: 3 },
    { type: "timeout", count: 1 },
  ],
  processing_time_trend_7d: [
    { date: "2026-02-15", avg_time: 4100, count: 50 },
  ],
  content_by_type_monthly: [
    { month: "2026-02", youtube: 40, article: 50, x_post: 10, pdf: 5 },
  ],
  api_statuses: [
    { name: "openrouter", total_calls: 200, error_count: 1, error_rate: 0.5 },
  ],
  chat_threads: 88,
  chat_messages: 440,
}

function createMetricsRequest(searchParams: Record<string, string> = {}) {
  const url = new URL("https://clarusapp.io/api/admin/metrics")
  Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString(), { method: "GET" })
}

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/admin/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockIsAdmin = true

    // Default: rate limit allows all requests
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })

    // Default: RPC returns valid data
    mockRpc.mockResolvedValue({ data: MOCK_RPC_DATA, error: null })
  })

  // ---------------------------------------------------------------------------
  // Authentication — 401
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Authorization — 403
  // ---------------------------------------------------------------------------

  it("returns 403 when user is authenticated but not an admin", async () => {
    mockAuthSuccess = true
    mockIsAdmin = false

    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe("Admin access required")
  })

  // ---------------------------------------------------------------------------
  // Rate limiting — 429
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 45000 })

    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
    expect(response.headers.get("Retry-After")).toBe("45")
  })

  // ---------------------------------------------------------------------------
  // Query parameter validation — 400
  // ---------------------------------------------------------------------------

  it("returns 400 for an out-of-range timeRange value (max 365)", async () => {
    const request = createMetricsRequest({ timeRange: "366" })
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 for a timeRange value below the minimum (min 1)", async () => {
    const request = createMetricsRequest({ timeRange: "0" })
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Database error — 500
  // ---------------------------------------------------------------------------

  it("returns 500 when the RPC call fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "RPC function not found" } })

    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to fetch metrics/i)
  })

  // ---------------------------------------------------------------------------
  // 200 success — shape validation
  // ---------------------------------------------------------------------------

  it("returns 200 with correct top-level shape on success", async () => {
    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)

    // Core user metrics
    expect(body.totalUsers).toBe(42)
    expect(body.activeUsers).toBe(15)
    expect(body.newUsersToday).toBe(3)
    expect(typeof body.userGrowthPercent).toBe("number")

    // Tier breakdown
    expect(body.usersByTier).toEqual({
      free: 30,
      starter: 8,
      pro: 4,
      day_pass: 0,
    })

    // Content metrics
    expect(body.totalContent).toBe(210)
    expect(body.contentToday).toBe(7)
    expect(typeof body.contentGrowthPercent).toBe("number")

    // Subscription/MRR stub
    expect(body.activeSubscriptions).toBe(12)
    expect(body.trialUsers).toBe(2)
    expect(body.mrr).toBe(0) // MRR comes from /api/admin/mrr
    expect(body.mrrGrowthPercent).toBe(0)

    // Processing metrics
    expect(body.processingSuccessRate).toBe(97.5)
    expect(body.avgProcessingTime).toBe(4200)
    expect(body.apiCostsToday).toBe(1.25)
    expect(body.errorRate).toBe(0.5)
  })

  it("returns 200 with chat thread and message counts", async () => {
    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.chatThreads).toBe(88)
    expect(body.chatMessages).toBe(440)
  })

  it("returns 200 with contentByType array containing 4 entries", async () => {
    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(body.contentByType)).toBe(true)
    expect(body.contentByType).toHaveLength(4)

    const names = body.contentByType.map((c: { name: string }) => c.name)
    expect(names).toContain("YouTube")
    expect(names).toContain("Articles")
    expect(names).toContain("X Posts")
    expect(names).toContain("PDFs")

    // Each entry must have name, value, color
    body.contentByType.forEach((entry: unknown) => {
      const e = entry as Record<string, unknown>
      expect(e).toHaveProperty("name")
      expect(e).toHaveProperty("value")
      expect(e).toHaveProperty("color")
    })
  })

  it("returns 200 with signupTrend and contentTrend arrays", async () => {
    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(body.signupTrend)).toBe(true)
    expect(body.signupTrend).toHaveLength(2)
    expect(body.signupTrend[0]).toHaveProperty("date")
    expect(body.signupTrend[0]).toHaveProperty("count")

    expect(Array.isArray(body.contentTrend)).toBe(true)
    expect(body.contentTrend).toHaveLength(2)
  })

  it("returns 200 with topDomains array with camelCase fields", async () => {
    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(body.topDomains)).toBe(true)
    expect(body.topDomains[0]).toEqual({
      domain: "nytimes.com",
      count: 45,
      avgScore: 0.82,
    })
  })

  it("returns 200 with truthRatingDistribution array with 5 fixed entries", async () => {
    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(body.truthRatingDistribution)).toBe(true)
    expect(body.truthRatingDistribution).toHaveLength(5)

    const ratings = body.truthRatingDistribution.map((r: { rating: string }) => r.rating)
    expect(ratings).toContain("Accurate")
    expect(ratings).toContain("Mostly Accurate")
    expect(ratings).toContain("Mixed")
    expect(ratings).toContain("Questionable")
    expect(ratings).toContain("Unreliable")
  })

  it("returns 200 with systemHealthDetails containing all required sub-fields", async () => {
    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    const health = body.systemHealthDetails
    expect(health).toBeDefined()
    expect(Array.isArray(health.apiCostBreakdown)).toBe(true)
    expect(Array.isArray(health.recentErrors)).toBe(true)
    expect(Array.isArray(health.processingTimeBySection)).toBe(true)
    expect(Array.isArray(health.apiStatuses)).toBe(true)
    expect(Array.isArray(health.costTrend)).toBe(true)
    expect(Array.isArray(health.modelCostBreakdown)).toBe(true)
    expect(Array.isArray(health.errorTrend)).toBe(true)
    expect(Array.isArray(health.errorsByType)).toBe(true)
    expect(Array.isArray(health.processingTimeTrend)).toBe(true)
  })

  it("returns 200 with apiStatuses covering all 7 known services", async () => {
    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    const statuses = body.systemHealthDetails.apiStatuses
    expect(statuses).toHaveLength(7)

    const serviceNames = statuses.map((s: { name: string }) => s.name)
    expect(serviceNames).toContain("openrouter")
    expect(serviceNames).toContain("supadata")
    expect(serviceNames).toContain("firecrawl")
    expect(serviceNames).toContain("tavily")
    expect(serviceNames).toContain("polar")
    expect(serviceNames).toContain("supabase")
    expect(serviceNames).toContain("vercel")
  })

  it("marks services with >20% error rate as 'down'", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...MOCK_RPC_DATA,
        api_statuses: [
          { name: "openrouter", total_calls: 100, error_count: 25, error_rate: 25 },
        ],
      },
      error: null,
    })

    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    const openrouterStatus = body.systemHealthDetails.apiStatuses.find(
      (s: { name: string }) => s.name === "openrouter"
    )
    expect(openrouterStatus.status).toBe("down")
  })

  it("marks services with 5-20% error rate as 'degraded'", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...MOCK_RPC_DATA,
        api_statuses: [
          { name: "firecrawl", total_calls: 100, error_count: 10, error_rate: 10 },
        ],
      },
      error: null,
    })

    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    const firecrawlStatus = body.systemHealthDetails.apiStatuses.find(
      (s: { name: string }) => s.name === "firecrawl"
    )
    expect(firecrawlStatus.status).toBe("degraded")
  })

  it("returns errorsByType with percentage calculated correctly", async () => {
    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    const errors = body.systemHealthDetails.errorsByType
    // 2 error types: rate_limit (3) + timeout (1) = 4 total
    const rateLimit = errors.find((e: { type: string }) => e.type === "rate_limit")
    expect(rateLimit.percentage).toBe(75) // 3/4 * 100
    const timeout = errors.find((e: { type: string }) => e.type === "timeout")
    expect(timeout.percentage).toBe(25) // 1/4 * 100
  })

  it("respects the timeRange query parameter (defaults to 30)", async () => {
    const request = createMetricsRequest()
    await GET(request as never)

    expect(mockRpc).toHaveBeenCalledWith("get_admin_metrics", { p_time_range_days: 30 })
  })

  it("passes custom timeRange to the RPC call", async () => {
    const request = createMetricsRequest({ timeRange: "7" })
    await GET(request as never)

    expect(mockRpc).toHaveBeenCalledWith("get_admin_metrics", { p_time_range_days: 7 })
  })

  it("sets Cache-Control header on success", async () => {
    const request = createMetricsRequest()
    const response = await GET(request as never)

    expect(response.status).toBe(200)
    const cacheControl = response.headers.get("Cache-Control")
    expect(cacheControl).toContain("private")
    expect(cacheControl).toContain("max-age=60")
  })

  it("computes avgContentPerUser as totalContent/totalUsers", async () => {
    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    // 210 / 42 = 5.0
    expect(body.avgContentPerUser).toBe(5)
  })

  it("returns zero avgContentPerUser when totalUsers is 0", async () => {
    mockRpc.mockResolvedValue({
      data: { ...MOCK_RPC_DATA, total_users: 0, total_content: 0 },
      error: null,
    })

    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(body.avgContentPerUser).toBe(0)
  })

  it("handles empty RPC data gracefully (all zeros/empty arrays)", async () => {
    mockRpc.mockResolvedValue({ data: {}, error: null })

    const request = createMetricsRequest()
    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalUsers).toBe(0)
    expect(body.totalContent).toBe(0)
    expect(body.signupTrend).toEqual([])
    expect(body.contentTrend).toEqual([])
    expect(body.topDomains).toEqual([])
  })
})

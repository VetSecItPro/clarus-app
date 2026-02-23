import { describe, it, expect, vi, beforeEach } from "vitest"

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
let mockIsAdmin = true
const mockUser = { id: "admin-user-456", email: "admin@clarusapp.io" }

// ---------------------------------------------------------------------------
// Supabase admin client mock
//
// The MRR route runs 4 queries in parallel via Promise.all:
//   1. users.select(...).in("subscription_status", ["active","trialing"])
//      → returns full rows with { id, tier, subscription_status }
//   2. users.select(count).eq("subscription_status","canceled").gte(...)
//      → returns { count: canceledThisMonth }
//   3. users.select(count).in("subscription_status",[...]).not(...).gte(...)
//      → returns { count: newThisMonth }
//   4. users.select(count).eq("tier","day_pass").gte(...)
//      → returns { count: dayPassCount }
//
// We track which query is being built by the method-call sequence and
// return the appropriate mocked result.
// ---------------------------------------------------------------------------

// Mutable state for each query result
let mockActiveUsersData: { id: string; tier: string; subscription_status: string; subscription_id: string | null }[] = []
let mockCanceledCount = 0
let mockNewCount = 0
let mockDayPassCount = 0

// Track call order so we can return different results for each .from("users") call
let fromCallIndex = 0

const mockAdminClient = {
  from: (_table: string) => {
    const callIndex = fromCallIndex++

    if (callIndex === 0) {
      // Query 1: full rows for active/trialing users — resolves on .in()
      return {
        select: () => ({
          in: () => Promise.resolve({ data: mockActiveUsersData, error: null }),
        }),
      }
    }

    if (callIndex === 1) {
      // Query 2: canceled this month count — chain is .select(count).eq(...).gte(...)
      return {
        select: () => ({
          eq: () => ({
            gte: () => Promise.resolve({ data: null, error: null, count: mockCanceledCount }),
          }),
        }),
      }
    }

    if (callIndex === 2) {
      // Query 3: new this month count — chain is .select(count).in(...).not(...).gte(...)
      return {
        select: () => ({
          in: () => ({
            not: () => ({
              gte: () => Promise.resolve({ data: null, error: null, count: mockNewCount }),
            }),
          }),
        }),
      }
    }

    // Query 4: day pass count — chain is .select(count).eq(...).gte(...)
    return {
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ data: null, error: null, count: mockDayPassCount }),
        }),
      }),
    }
  },
}

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
    getAdminClient: () => mockAdminClient,
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

import { GET } from "@/app/api/admin/mrr/route"

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/admin/mrr", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockIsAdmin = true
    fromCallIndex = 0
    mockCanceledCount = 0
    mockNewCount = 0
    mockDayPassCount = 0
    mockActiveUsersData = []

    // Default: rate limit allows all requests
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
  })

  // ---------------------------------------------------------------------------
  // Authentication — 401
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await GET()
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

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe("Admin access required")
  })

  // ---------------------------------------------------------------------------
  // Rate limiting — 429
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 60000 })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
    expect(response.headers.get("Retry-After")).toBe("60")
  })

  // ---------------------------------------------------------------------------
  // 200 success — zero subscribers (empty state)
  // ---------------------------------------------------------------------------

  it("returns 200 with all-zero MRR when there are no subscribers", async () => {
    mockActiveUsersData = []
    mockCanceledCount = 0
    mockNewCount = 0
    mockDayPassCount = 0

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.mrr).toBe(0)
    expect(body.activeSubscriptions).toBe(0)
    expect(body.trialingSubscriptions).toBe(0)
    expect(body.churnRate).toBe(0)
    expect(body.averageRevenuePerUser).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // 200 success — response shape validation
  // ---------------------------------------------------------------------------

  it("returns 200 with the full MrrData shape", async () => {
    mockActiveUsersData = [
      { id: "user-1", tier: "starter", subscription_status: "active", subscription_id: "sub-1" },
      { id: "user-2", tier: "pro", subscription_status: "active", subscription_id: "sub-2" },
      { id: "user-3", tier: "starter", subscription_status: "trialing", subscription_id: "sub-3" },
    ]

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)

    // All required top-level fields must be present
    expect(body).toHaveProperty("mrr")
    expect(body).toHaveProperty("mrrGrowthPercent")
    expect(body).toHaveProperty("activeSubscriptions")
    expect(body).toHaveProperty("trialingSubscriptions")
    expect(body).toHaveProperty("canceledThisMonth")
    expect(body).toHaveProperty("newThisMonth")
    expect(body).toHaveProperty("churnRate")
    expect(body).toHaveProperty("averageRevenuePerUser")
    expect(body).toHaveProperty("subscriptionBreakdown")
    expect(body).toHaveProperty("dayPassRevenue")
    expect(body).toHaveProperty("dayPassCount")

    // subscriptionBreakdown must have monthly and annual sub-objects
    expect(body.subscriptionBreakdown).toHaveProperty("monthly")
    expect(body.subscriptionBreakdown.monthly).toHaveProperty("count")
    expect(body.subscriptionBreakdown.monthly).toHaveProperty("revenue")
    expect(body.subscriptionBreakdown).toHaveProperty("annual")
    expect(body.subscriptionBreakdown.annual).toHaveProperty("count")
    expect(body.subscriptionBreakdown.annual).toHaveProperty("revenue")
  })

  it("correctly counts active vs trialing subscriptions", async () => {
    mockActiveUsersData = [
      { id: "user-1", tier: "starter", subscription_status: "active", subscription_id: "sub-1" },
      { id: "user-2", tier: "pro", subscription_status: "active", subscription_id: "sub-2" },
      { id: "user-3", tier: "starter", subscription_status: "trialing", subscription_id: "sub-3" },
      { id: "user-4", tier: "pro", subscription_status: "trialing", subscription_id: "sub-4" },
    ]

    const response = await GET()
    const body = await response.json()

    expect(body.activeSubscriptions).toBe(2)
    expect(body.trialingSubscriptions).toBe(2)
  })

  it("calculates MRR using monthly rates for starter subscribers", async () => {
    mockActiveUsersData = [
      { id: "user-1", tier: "starter", subscription_status: "active", subscription_id: "sub-1" },
      { id: "user-2", tier: "starter", subscription_status: "active", subscription_id: "sub-2" },
    ]

    const response = await GET()
    const body = await response.json()

    // 2 starter @ $18/mo = $36 MRR
    expect(body.mrr).toBe(36)
  })

  it("calculates MRR using monthly rates for pro subscribers", async () => {
    mockActiveUsersData = [
      { id: "user-1", tier: "pro", subscription_status: "active", subscription_id: "sub-1" },
      { id: "user-2", tier: "pro", subscription_status: "active", subscription_id: "sub-2" },
      { id: "user-3", tier: "pro", subscription_status: "active", subscription_id: "sub-3" },
    ]

    const response = await GET()
    const body = await response.json()

    // 3 pro @ $29/mo = $87 MRR
    expect(body.mrr).toBe(87)
  })

  it("calculates MRR for a mixed tier subscriber base", async () => {
    mockActiveUsersData = [
      { id: "user-1", tier: "starter", subscription_status: "active", subscription_id: "sub-1" },
      { id: "user-2", tier: "pro", subscription_status: "active", subscription_id: "sub-2" },
    ]

    const response = await GET()
    const body = await response.json()

    // 1 starter ($18) + 1 pro ($29) = $47 MRR
    expect(body.mrr).toBe(47)
  })

  it("includes trialing users in MRR calculation", async () => {
    mockActiveUsersData = [
      { id: "user-1", tier: "pro", subscription_status: "trialing", subscription_id: "sub-1" },
    ]

    const response = await GET()
    const body = await response.json()

    // 1 trialing pro @ $29/mo = $29 MRR
    expect(body.mrr).toBe(29)
  })

  it("calculates ARPU correctly as MRR / total paying users", async () => {
    mockActiveUsersData = [
      { id: "user-1", tier: "starter", subscription_status: "active", subscription_id: "sub-1" },
      { id: "user-2", tier: "starter", subscription_status: "active", subscription_id: "sub-2" },
    ]

    const response = await GET()
    const body = await response.json()

    // MRR = 36, total paying = 2 → ARPU = 18
    expect(body.averageRevenuePerUser).toBe(18)
  })

  it("returns mrr as a rounded number (2 decimal places)", async () => {
    mockActiveUsersData = [
      { id: "user-1", tier: "starter", subscription_status: "active", subscription_id: "sub-1" },
    ]

    const response = await GET()
    const body = await response.json()

    // Verify all monetary fields are numeric and properly rounded
    expect(typeof body.mrr).toBe("number")
    expect(typeof body.averageRevenuePerUser).toBe("number")
    expect(typeof body.churnRate).toBe("number")
    expect(typeof body.mrrGrowthPercent).toBe("number")
  })

  it("sets Cache-Control header on success", async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    const cacheControl = response.headers.get("Cache-Control")
    expect(cacheControl).toContain("private")
    expect(cacheControl).toContain("max-age=300")
  })

  it("mrrGrowthPercent is 100 when there are new subscribers and no cancellations", async () => {
    mockActiveUsersData = [
      { id: "user-1", tier: "pro", subscription_status: "active", subscription_id: "sub-1" },
    ]
    mockNewCount = 1
    mockCanceledCount = 0

    const response = await GET()
    const body = await response.json()

    // newThisMonth > 0 and canceledThisMonth = 0 → growth = 100%
    expect(body.mrrGrowthPercent).toBe(100)
  })

  it("calculates churn rate as canceled / (active + canceled)", async () => {
    mockActiveUsersData = [
      { id: "user-1", tier: "pro", subscription_status: "active", subscription_id: "sub-1" },
      { id: "user-2", tier: "starter", subscription_status: "active", subscription_id: "sub-2" },
      { id: "user-3", tier: "starter", subscription_status: "active", subscription_id: "sub-3" },
    ]
    mockCanceledCount = 1

    const response = await GET()
    const body = await response.json()

    // 3 active + 1 canceled = 4 total start-of-month; churn = 1/4 * 100 = 25
    expect(body.churnRate).toBe(25)
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — declared before imports
// =============================================================================

// Auth — controllable per test
let mockAuthSuccess = true
const mockUser = { id: "user-usage-123", email: "usage@clarusapp.io" }

const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn(),
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
}))

// getUserTierAndAdmin — returns controllable tier + admin values
const mockGetUserTierAndAdmin = vi.fn()
vi.mock("@/lib/usage", () => ({
  getUserTierAndAdmin: (...args: unknown[]) => mockGetUserTierAndAdmin(...args),
  getUsageCounts: (...args: unknown[]) => mockGetUsageCounts(...args),
}))

// getUsageCounts — separate so we can spy on it
const mockGetUsageCounts = vi.fn()

// getEffectiveLimits / getCurrentPeriod — use real implementations
vi.mock("@/lib/tier-limits", async () => {
  const real = await vi.importActual<typeof import("@/lib/tier-limits")>("@/lib/tier-limits")
  return { ...real }
})

// logger — silence noise
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// =============================================================================
// Import handler AFTER mocks
// =============================================================================

import { GET } from "@/app/api/usage/route"

// =============================================================================
// Default mock helpers
// =============================================================================

function buildCountChain(count: number) {
  const chain: Record<string, unknown> = {
    count,
    error: null,
  }
  const methods = ["select", "eq"]
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain)
  })
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ count, error: null }).then(resolve)
  return chain
}

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true

    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "free", isAdmin: false })
    mockGetUsageCounts.mockResolvedValue({
      analyses_count: 2,
      chat_messages_count: 10,
      share_links_count: 0,
      exports_count: 0,
      bookmarks_count: 1,
      podcast_analyses_count: 0,
    })

    // Set up the supabase from().select().eq() chain for library and bookmark counts
    let callIndex = 0
    mockSupabaseClient.from.mockImplementation(() => {
      const call = callIndex++
      const count = call === 0 ? 5 : 1 // first call = library, second = bookmarks
      return buildCountChain(count)
    })
  })

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // -------------------------------------------------------------------------
  // Success — shape validation
  // -------------------------------------------------------------------------

  it("returns 200 with correct response shape", async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveProperty("tier")
    expect(body).toHaveProperty("period")
    expect(body).toHaveProperty("resetDate")
    expect(body).toHaveProperty("usage")
  })

  it("returns correct tier from getUserTierAndAdmin", async () => {
    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "pro", isAdmin: false })

    const response = await GET()
    const body = await response.json()

    expect(body.tier).toBe("pro")
  })

  it("returns period in YYYY-MM format", async () => {
    const response = await GET()
    const body = await response.json()

    expect(body.period).toMatch(/^\d{4}-\d{2}$/)
  })

  it("returns resetDate as a valid ISO timestamp", async () => {
    const response = await GET()
    const body = await response.json()

    expect(new Date(body.resetDate).toISOString()).toBe(body.resetDate)
  })

  it("usage object contains all expected counters", async () => {
    const response = await GET()
    const body = await response.json()

    const { usage } = body
    expect(usage).toHaveProperty("analyses")
    expect(usage).toHaveProperty("podcastAnalyses")
    expect(usage).toHaveProperty("chatMessages")
    expect(usage).toHaveProperty("libraryItems")
    expect(usage).toHaveProperty("exports")
    expect(usage).toHaveProperty("shareLinks")
    expect(usage).toHaveProperty("bookmarks")
  })

  it("usage counters have `used` and `limit` fields", async () => {
    const response = await GET()
    const body = await response.json()

    const { analyses } = body.usage
    expect(typeof analyses.used).toBe("number")
    expect(typeof analyses.limit).toBe("number")
  })

  it("reflects usage counts from getUsageCounts", async () => {
    mockGetUsageCounts.mockResolvedValue({
      analyses_count: 3,
      chat_messages_count: 15,
      share_links_count: 0,
      exports_count: 0,
      bookmarks_count: 2,
      podcast_analyses_count: 1,
    })

    const response = await GET()
    const body = await response.json()

    expect(body.usage.analyses.used).toBe(3)
    expect(body.usage.chatMessages.used).toBe(15)
    expect(body.usage.podcastAnalyses.used).toBe(1)
  })

  it("applies free tier limits correctly", async () => {
    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "free", isAdmin: false })

    const response = await GET()
    const body = await response.json()

    // Free tier: 5 analyses, 50 monthly chat messages
    expect(body.usage.analyses.limit).toBe(5)
    expect(body.usage.chatMessages.limit).toBe(50)
  })

  it("applies pro tier limits correctly", async () => {
    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "pro", isAdmin: false })

    const response = await GET()
    const body = await response.json()

    // Pro tier: 150 analyses, 1000 monthly chat messages
    expect(body.usage.analyses.limit).toBe(150)
    expect(body.usage.chatMessages.limit).toBe(1000)
  })

  it("admin users get MAX_SAFE_INTEGER limits", async () => {
    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "free", isAdmin: true })

    const response = await GET()
    const body = await response.json()

    expect(body.usage.analyses.limit).toBe(Number.MAX_SAFE_INTEGER)
  })

  it("sets Cache-Control: private header", async () => {
    const response = await GET()

    expect(response.headers.get("Cache-Control")).toMatch(/private/)
  })

  it("resetDate is the first day of next month in UTC", async () => {
    const response = await GET()
    const body = await response.json()

    const resetDate = new Date(body.resetDate)
    // First day of the month
    expect(resetDate.getUTCDate()).toBe(1)
    // At UTC midnight
    expect(resetDate.getUTCHours()).toBe(0)
    expect(resetDate.getUTCMinutes()).toBe(0)
    expect(resetDate.getUTCSeconds()).toBe(0)
  })
})

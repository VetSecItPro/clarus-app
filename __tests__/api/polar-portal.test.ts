import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — declared before imports
// =============================================================================

// Rate limiting — always allow by default
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Polar SDK — mock the customerSessions.create method
const mockCreatePortalSession = vi.fn()
vi.mock("@/lib/polar", () => ({
  getPolar: () => ({
    customerSessions: {
      create: (...args: unknown[]) => mockCreatePortalSession(...args),
    },
  }),
}))

// logger — silence noise
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// =============================================================================
// Supabase SSR + cookies mocks
// =============================================================================

// Auth user returned by supabase.auth.getUser()
let mockAuthUser: { id: string; email: string } | null = {
  id: "user-portal-123",
  email: "portal@clarusapp.io",
}
let mockPolarCustomerId: string | null = "polar_cust_abc123"

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(async () => {
      if (!mockAuthUser) return { data: { user: null }, error: new Error("Not authenticated") }
      return { data: { user: mockAuthUser }, error: null }
    }),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(async () => ({
      data: mockPolarCustomerId ? { polar_customer_id: mockPolarCustomerId } : null,
      error: null,
    })),
  })),
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}))

// =============================================================================
// Import handler AFTER mocks
// =============================================================================

import { POST } from "@/app/api/polar/portal/route"

// =============================================================================
// Helpers
// =============================================================================

function createRequest(headers: Record<string, string> = {}) {
  return new Request("https://clarusapp.io/api/polar/portal", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/polar/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthUser = { id: "user-portal-123", email: "portal@clarusapp.io" }
    mockPolarCustomerId = "polar_cust_abc123"

    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })

    mockCreatePortalSession.mockResolvedValue({
      customerPortalUrl: "https://portal.polar.sh/session/abc123",
    })

    // Re-bind the mocked supabase so sub-methods return correct defaults
    mockSupabaseClient.auth.getUser.mockImplementation(async () => {
      if (!mockAuthUser) return { data: { user: null }, error: new Error("Not authenticated") }
      return { data: { user: mockAuthUser }, error: null }
    })

    mockSupabaseClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: mockPolarCustomerId ? { polar_customer_id: mockPolarCustomerId } : null,
        error: null,
      })),
    }))
  })

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 60000 })

    const response = await POST(createRequest())
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
  })

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthUser = null

    const response = await POST(createRequest())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/not authenticated/i)
  })

  // -------------------------------------------------------------------------
  // Missing subscription
  // -------------------------------------------------------------------------

  it("returns 400 when user has no polar_customer_id", async () => {
    mockPolarCustomerId = null

    const response = await POST(createRequest())
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/no subscription found/i)
  })

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------

  it("returns 200 with the customer portal URL on success", async () => {
    const response = await POST(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.url).toBe("https://portal.polar.sh/session/abc123")
  })

  it("calls polar.customerSessions.create with the correct customer ID", async () => {
    await POST(createRequest())

    expect(mockCreatePortalSession).toHaveBeenCalledWith({
      customerId: "polar_cust_abc123",
    })
  })

  // -------------------------------------------------------------------------
  // Error path
  // -------------------------------------------------------------------------

  it("returns 500 when polar SDK throws an error", async () => {
    mockCreatePortalSession.mockRejectedValue(new Error("Polar API unavailable"))

    const response = await POST(createRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to access billing portal/i)
  })
})

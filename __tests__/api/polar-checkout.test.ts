import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

// Rate limiting — allow all requests by default
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Polar SDK + PRODUCTS constant
const mockCheckoutsCreate = vi.fn()
vi.mock("@/lib/polar", () => ({
  getPolar: () => ({
    checkouts: {
      create: (...args: unknown[]) => mockCheckoutsCreate(...args),
    },
  }),
  // Simulate realistic product IDs — non-empty strings so productId resolves
  PRODUCTS: {
    starter_monthly: "prod_starter_monthly",
    starter_annual: "prod_starter_annual",
    pro_monthly: "prod_pro_monthly",
    pro_annual: "prod_pro_annual",
    day_pass: "prod_day_pass",
  },
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

// next/headers — mock cookies()
// NOTE: vi.mock factories are hoisted, so we cannot reference top-level variables
// inside them. Inline the cookie store object directly in the factory.
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Supabase SSR — controllable auth and user-data lookups
// ---------------------------------------------------------------------------

let mockGetUser: () => Promise<{
  data: { user: { id: string; email?: string } | null }
  error: { message: string } | null
}>

let mockUserData: {
  tier?: string
  subscription_status?: string
  day_pass_expires_at?: string | null
  polar_customer_id?: string | null
  email?: string
} | null

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (_table: string) => ({
      select: (_fields: string) => ({
        eq: (_field: string, _value: string) => ({
          single: () =>
            Promise.resolve({
              data: mockUserData,
              error: mockUserData ? null : { code: "PGRST116" },
            }),
        }),
      }),
    }),
  }),
}))

// =============================================================================
// Import handler after mocks are in place
// =============================================================================

import { POST } from "@/app/api/polar/checkout/route"

// =============================================================================
// Helpers
// =============================================================================

function createRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://clarusapp.io/api/polar/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://clarusapp.io",
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/polar/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: rate limit allows all requests
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetIn: 0 })

    // Default: user is authenticated
    mockGetUser = () =>
      Promise.resolve({
        data: { user: { id: "user-123", email: "test@clarusapp.io" } },
        error: null,
      })

    // Default: standard free user with no active sub or day pass
    mockUserData = {
      tier: "free",
      subscription_status: null,
      day_pass_expires_at: null,
      polar_customer_id: null,
      email: "test@clarusapp.io",
    }

    // Default: Polar returns a checkout URL
    mockCheckoutsCreate.mockResolvedValue({
      url: "https://checkout.polar.sh/session-123",
    })
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 30000 })

    const request = createRequest({ tier: "starter", interval: "monthly" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
  })

  // ---------------------------------------------------------------------------
  // Request body validation
  // ---------------------------------------------------------------------------

  it("returns 400 when body is missing required tier field", async () => {
    const request = createRequest({ interval: "monthly" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when tier is an invalid value", async () => {
    const request = createRequest({ tier: "enterprise", interval: "monthly" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when interval is missing for a subscription tier", async () => {
    // starter/pro require interval — omitting it triggers the explicit guard
    const request = createRequest({ tier: "starter" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/interval is required/i)
  })

  it("returns 400 when interval value is invalid", async () => {
    const request = createRequest({ tier: "pro", interval: "weekly" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Product ID resolution — 503 when env var is empty string
  // ---------------------------------------------------------------------------

  it("returns 503 when the resolved product ID is not configured", async () => {
    // Override PRODUCTS so the combination resolves to an empty string
    const polar = await import("@/lib/polar")
    const originalProducts = { ...polar.PRODUCTS }

    // Temporarily blank out the starter_monthly product ID
    ;(polar.PRODUCTS as Record<string, string>).starter_monthly = ""

    const request = createRequest({ tier: "starter", interval: "monthly" })
    const response = await POST(request)
    const body = await response.json()

    // Restore
    Object.assign(polar.PRODUCTS, originalProducts)

    expect(response.status).toBe(503)
    expect(body.error).toMatch(/not configured/i)
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser = () =>
      Promise.resolve({
        data: { user: null },
        error: { message: "Not authenticated" },
      })

    const request = createRequest({ tier: "starter", interval: "monthly" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/not authenticated/i)
  })

  it("returns 401 when auth errors out with no user", async () => {
    mockGetUser = () =>
      Promise.resolve({
        data: { user: null },
        error: null,
      })

    const request = createRequest({ tier: "pro", interval: "annual" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/not authenticated/i)
  })

  // ---------------------------------------------------------------------------
  // Day pass abuse prevention
  // ---------------------------------------------------------------------------

  it("returns 400 when user on active starter sub tries to buy a day pass", async () => {
    mockUserData = {
      tier: "starter",
      subscription_status: "active",
      day_pass_expires_at: null,
      polar_customer_id: "cust_abc",
    }

    const request = createRequest({ tier: "day_pass" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/active subscription/i)
  })

  it("returns 400 when user on trialing pro sub tries to buy a day pass", async () => {
    mockUserData = {
      tier: "pro",
      subscription_status: "trialing",
      day_pass_expires_at: null,
      polar_customer_id: "cust_abc",
    }

    const request = createRequest({ tier: "day_pass" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/active subscription/i)
  })

  it("returns 400 when user already has an active day pass", async () => {
    // Set an expiry date 24 h in the future
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    mockUserData = {
      tier: "day_pass",
      subscription_status: null,
      day_pass_expires_at: future,
      polar_customer_id: null,
    }

    const request = createRequest({ tier: "day_pass" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/already have an active day pass/i)
  })

  it("allows a day pass purchase when the previous one has already expired", async () => {
    // Expiry date in the past
    const past = new Date(Date.now() - 1000).toISOString()
    mockUserData = {
      tier: "free",
      subscription_status: null,
      day_pass_expires_at: past,
      polar_customer_id: null,
    }

    const request = createRequest({ tier: "day_pass" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.url).toBe("https://checkout.polar.sh/session-123")
  })

  // ---------------------------------------------------------------------------
  // Success cases
  // ---------------------------------------------------------------------------

  it("returns 200 with checkout URL for starter monthly subscription", async () => {
    const request = createRequest({ tier: "starter", interval: "monthly" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.url).toBe("https://checkout.polar.sh/session-123")
  })

  it("returns 200 with checkout URL for pro annual subscription", async () => {
    const request = createRequest({ tier: "pro", interval: "annual" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.url).toBe("https://checkout.polar.sh/session-123")
  })

  it("returns 200 with checkout URL for a day pass (no interval required)", async () => {
    const request = createRequest({ tier: "day_pass" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.url).toBe("https://checkout.polar.sh/session-123")
  })

  // ---------------------------------------------------------------------------
  // Polar SDK call verification
  // ---------------------------------------------------------------------------

  it("calls polar.checkouts.create with the correct product and metadata", async () => {
    const request = createRequest({ tier: "pro", interval: "monthly" })
    await POST(request)

    expect(mockCheckoutsCreate).toHaveBeenCalledOnce()
    expect(mockCheckoutsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        products: ["prod_pro_monthly"],
        successUrl: expect.stringContaining("success=true"),
        customerEmail: "test@clarusapp.io",
        metadata: expect.objectContaining({
          supabase_user_id: "user-123",
          tier: "pro",
          interval: "monthly",
        }),
      })
    )
  })

  it("omits interval from metadata for day pass checkouts", async () => {
    const request = createRequest({ tier: "day_pass" })
    await POST(request)

    expect(mockCheckoutsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        products: ["prod_day_pass"],
        metadata: expect.objectContaining({
          supabase_user_id: "user-123",
          tier: "day_pass",
        }),
      })
    )

    const callArg = mockCheckoutsCreate.mock.calls[0][0] as { metadata: Record<string, unknown> }
    expect(callArg.metadata).not.toHaveProperty("interval")
  })

  // ---------------------------------------------------------------------------
  // Open redirect protection
  // ---------------------------------------------------------------------------

  it("ignores untrusted origin headers and falls back to clarusapp.io", async () => {
    const request = createRequest(
      { tier: "starter", interval: "monthly" },
      { origin: "https://evil.example.com" }
    )
    await POST(request)

    const callArg = mockCheckoutsCreate.mock.calls[0][0] as { successUrl: string }
    expect(callArg.successUrl).toMatch(/^https:\/\/clarusapp\.io/)
  })

  it("uses localhost origin when request comes from localhost:3000", async () => {
    const request = createRequest(
      { tier: "starter", interval: "monthly" },
      { origin: "http://localhost:3000" }
    )
    await POST(request)

    const callArg = mockCheckoutsCreate.mock.calls[0][0] as { successUrl: string }
    expect(callArg.successUrl).toMatch(/^http:\/\/localhost:3000/)
  })

  // ---------------------------------------------------------------------------
  // Polar SDK failure
  // ---------------------------------------------------------------------------

  it("returns 500 when the Polar SDK throws an error", async () => {
    mockCheckoutsCreate.mockRejectedValue(new Error("Polar API unavailable"))

    const request = createRequest({ tier: "pro", interval: "monthly" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/checkout failed/i)
  })
})

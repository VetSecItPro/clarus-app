import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

// Rate limiting — allow all by default
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Auth — controllable per test
let mockAuthSuccess = true
const mockUser = { id: "user-digest-123", email: "digest@clarusapp.io" }

// Mutable supabase instance
let mockSupabase: Record<string, unknown> = {}

vi.mock("@/lib/auth", () => ({
  authenticateRequest: vi.fn(async () => {
    if (!mockAuthSuccess) {
      const { NextResponse } = await import("next/server")
      return {
        success: false,
        response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      }
    }
    return { success: true, user: mockUser, supabase: mockSupabase }
  }),
  AuthErrors: {
    rateLimit: (resetIn: number) => {
      const { NextResponse } = require("next/server")
      const retryAfter = Math.ceil(resetIn / 1000)
      const res = NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
      res.headers.set("Retry-After", String(retryAfter))
      return res
    },
  },
}))

// =============================================================================
// Import handler AFTER mocks are in place
// =============================================================================

import { GET, PATCH } from "@/app/api/user/digest-preferences/route"

// =============================================================================
// Helpers
// =============================================================================

function createGetRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://clarusapp.io/api/user/digest-preferences", {
    method: "GET",
    headers: { "x-forwarded-for": "1.2.3.4", ...headers },
  })
}

function createPatchRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://clarusapp.io/api/user/digest-preferences", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

// Build GET supabase mock
function buildGetMock(result: { data: unknown; error: unknown }) {
  return {
    from: (_table: string) => ({
      select: (_fields: string) => ({
        eq: (_field: string, _value: unknown) => ({
          single: () => Promise.resolve(result),
        }),
      }),
    }),
  }
}

// Build PATCH supabase mock
function buildPatchMock(result: { error: unknown }) {
  return {
    from: (_table: string) => ({
      update: (_data: unknown) => ({
        eq: (_field: string, _value: unknown) => Promise.resolve(result),
      }),
    }),
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/user/digest-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockSupabase = buildGetMock({ data: { digest_enabled: true }, error: null })
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it("returns 429 when read rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 45000 })

    const response = await GET(createGetRequest())
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
    expect(response.headers.get("Retry-After")).toBe("45")
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await GET(createGetRequest())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Success cases
  // ---------------------------------------------------------------------------

  it("returns 200 with digest_enabled=true when enabled in DB", async () => {
    mockSupabase = buildGetMock({ data: { digest_enabled: true }, error: null })

    const response = await GET(createGetRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.digest_enabled).toBe(true)
  })

  it("returns 200 with digest_enabled=false when disabled in DB", async () => {
    mockSupabase = buildGetMock({ data: { digest_enabled: false }, error: null })

    const response = await GET(createGetRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.digest_enabled).toBe(false)
  })

  it("defaults digest_enabled to true when DB value is null", async () => {
    mockSupabase = buildGetMock({ data: { digest_enabled: null }, error: null })

    const response = await GET(createGetRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.digest_enabled).toBe(true)
  })

  it("sets Cache-Control header on successful response", async () => {
    const response = await GET(createGetRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toMatch(/private/)
  })

  // ---------------------------------------------------------------------------
  // Database error
  // ---------------------------------------------------------------------------

  it("returns 500 when database query fails", async () => {
    mockSupabase = buildGetMock({ data: null, error: { message: "DB error" } })

    const response = await GET(createGetRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to fetch preferences/i)
  })
})

describe("PATCH /api/user/digest-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockSupabase = buildPatchMock({ error: null })
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it("returns 429 when write rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 20000 })

    const response = await PATCH(createPatchRequest({ digest_enabled: true }))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await PATCH(createPatchRequest({ digest_enabled: false }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Request body validation
  // ---------------------------------------------------------------------------

  it("returns 400 when digest_enabled is missing", async () => {
    const response = await PATCH(createPatchRequest({}))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when digest_enabled is not a boolean", async () => {
    const response = await PATCH(createPatchRequest({ digest_enabled: "yes" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Success cases
  // ---------------------------------------------------------------------------

  it("returns 200 after disabling digest", async () => {
    const response = await PATCH(createPatchRequest({ digest_enabled: false }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.digest_enabled).toBe(false)
  })

  it("returns 200 after enabling digest", async () => {
    const response = await PATCH(createPatchRequest({ digest_enabled: true }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.digest_enabled).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Database error
  // ---------------------------------------------------------------------------

  it("returns 500 when database update fails", async () => {
    mockSupabase = buildPatchMock({ error: { message: "Update failed" } })

    const response = await PATCH(createPatchRequest({ digest_enabled: true }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to update preferences/i)
  })
})

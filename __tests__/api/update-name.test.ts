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
const mockUser = { id: "user-name-123", email: "name@clarusapp.io" }

// Mutable admin client DB calls
let mockExistingUser: { id: string } | null = null
let mockExistingUserError: { message: string } | null = null
let mockUpdateError: { message: string } | null = null

// Build a chainable mock for the admin client
function buildAdminClientMock() {
  return {
    from: (_table: string) => ({
      select: (_fields: string) => ({
        eq: (_field: string, _value: unknown) => ({
          neq: (_field2: string, _value2: unknown) => ({
            maybeSingle: () =>
              Promise.resolve({ data: mockExistingUser, error: mockExistingUserError }),
          }),
        }),
      }),
      update: (_data: unknown) => ({
        eq: (_field: string, _value: unknown) =>
          Promise.resolve({ error: mockUpdateError }),
      }),
    }),
  }
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
    return { success: true, user: mockUser, supabase: {} }
  }),
  getAdminClient: vi.fn(() => buildAdminClientMock()),
  AuthErrors: {
    badRequest: (message = "Invalid request") => {
      const { NextResponse } = require("next/server")
      return NextResponse.json({ error: message }, { status: 400 })
    },
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

import { POST } from "@/app/api/user/update-name/route"

// =============================================================================
// Helpers
// =============================================================================

function createRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://clarusapp.io/api/user/update-name", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/user/update-name", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockExistingUser = null
    mockExistingUserError = null
    mockUpdateError = null
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })

    const response = await POST(createRequest({ name: "validname" }))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
    expect(response.headers.get("Retry-After")).toBe("30")
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await POST(createRequest({ name: "validname" }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Request body validation
  // ---------------------------------------------------------------------------

  it("returns 400 when name is missing from body", async () => {
    const response = await POST(createRequest({}))
    const body = await response.json()

    // The route catches JSON parse / validation errors with a catch block returning 400
    expect([400]).toContain(response.status)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when name is too short (< 3 chars)", async () => {
    const response = await POST(createRequest({ name: "ab" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when name is too long (> 20 chars)", async () => {
    const response = await POST(createRequest({ name: "a".repeat(21) }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when name contains invalid characters (spaces)", async () => {
    const response = await POST(createRequest({ name: "invalid name" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when name contains special characters (hyphens)", async () => {
    const response = await POST(createRequest({ name: "bad-name!" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Uniqueness check
  // ---------------------------------------------------------------------------

  it("returns 409 when name is already taken by another user", async () => {
    mockExistingUser = { id: "another-user-456" }

    const response = await POST(createRequest({ name: "takenname" }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/already taken/i)
  })

  // ---------------------------------------------------------------------------
  // Success cases
  // ---------------------------------------------------------------------------

  it("returns 200 with success=true when name is updated", async () => {
    mockExistingUser = null

    const response = await POST(createRequest({ name: "newname" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("accepts names with underscores", async () => {
    const response = await POST(createRequest({ name: "cool_user_99" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("accepts names with mixed case letters and numbers", async () => {
    const response = await POST(createRequest({ name: "User123" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("accepts a name at exactly 3 characters (min boundary)", async () => {
    const response = await POST(createRequest({ name: "abc" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("accepts a name at exactly 20 characters (max boundary)", async () => {
    const response = await POST(createRequest({ name: "a".repeat(20) }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Database error
  // ---------------------------------------------------------------------------

  it("returns 500 when database update fails", async () => {
    mockUpdateError = { message: "Update failed" }

    const response = await POST(createRequest({ name: "validname" }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/failed to update name/i)
  })
})

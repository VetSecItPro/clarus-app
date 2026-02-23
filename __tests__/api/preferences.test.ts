import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

// Auth — controllable per test
let mockAuthSuccess = true
const mockUser = { id: "user-prefs-123", email: "prefs@clarusapp.io" }

// Mutable supabase instance so individual tests can override query behaviour
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
}))

// getUserTier — controllable per test
const mockGetUserTier = vi.fn()
vi.mock("@/lib/usage", () => ({
  getUserTier: (...args: unknown[]) => mockGetUserTier(...args),
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

import { GET, PUT } from "@/app/api/preferences/route"

// =============================================================================
// Helpers
// =============================================================================

function createPutRequest(body: unknown): Request {
  return new Request("https://clarusapp.io/api/preferences", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

// Build a chainable Supabase mock for preferences queries
function buildGetMock(result: { data: unknown; error: unknown }) {
  return {
    from: (_table: string) => ({
      select: (_fields: string) => ({
        eq: (_field: string, _value: unknown) => ({
          maybeSingle: () => Promise.resolve(result),
        }),
      }),
    }),
  }
}

function buildUpsertMock(result: { data: unknown; error: unknown }) {
  return {
    from: (_table: string) => ({
      upsert: (_data: unknown, _opts: unknown) => ({
        select: (_fields: string) => ({
          single: () => Promise.resolve(result),
        }),
      }),
    }),
  }
}

// =============================================================================
// Tests
// =============================================================================

const STORED_PREFERENCES = {
  analysis_mode: "learn",
  expertise_level: "beginner",
  focus_areas: ["accuracy"],
  is_active: true,
  updated_at: "2026-01-01T00:00:00.000Z",
}

describe("GET /api/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockGetUserTier.mockResolvedValue("starter")
    mockSupabase = buildGetMock({ data: STORED_PREFERENCES, error: null })
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Success cases
  // ---------------------------------------------------------------------------

  it("returns 200 with stored preferences when a row exists", async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.hasCustomPreferences).toBe(true)
    expect(body.preferences).toMatchObject({
      analysis_mode: "learn",
      expertise_level: "beginner",
    })
  })

  it("returns default preferences with hasCustomPreferences=false when no row exists", async () => {
    mockSupabase = buildGetMock({ data: null, error: null })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.hasCustomPreferences).toBe(false)
    expect(body.preferences).toMatchObject({
      analysis_mode: "apply",
      expertise_level: "intermediate",
    })
  })

  it("sets Cache-Control header on successful response", async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toMatch(/private/)
  })

  // ---------------------------------------------------------------------------
  // Database error
  // ---------------------------------------------------------------------------

  it("returns 500 when database query fails", async () => {
    mockSupabase = buildGetMock({ data: null, error: { message: "DB error" } })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to fetch preferences/i)
  })
})

describe("PUT /api/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockGetUserTier.mockResolvedValue("starter")
    mockSupabase = buildUpsertMock({ data: STORED_PREFERENCES, error: null })
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await PUT(createPutRequest({ analysis_mode: "learn" }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Tier gate
  // ---------------------------------------------------------------------------

  it("returns 403 for free users who cannot save preferences", async () => {
    mockGetUserTier.mockResolvedValue("free")

    const response = await PUT(createPutRequest({ analysis_mode: "learn" }))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/starter plan/i)
  })

  it("allows starter tier users to save preferences", async () => {
    mockGetUserTier.mockResolvedValue("starter")

    const response = await PUT(createPutRequest({ analysis_mode: "learn" }))

    expect(response.status).toBe(200)
  })

  it("allows pro tier users to save preferences", async () => {
    mockGetUserTier.mockResolvedValue("pro")

    const response = await PUT(createPutRequest({ analysis_mode: "evaluate" }))

    expect(response.status).toBe(200)
  })

  // ---------------------------------------------------------------------------
  // Request body validation
  // ---------------------------------------------------------------------------

  it("returns 400 for invalid JSON body", async () => {
    const request = new Request("https://clarusapp.io/api/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not-valid-json{{",
    })

    const response = await PUT(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/invalid json/i)
  })

  it("returns 400 when analysis_mode is not a valid enum value", async () => {
    const response = await PUT(createPutRequest({ analysis_mode: "invalid_mode" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when expertise_level is not a valid enum value", async () => {
    const response = await PUT(createPutRequest({ expertise_level: "master" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when focus_areas exceeds 3 items", async () => {
    const response = await PUT(
      createPutRequest({ focus_areas: ["accuracy", "takeaways", "depth", "bias"] })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when focus_areas contains duplicates", async () => {
    const response = await PUT(
      createPutRequest({ focus_areas: ["accuracy", "accuracy"] })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Success case
  // ---------------------------------------------------------------------------

  it("returns 200 with updated preferences on valid request", async () => {
    const response = await PUT(
      createPutRequest({ analysis_mode: "learn", expertise_level: "beginner" })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.preferences).toBeDefined()
    expect(body.preferences.analysis_mode).toBe("learn")
  })

  it("accepts partial updates (only analysis_mode)", async () => {
    const response = await PUT(createPutRequest({ analysis_mode: "discover" }))

    expect(response.status).toBe(200)
  })

  it("accepts all valid focus_areas", async () => {
    const response = await PUT(
      createPutRequest({ focus_areas: ["accuracy", "takeaways", "depth"] })
    )

    expect(response.status).toBe(200)
  })

  // ---------------------------------------------------------------------------
  // Database error
  // ---------------------------------------------------------------------------

  it("returns 500 when upsert fails", async () => {
    mockSupabase = buildUpsertMock({ data: null, error: { message: "Upsert failed" } })

    const response = await PUT(createPutRequest({ analysis_mode: "learn" }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to save preferences/i)
  })
})

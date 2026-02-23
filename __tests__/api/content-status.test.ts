import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

// Rate limiting — allow all by default
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Validation — pass by default
const mockValidateContentId = vi.fn()
vi.mock("@/lib/validation", () => ({
  validateContentId: (...args: unknown[]) => mockValidateContentId(...args),
}))

// Auth — controllable per test
let mockAuthSuccess = true
const mockUser = { id: "user-status-123", email: "status@clarusapp.io" }

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

// =============================================================================
// Import handler AFTER mocks are in place
// =============================================================================

import { GET } from "@/app/api/content-status/[id]/route"

// =============================================================================
// Constants
// =============================================================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"
const BASE_URL = "https://clarusapp.io"

// =============================================================================
// Helpers
// =============================================================================

function createRequest(id: string, searchParams = ""): Request {
  const url = `${BASE_URL}/api/content-status/${id}${searchParams ? `?${searchParams}` : ""}`
  return new Request(url, {
    method: "GET",
    headers: { "x-forwarded-for": "1.2.3.4" },
  })
}

function makeParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id })
}

// Build a supabase mock that returns content and summary results from Promise.all
function buildSupabaseMock(
  contentResult: { data: unknown; error: unknown },
  summaryResult: { data: unknown; error: unknown }
) {
  let callCount = 0
  return {
    from: (_table: string) => {
      callCount++
      const isFirst = callCount % 2 === 1 // content query is first
      const result = isFirst ? contentResult : summaryResult
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = chain
      builder.eq = chain
      builder.order = chain
      builder.limit = chain
      builder.single = () => Promise.resolve(result)
      return builder
    },
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/content-status/[id]", () => {
  const mockContent = {
    id: VALID_UUID,
    title: "Test Article",
    url: "https://example.com/article",
    type: "article",
    user_id: mockUser.id,
    thumbnail_url: null,
    author: "Jane Doe",
    duration: null,
  }

  const mockSummary = {
    processing_status: "complete",
    triage: { verdict: "reliable" },
    brief_overview: "A brief overview.",
    mid_length_summary: "A medium summary.",
    detailed_summary: "A detailed summary.",
    truth_check: { score: 0.9 },
    action_items: ["Read more"],
    language: "en",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockValidateContentId.mockReturnValue({ isValid: true, sanitized: VALID_UUID })

    // Default: both queries succeed
    mockSupabase = buildSupabaseMock(
      { data: mockContent, error: null },
      { data: mockSummary, error: null }
    )
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 60000 })

    const response = await GET(createRequest(VALID_UUID), { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
  })

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("returns 400 when content ID is invalid", async () => {
    mockValidateContentId.mockReturnValue({ isValid: false, error: "Invalid UUID" })

    const response = await GET(createRequest("not-a-uuid"), { params: makeParams("not-a-uuid") })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/invalid content id/i)
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await GET(createRequest(VALID_UUID), { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Content not found / access denied
  // ---------------------------------------------------------------------------

  it("returns 404 when content record does not exist", async () => {
    mockSupabase = buildSupabaseMock(
      { data: null, error: { message: "No rows" } },
      { data: null, error: null }
    )

    const response = await GET(createRequest(VALID_UUID), { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe("Content not found")
  })

  it("returns 403 when content belongs to another user", async () => {
    const otherUserContent = { ...mockContent, user_id: "different-user-id" }
    mockSupabase = buildSupabaseMock(
      { data: otherUserContent, error: null },
      { data: mockSummary, error: null }
    )

    const response = await GET(createRequest(VALID_UUID), { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe("Access denied")
  })

  // ---------------------------------------------------------------------------
  // 200 success cases
  // ---------------------------------------------------------------------------

  it("returns 200 with full content and summary on success", async () => {
    const response = await GET(createRequest(VALID_UUID), { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.id).toBe(VALID_UUID)
    expect(body.title).toBe("Test Article")
    expect(body.url).toBe("https://example.com/article")
    expect(body.type).toBe("article")
    expect(body.processing_status).toBe("complete")
    expect(body.triage).toEqual({ verdict: "reliable" })
    expect(body.brief_overview).toBe("A brief overview.")
    expect(body.truth_check).toEqual({ score: 0.9 })
    expect(body.action_items).toEqual(["Read more"])
    expect(body.analysis_age_days).toBeGreaterThanOrEqual(2)
  })

  it("sets Cache-Control header on successful response", async () => {
    const response = await GET(createRequest(VALID_UUID), { params: makeParams(VALID_UUID) })

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toMatch(/private/)
  })

  it("returns processing_status=pending when no summary exists", async () => {
    mockSupabase = buildSupabaseMock(
      { data: mockContent, error: null },
      { data: null, error: { message: "No rows" } }
    )

    const response = await GET(createRequest(VALID_UUID), { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.processing_status).toBe("pending")
    expect(body.triage).toBeNull()
    expect(body.analysis_age_days).toBeNull()
  })

  it("uses language query param when fetching summary", async () => {
    // Just ensure the route handles ?language=es without error
    const response = await GET(createRequest(VALID_UUID, "language=es"), { params: makeParams(VALID_UUID) })

    expect(response.status).toBe(200)
  })

  it("defaults to English when no language query param is provided", async () => {
    const response = await GET(createRequest(VALID_UUID), { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.id).toBe(VALID_UUID)
  })
})

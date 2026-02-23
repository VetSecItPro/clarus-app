import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

// Auth — controllable per test
let mockAuthSuccess = true
const mockUser = { id: "user-abc-123", email: "test@clarusapp.io" }

// Supabase user-scoped client
const mockUpsertChain = {
  upsert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

const mockSelectChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
}

const mockFrom = vi.fn()
const mockUserSupabase = {
  from: (...args: unknown[]) => mockFrom(...args),
}

vi.mock("@/lib/auth", async () => {
  const { NextResponse } = await import("next/server")
  return {
    authenticateRequest: vi.fn(async () => {
      if (!mockAuthSuccess) {
        return {
          success: false,
          response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
        }
      }
      return { success: true, user: mockUser, supabase: mockUserSupabase }
    }),
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

import { POST, GET } from "@/app/api/feedback/route"

// =============================================================================
// Constants & helpers
// =============================================================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

const VALID_FEEDBACK_BODY = {
  content_id: VALID_UUID,
  section_type: "triage",
  is_helpful: true,
}

const MOCK_FEEDBACK_RECORD = {
  id: "fb-001",
  section_type: "triage",
  is_helpful: true,
  claim_index: null,
  flag_reason: null,
}

function createPostRequest(body: unknown) {
  return new NextRequest("https://clarusapp.io/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function createGetRequest(contentId?: string) {
  const url = contentId
    ? `https://clarusapp.io/api/feedback?content_id=${contentId}`
    : "https://clarusapp.io/api/feedback"
  return new NextRequest(url, { method: "GET" })
}

// =============================================================================
// Tests: POST /api/feedback
// =============================================================================

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true

    // Default: upsert succeeds
    mockUpsertChain.single.mockResolvedValue({ data: MOCK_FEEDBACK_RECORD, error: null })
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockReturnValue(mockUpsertChain),
      select: vi.fn().mockReturnThis(),
    })
  })

  // ---------------------------------------------------------------------------
  // Authentication — 401
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const req = createPostRequest(VALID_FEEDBACK_BODY)
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Request body validation — 400
  // ---------------------------------------------------------------------------

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("https://clarusapp.io/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not valid json{{",
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/invalid json/i)
  })

  it("returns 400 when content_id is missing", async () => {
    const req = createPostRequest({ section_type: "triage", is_helpful: true })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when content_id is not a valid UUID", async () => {
    const req = createPostRequest({ ...VALID_FEEDBACK_BODY, content_id: "not-a-uuid" })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when section_type is an invalid value", async () => {
    const req = createPostRequest({ ...VALID_FEEDBACK_BODY, section_type: "invalid_section" })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when is_helpful is not a boolean or null", async () => {
    const req = createPostRequest({ ...VALID_FEEDBACK_BODY, is_helpful: "yes" })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when flag_reason exceeds 500 chars", async () => {
    const req = createPostRequest({
      ...VALID_FEEDBACK_BODY,
      flag_reason: "x".repeat(501),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Database error — 500
  // ---------------------------------------------------------------------------

  it("returns 500 when database upsert fails", async () => {
    mockUpsertChain.single.mockResolvedValue({
      data: null,
      error: { message: "Upsert failed" },
    })

    const req = createPostRequest(VALID_FEEDBACK_BODY)
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to save feedback/i)
  })

  // ---------------------------------------------------------------------------
  // 200 success
  // ---------------------------------------------------------------------------

  it("returns 200 with feedback record on success", async () => {
    const req = createPostRequest(VALID_FEEDBACK_BODY)
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.feedback).toBeDefined()
    expect(body.feedback.section_type).toBe("triage")
    expect(body.feedback.is_helpful).toBe(true)
  })

  it("accepts all valid section_type values", async () => {
    const validSections = ["overview", "triage", "takeaways", "accuracy", "action_items", "detailed"]

    for (const section of validSections) {
      mockUpsertChain.single.mockResolvedValue({
        data: { ...MOCK_FEEDBACK_RECORD, section_type: section },
        error: null,
      })

      const req = createPostRequest({ ...VALID_FEEDBACK_BODY, section_type: section })
      const response = await POST(req)

      expect(response.status).toBe(200)
    }
  })

  it("accepts is_helpful as null (neutral feedback)", async () => {
    mockUpsertChain.single.mockResolvedValue({
      data: { ...MOCK_FEEDBACK_RECORD, is_helpful: null },
      error: null,
    })

    const req = createPostRequest({ ...VALID_FEEDBACK_BODY, is_helpful: null })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.feedback.is_helpful).toBeNull()
  })

  it("accepts optional claim_index for claim-level feedback", async () => {
    mockUpsertChain.single.mockResolvedValue({
      data: { ...MOCK_FEEDBACK_RECORD, claim_index: 2 },
      error: null,
    })

    const req = createPostRequest({ ...VALID_FEEDBACK_BODY, claim_index: 2 })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.feedback).toBeDefined()
  })

  it("accepts optional flag_reason", async () => {
    mockUpsertChain.single.mockResolvedValue({
      data: { ...MOCK_FEEDBACK_RECORD, flag_reason: "Inaccurate claim" },
      error: null,
    })

    const req = createPostRequest({
      ...VALID_FEEDBACK_BODY,
      flag_reason: "Inaccurate claim",
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.feedback).toBeDefined()
  })
})

// =============================================================================
// Tests: GET /api/feedback
// =============================================================================

describe("GET /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true

    // Default: query returns feedback records
    const resolvedChain = {
      ...mockSelectChain,
      eq: vi.fn().mockReturnThis(),
    }
    // Final eq returns the data
    resolvedChain.eq.mockImplementationOnce(vi.fn().mockReturnThis()).mockImplementationOnce(
      vi.fn().mockResolvedValue({
        data: [
          {
            id: "fb-001",
            section_type: "triage",
            is_helpful: true,
            claim_index: null,
            flag_reason: null,
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      })
    )

    mockFrom.mockReturnValue(resolvedChain)
  })

  // ---------------------------------------------------------------------------
  // Authentication — 401
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const req = createGetRequest(VALID_UUID)
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Missing query param — 400
  // ---------------------------------------------------------------------------

  it("returns 400 when content_id query param is missing", async () => {
    const req = createGetRequest()
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/content_id is required/i)
  })

  // ---------------------------------------------------------------------------
  // Database error — 500
  // ---------------------------------------------------------------------------

  it("returns 500 when database query fails", async () => {
    const errorChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    // Both eq calls return same chain, but the last one resolves with error
    const eqMock = vi.fn()
    eqMock.mockReturnValueOnce(errorChain).mockResolvedValueOnce({
      data: null,
      error: { message: "Query failed" },
    })
    errorChain.eq = eqMock

    mockFrom.mockReturnValue(errorChain)

    const req = createGetRequest(VALID_UUID)
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to fetch feedback/i)
  })

  // ---------------------------------------------------------------------------
  // 200 success
  // ---------------------------------------------------------------------------

  it("returns 200 with array of feedback when successful", async () => {
    const feedbackItems = [
      {
        id: "fb-001",
        section_type: "triage",
        is_helpful: true,
        claim_index: null,
        flag_reason: null,
        created_at: new Date().toISOString(),
      },
    ]

    // Override with working sequential eq chain
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn()
        .mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: feedbackItems, error: null }) })
        .mockResolvedValue({ data: feedbackItems, error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const req = createGetRequest(VALID_UUID)
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(body.feedback)).toBe(true)
  })

  it("returns 200 with empty feedback array when none exist", async () => {
    const emptyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn()
        .mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
        .mockResolvedValue({ data: null, error: null }),
    }
    mockFrom.mockReturnValue(emptyChain)

    const req = createGetRequest(VALID_UUID)
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.feedback).toEqual([])
  })

  it("sets Cache-Control header on success", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn()
        .mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) })
        .mockResolvedValue({ data: [], error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const req = createGetRequest(VALID_UUID)
    const response = await GET(req)

    expect(response.status).toBe(200)
    const cacheHeader = response.headers.get("Cache-Control")
    expect(cacheHeader).toContain("private")
    expect(cacheHeader).toContain("max-age=30")
  })
})

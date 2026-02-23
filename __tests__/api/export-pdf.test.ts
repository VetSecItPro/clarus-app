import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before imports (Vitest hoists vi.mock calls)
// =============================================================================

// Rate limiting — always allow by default
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Auth — controllable per test
let mockAuthSuccess = true
const mockUser = { id: "user-abc-123", email: "test@clarusapp.io" }

// Supabase mock builders — mutable so each test can set return values
let mockUsersQueryResult: { data: { tier: string; day_pass_expires_at: string | null } | null; error: null } = {
  data: { tier: "starter", day_pass_expires_at: null },
  error: null,
}
let mockSummariesQueryResult: { data: Record<string, unknown> | null; error: null } = {
  data: { brief_overview: "Test overview", detailed_summary: "Test detailed summary", processing_status: "complete" },
  error: null,
}

// Chainable supabase mock
function makeMockSupabase() {
  const usersChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockUsersQueryResult),
  }
  const summariesChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(mockSummariesQueryResult),
  }
  return {
    from: vi.fn((table: string) => {
      if (table === "users") return usersChain
      if (table === "summaries") return summariesChain
      return usersChain
    }),
  }
}

let mockSupabase = makeMockSupabase()

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
  verifyContentOwnership: vi.fn(async () => mockOwnershipResult),
  AuthErrors: {
    badRequest: vi.fn((msg: string) => {
      const { NextResponse } = require("next/server")
      return NextResponse.json({ error: msg }, { status: 400 })
    }),
    rateLimit: vi.fn((resetIn: number) => {
      const { NextResponse } = require("next/server")
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
      )
    }),
  },
}))

// Ownership — controllable per test
let mockOwnershipResult: {
  owned: boolean
  content?: Record<string, unknown>
  response?: unknown
} = {
  owned: true,
  content: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Test Article",
    url: "https://example.com/article",
    type: "article",
    created_at: "2026-01-15T00:00:00Z",
    duration: null,
  },
}

// Tier limits — controllable per test
vi.mock("@/lib/tier-limits", () => ({
  normalizeTier: vi.fn((tier: string) => tier ?? "free"),
  TIER_FEATURES: new Proxy(
    {},
    {
      get: (_target, tierKey) => ({
        exports: tierKey !== "free",
      }),
    }
  ),
}))

// Usage enforcement — controllable per test
const mockEnforceAndIncrementUsage = vi.fn()
vi.mock("@/lib/usage", () => ({
  enforceAndIncrementUsage: (...args: unknown[]) => mockEnforceAndIncrementUsage(...args),
}))

// Mock jsPDF — the real library has native bindings that won't work in Node test env.
// Must be a class (not a plain vi.fn()) because the route uses `new jsPDF(...)`.
vi.mock("jspdf", () => {
  class MockJsPDF {
    internal = {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
    }
    setFontSize = vi.fn()
    setTextColor = vi.fn()
    setFont = vi.fn()
    setDrawColor = vi.fn()
    setLineWidth = vi.fn()
    splitTextToSize = vi.fn((text: string) => [text])
    text = vi.fn()
    line = vi.fn()
    addPage = vi.fn()
    setPage = vi.fn()
    getNumberOfPages = vi.fn(() => 1)
    output = vi.fn(() => new ArrayBuffer(512))
  }
  return {
    jsPDF: MockJsPDF,
  }
})

// Logger — suppress noise
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

import { GET } from "@/app/api/export/pdf/route"

// =============================================================================
// Helpers
// =============================================================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

function createRequest(params: Record<string, string> = {}) {
  const url = new URL("https://clarusapp.io/api/export/pdf")
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new Request(url.toString(), { method: "GET" })
}

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/export/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true

    mockUsersQueryResult = { data: { tier: "starter", day_pass_expires_at: null }, error: null }
    mockSummariesQueryResult = {
      data: {
        brief_overview: "Test overview",
        detailed_summary: "Test detailed summary",
        processing_status: "complete",
      },
      error: null,
    }
    mockOwnershipResult = {
      owned: true,
      content: {
        id: VALID_UUID,
        title: "Test Article",
        url: "https://example.com/article",
        type: "article",
        created_at: "2026-01-15T00:00:00Z",
        duration: null,
      },
    }

    mockSupabase = makeMockSupabase()

    // Default: rate limit allows all
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })

    // Default: usage allowed
    mockEnforceAndIncrementUsage.mockResolvedValue({
      allowed: true,
      tier: "starter",
      newCount: 1,
      limit: 50,
    })
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })

    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)
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

    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Input validation
  // ---------------------------------------------------------------------------

  it("returns 400 when id query param is missing", async () => {
    const request = createRequest({})
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it("returns 400 when id is not a valid UUID", async () => {
    const request = createRequest({ id: "not-a-valid-uuid" })
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  // ---------------------------------------------------------------------------
  // Tier / feature gate — free tier cannot export
  // ---------------------------------------------------------------------------

  it("returns 403 when free-tier user tries to export", async () => {
    mockUsersQueryResult = { data: { tier: "free", day_pass_expires_at: null }, error: null }
    mockSupabase = makeMockSupabase()

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/exports require a starter or pro plan/i)
    expect(body.upgrade_required).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Ownership verification
  // ---------------------------------------------------------------------------

  it("returns 404 when content is not found", async () => {
    const { NextResponse } = await import("next/server")
    mockOwnershipResult = {
      owned: false,
      response: NextResponse.json({ error: "Content not found" }, { status: 404 }),
    }

    const { verifyContentOwnership } = await import("@/lib/auth")
    vi.mocked(verifyContentOwnership).mockResolvedValueOnce(mockOwnershipResult as never)

    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe("Content not found")
  })

  it("returns 403 when user does not own the content", async () => {
    const { NextResponse } = await import("next/server")
    mockOwnershipResult = {
      owned: false,
      response: NextResponse.json({ error: "Access denied" }, { status: 403 }),
    }

    const { verifyContentOwnership } = await import("@/lib/auth")
    vi.mocked(verifyContentOwnership).mockResolvedValueOnce(mockOwnershipResult as never)

    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe("Access denied")
  })

  // ---------------------------------------------------------------------------
  // Usage enforcement
  // ---------------------------------------------------------------------------

  it("returns 403 when monthly export limit is reached", async () => {
    mockEnforceAndIncrementUsage.mockResolvedValueOnce({
      allowed: false,
      tier: "starter",
      currentCount: 50,
      limit: 50,
    })

    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/monthly export limit reached/i)
    expect(body.upgrade_required).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // 200 success
  // ---------------------------------------------------------------------------

  it("returns 200 with application/pdf content-type on success", async () => {
    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
  })

  it("returns 200 with content-disposition attachment header ending in .pdf", async () => {
    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)

    expect(response.status).toBe(200)
    const disposition = response.headers.get("Content-Disposition")
    expect(disposition).toMatch(/^attachment/)
    expect(disposition).toMatch(/\.pdf"$/)
  })

  it("returns 200 with cache-control private header", async () => {
    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toMatch(/private/)
  })

  it("uses clarus-prefixed filename derived from content title", async () => {
    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)

    expect(response.status).toBe(200)
    const disposition = response.headers.get("Content-Disposition")
    expect(disposition).toMatch(/clarus-Test_Article/)
  })

  it("returns 200 even when summary is null (analysis pending)", async () => {
    mockSummariesQueryResult = { data: null, error: null }
    mockSupabase = makeMockSupabase()

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)

    // Should still succeed — the PDF route handles null summary gracefully
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
  })

  it("response body is an ArrayBuffer (binary PDF bytes)", async () => {
    const request = createRequest({ id: VALID_UUID })
    const response = await GET(request)

    expect(response.status).toBe(200)
    const buffer = await response.arrayBuffer()
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})

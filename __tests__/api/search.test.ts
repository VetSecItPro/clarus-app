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
const mockUser = { id: "user-search-123", email: "search@clarusapp.io" }

// Mutable supabase instance so individual tests can override rpc behaviour
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

import { GET, POST } from "@/app/api/search/route"
import { NextRequest } from "next/server"

// =============================================================================
// Helpers
// =============================================================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

function makeRpcResult(data: unknown, error: unknown = null) {
  return { data, error }
}

const SAMPLE_RESULTS = [
  {
    id: VALID_UUID,
    title: "Test Article",
    url: "https://example.com/article",
    type: "article",
    thumbnail_url: null,
    date_added: "2026-01-01T00:00:00Z",
    is_bookmarked: false,
    tags: ["tech"],
    brief_overview: "An overview",
    triage: null,
    relevance: 0.9,
  },
]

// The GET handler reads request.nextUrl.searchParams so we must use NextRequest
function createGetRequest(params: Record<string, string> = {}) {
  const url = new URL("https://clarusapp.io/api/search")
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString(), { method: "GET" })
}

function createPostRequest(body: unknown) {
  return new Request("https://clarusapp.io/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

// =============================================================================
// Tests — GET (search)
// =============================================================================

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })

    // Default: rpc succeeds with sample results
    mockSupabase = {
      rpc: vi.fn().mockResolvedValue(makeRpcResult(SAMPLE_RESULTS)),
      from: vi.fn(),
    }
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })

    const request = createGetRequest({ q: "test" })
    const response = await GET(request as Parameters<typeof GET>[0])
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const request = createGetRequest({ q: "test" })
    const response = await GET(request as Parameters<typeof GET>[0])
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("returns 400 when q param is missing", async () => {
    const request = createGetRequest({}) // no q
    const response = await GET(request as Parameters<typeof GET>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when q param is empty string", async () => {
    const request = createGetRequest({ q: "" })
    const response = await GET(request as Parameters<typeof GET>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when q param exceeds 500 characters", async () => {
    const request = createGetRequest({ q: "a".repeat(501) })
    const response = await GET(request as Parameters<typeof GET>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // 200 success — full-text search (rpc path)
  // ---------------------------------------------------------------------------

  it("returns 200 with results on successful search via rpc", async () => {
    const request = createGetRequest({ q: "test article" })
    const response = await GET(request as Parameters<typeof GET>[0])
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.results).toHaveLength(1)
    expect(body.query).toBe("test article")
    expect(body.count).toBe(1)
  })

  it("returns 200 with empty results array when no content matches", async () => {
    mockSupabase = {
      rpc: vi.fn().mockResolvedValue(makeRpcResult([])),
      from: vi.fn(),
    }

    const request = createGetRequest({ q: "no match here" })
    const response = await GET(request as Parameters<typeof GET>[0])
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.results).toEqual([])
    expect(body.count).toBe(0)
  })

  it("respects content_type filter param", async () => {
    const rpcMock = vi.fn().mockResolvedValue(makeRpcResult(SAMPLE_RESULTS))
    mockSupabase = { rpc: rpcMock, from: vi.fn() }

    const request = createGetRequest({ q: "test", content_type: "article" })
    const response = await GET(request as Parameters<typeof GET>[0])

    expect(response.status).toBe(200)
    expect(rpcMock).toHaveBeenCalledWith(
      "search_user_content",
      expect.objectContaining({ p_content_type: "article" })
    )
  })

  it("passes default limit=20 and offset=0 to rpc when not specified", async () => {
    const rpcMock = vi.fn().mockResolvedValue(makeRpcResult([]))
    mockSupabase = { rpc: rpcMock, from: vi.fn() }

    const request = createGetRequest({ q: "test" })
    await GET(request as Parameters<typeof GET>[0])

    expect(rpcMock).toHaveBeenCalledWith(
      "search_user_content",
      expect.objectContaining({ p_limit: 20, p_offset: 0 })
    )
  })

  it("respects custom limit and offset params", async () => {
    const rpcMock = vi.fn().mockResolvedValue(makeRpcResult([]))
    mockSupabase = { rpc: rpcMock, from: vi.fn() }

    const request = createGetRequest({ q: "test", limit: "5", offset: "10" })
    await GET(request as Parameters<typeof GET>[0])

    expect(rpcMock).toHaveBeenCalledWith(
      "search_user_content",
      expect.objectContaining({ p_limit: 5, p_offset: 10 })
    )
  })

  it("sets Cache-Control header on successful response", async () => {
    const request = createGetRequest({ q: "test" })
    const response = await GET(request as Parameters<typeof GET>[0])

    expect(response.headers.get("Cache-Control")).toMatch(/private/)
  })

  // ---------------------------------------------------------------------------
  // Fallback ILIKE search
  // ---------------------------------------------------------------------------

  it("falls back to ILIKE search when rpc function does not exist (42883)", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({ data: SAMPLE_RESULTS, error: null }),
            }),
          }),
        }),
      }),
    })

    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "function not found", code: "42883" },
      }),
      from: mockFrom,
    }

    const request = createGetRequest({ q: "test" })
    const response = await GET(request as Parameters<typeof GET>[0])
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.fallback).toBe(true)
  })

  it("returns 500 when rpc throws an unexpected error", async () => {
    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "unexpected db failure", code: "XX000" },
      }),
      from: vi.fn(),
    }

    const request = createGetRequest({ q: "test" })
    const response = await GET(request as Parameters<typeof GET>[0])
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to search/i)
  })
})

// =============================================================================
// Tests — POST (autocomplete suggestions)
// =============================================================================

describe("POST /api/search (suggestions)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })

    mockSupabase = {
      rpc: vi.fn().mockResolvedValue(
        makeRpcResult([{ id: VALID_UUID, title: "Test Article", type: "article" }])
      ),
      from: vi.fn(),
    }
  })

  it("returns 429 when suggestions rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 10000 })

    const request = createPostRequest({ query: "test" })
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
  })

  it("returns 401 when user is not authenticated for suggestions", async () => {
    mockAuthSuccess = false

    const request = createPostRequest({ query: "test" })
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("returns 400 when query field is missing", async () => {
    const request = createPostRequest({})
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when query is empty string", async () => {
    const request = createPostRequest({ query: "" })
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 200 with suggestions on success", async () => {
    const request = createPostRequest({ query: "test" })
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.suggestions)).toBe(true)
  })

  it("returns 200 with empty suggestions array when rpc returns null", async () => {
    mockSupabase = {
      rpc: vi.fn().mockResolvedValue(makeRpcResult(null)),
      from: vi.fn(),
    }

    const request = createPostRequest({ query: "nothing" })
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.suggestions).toEqual([])
  })

  it("falls back to ilike suggestions when rpc function is missing", async () => {
    const ilikeMock = vi.fn().mockResolvedValue({
      data: [{ id: VALID_UUID, title: "Article", type: "article" }],
      error: null,
    })

    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "function not found", code: "42883" },
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              limit: ilikeMock,
            }),
          }),
        }),
      }),
    }

    const request = createPostRequest({ query: "art" })
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.fallback).toBe(true)
    expect(Array.isArray(body.suggestions)).toBe(true)
  })
})

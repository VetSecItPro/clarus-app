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
const mockUser = { id: "user-tags-123", email: "tags@clarusapp.io" }

// Mutable supabase state
let mockTagsData: { tags: string[] | null }[] | null = null
let mockTagsError: { message: string } | null = null

vi.mock("@/lib/auth", () => ({
  authenticateRequest: vi.fn(async () => {
    if (!mockAuthSuccess) {
      const { NextResponse } = await import("next/server")
      return {
        success: false,
        response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      }
    }
    return {
      success: true,
      user: mockUser,
      supabase: {
        from: (_table: string) => ({
          select: (_fields: string) => ({
            eq: (_field: string, _value: unknown) => ({
              not: (_col: string, _op: string, _val: unknown) => ({
                limit: (_n: number) =>
                  Promise.resolve({ data: mockTagsData, error: mockTagsError }),
              }),
            }),
          }),
        }),
      },
    }
  }),
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

import { GET } from "@/app/api/tags/route"

// =============================================================================
// Helpers
// =============================================================================

function createRequest(headers: Record<string, string> = {}) {
  return new Request("https://clarusapp.io/api/tags", {
    method: "GET",
    headers: { "x-forwarded-for": "127.0.0.1", ...headers },
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockTagsData = [
      { tags: ["tech", "ai", "news"] },
      { tags: ["tech", "science"] },
      { tags: ["ai"] },
    ]
    mockTagsError = null
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 45000 })

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/too many requests/i)
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // 200 success cases
  // ---------------------------------------------------------------------------

  it("returns 200 with aggregated tag counts", async () => {
    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.tags)).toBe(true)

    // tech appears in 2 items, ai in 2, news in 1, science in 1
    const techTag = body.tags.find((t: { tag: string; count: number }) => t.tag === "tech")
    const aiTag = body.tags.find((t: { tag: string; count: number }) => t.tag === "ai")
    const newsTag = body.tags.find((t: { tag: string; count: number }) => t.tag === "news")

    expect(techTag).toBeDefined()
    expect(techTag.count).toBe(2)
    expect(aiTag).toBeDefined()
    expect(aiTag.count).toBe(2)
    expect(newsTag).toBeDefined()
    expect(newsTag.count).toBe(1)
  })

  it("returns tags sorted by count descending", async () => {
    mockTagsData = [
      { tags: ["popular", "popular", "popular"] },
      { tags: ["popular", "rare"] },
    ]
    // popular appears once per item but multiple items; rare appears once
    // Actually tags are unique strings per item — let's use distinct arrays
    mockTagsData = [
      { tags: ["popular"] },
      { tags: ["popular"] },
      { tags: ["popular"] },
      { tags: ["rare"] },
    ]

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.tags[0].tag).toBe("popular")
    expect(body.tags[0].count).toBe(3)
    expect(body.tags[1].tag).toBe("rare")
    expect(body.tags[1].count).toBe(1)
  })

  it("returns 200 with empty tags array when user has no tagged content", async () => {
    mockTagsData = []

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.tags).toEqual([])
  })

  it("returns 200 with empty tags array when content has null tags", async () => {
    mockTagsData = [{ tags: null }, { tags: null }]

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.tags).toEqual([])
  })

  it("returns 200 with empty tags array when DB returns null data", async () => {
    mockTagsData = null

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.tags).toEqual([])
  })

  it("limits results to top 50 tags", async () => {
    // Create 60 unique tags each in one item
    mockTagsData = Array.from({ length: 60 }, (_, i) => ({ tags: [`tag-${i}`] }))

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.tags.length).toBeLessThanOrEqual(50)
  })

  it("sets Cache-Control header on successful response", async () => {
    const response = await GET(createRequest())

    expect(response.headers.get("Cache-Control")).toMatch(/private/)
    expect(response.headers.get("Cache-Control")).toMatch(/max-age/)
  })

  // ---------------------------------------------------------------------------
  // Database error
  // ---------------------------------------------------------------------------

  it("returns 500 when database query fails", async () => {
    mockTagsError = { message: "connection refused" }
    mockTagsData = null

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/failed to fetch tags/i)
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it("deduplicates and aggregates the same tag appearing in multiple items", async () => {
    mockTagsData = [
      { tags: ["shared-tag"] },
      { tags: ["shared-tag"] },
      { tags: ["shared-tag", "unique-tag"] },
    ]

    const response = await GET(createRequest())
    const body = await response.json()

    const sharedTag = body.tags.find((t: { tag: string; count: number }) => t.tag === "shared-tag")
    const uniqueTag = body.tags.find((t: { tag: string; count: number }) => t.tag === "unique-tag")

    expect(sharedTag.count).toBe(3)
    expect(uniqueTag.count).toBe(1)
  })

  it("ignores items with empty arrays and only counts non-empty tag arrays", async () => {
    mockTagsData = [
      { tags: [] },
      { tags: ["real-tag"] },
      { tags: [] },
    ]

    const response = await GET(createRequest())
    const body = await response.json()

    expect(body.tags).toHaveLength(1)
    expect(body.tags[0].tag).toBe("real-tag")
    expect(body.tags[0].count).toBe(1)
  })
})

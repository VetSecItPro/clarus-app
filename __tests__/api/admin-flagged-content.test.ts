import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

// Rate limiting — always allow by default
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Auth — controllable per test
let mockAuthSuccess = true
let mockIsAdmin = true
const mockUser = { id: "admin-user-123", email: "admin@clarusapp.io" }

// Admin DB client mock
const mockFrom = vi.fn()
const mockAdminClient = {
  from: (...args: unknown[]) => mockFrom(...args),
}

vi.mock("@/lib/auth", async () => {
  const { NextResponse } = await import("next/server")
  return {
    authenticateAdmin: vi.fn(async () => {
      if (!mockAuthSuccess) {
        return {
          success: false,
          response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
        }
      }
      if (!mockIsAdmin) {
        return {
          success: false,
          response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
        }
      }
      return { success: true, user: mockUser, supabase: {} }
    }),
    getAdminClient: () => mockAdminClient,
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

import { GET, PATCH } from "@/app/api/admin/flagged-content/route"

// =============================================================================
// Helpers
// =============================================================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

function makeFlaggedItem(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    content_id: VALID_UUID,
    user_id: "user-111",
    url: "https://example.com",
    content_type: "article",
    flag_source: "keyword",
    flag_reason: "Suspicious content",
    flag_categories: ["spam"],
    severity: "medium",
    user_ip: "1.2.3.4",
    content_hash: "abc123",
    scraped_text_preview: "Some text...",
    status: "pending",
    review_notes: null,
    reviewed_by: null,
    reviewed_at: null,
    reported_to: null,
    report_reference: null,
    reported_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function buildSelectChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(result),
  }
  return chain
}

function buildUpdateChain(result: { error: unknown }) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(result),
  }
}

function createPatchRequest(body: unknown) {
  return new NextRequest("https://clarusapp.io/api/admin/flagged-content", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/admin/flagged-content", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockIsAdmin = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })

    const chain = buildSelectChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)
  })

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("returns 403 when user is authenticated but not an admin", async () => {
    mockIsAdmin = false

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe("Admin access required")
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 60000 })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
    expect(response.headers.get("Retry-After")).toBe("60")
  })

  it("returns 500 when database query fails", async () => {
    const chain = buildSelectChain({ data: null, error: { message: "DB error" } })
    mockFrom.mockReturnValue(chain)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to fetch flagged content/i)
  })

  it("returns 200 with empty items and zero counts when no flagged content", async () => {
    const chain = buildSelectChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items).toEqual([])
    expect(body.counts.total).toBe(0)
    expect(body.counts.pending).toBe(0)
    expect(body.counts.critical).toBe(0)
    expect(body.counts.reported).toBe(0)
  })

  it("returns 200 with correct counts computed from items", async () => {
    const items = [
      makeFlaggedItem({ status: "pending", severity: "medium" }),
      makeFlaggedItem({ status: "pending", severity: "critical" }),
      makeFlaggedItem({ status: "reported", severity: "critical" }),
      makeFlaggedItem({ status: "reviewed", severity: "low" }),
    ]
    const chain = buildSelectChain({ data: items, error: null })
    mockFrom.mockReturnValue(chain)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(4)
    expect(body.counts.total).toBe(4)
    expect(body.counts.pending).toBe(2)
    expect(body.counts.critical).toBe(2)
    expect(body.counts.reported).toBe(1)
  })

  it("sets Cache-Control: no-store, private header", async () => {
    const chain = buildSelectChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store, private")
  })
})

describe("PATCH /api/admin/flagged-content", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockIsAdmin = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })

    const chain = buildUpdateChain({ error: null })
    mockFrom.mockReturnValue(chain)
  })

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const req = createPatchRequest({ id: VALID_UUID, status: "reviewed" })
    const response = await PATCH(req)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("returns 403 when user is authenticated but not an admin", async () => {
    mockIsAdmin = false

    const req = createPatchRequest({ id: VALID_UUID, status: "reviewed" })
    const response = await PATCH(req)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe("Admin access required")
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })

    const req = createPatchRequest({ id: VALID_UUID, status: "reviewed" })
    const response = await PATCH(req)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
    expect(response.headers.get("Retry-After")).toBe("30")
  })

  it("returns 400 when id is missing", async () => {
    const req = createPatchRequest({ status: "reviewed" })
    const response = await PATCH(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when id is not a valid UUID", async () => {
    const req = createPatchRequest({ id: "not-a-uuid", status: "reviewed" })
    const response = await PATCH(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when status is an invalid enum value", async () => {
    const req = createPatchRequest({ id: VALID_UUID, status: "approved" })
    const response = await PATCH(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when review_notes exceeds max length", async () => {
    const req = createPatchRequest({
      id: VALID_UUID,
      status: "reviewed",
      review_notes: "x".repeat(2001),
    })
    const response = await PATCH(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 500 when database update fails", async () => {
    const chain = buildUpdateChain({ error: { message: "Update failed" } })
    mockFrom.mockReturnValue(chain)

    const req = createPatchRequest({ id: VALID_UUID, status: "reviewed" })
    const response = await PATCH(req)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to update/i)
  })

  it("returns 200 on successful review update", async () => {
    const req = createPatchRequest({
      id: VALID_UUID,
      status: "reviewed",
      review_notes: "Content reviewed and dismissed.",
    })
    const response = await PATCH(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("returns 200 on successful dismissed update", async () => {
    const req = createPatchRequest({ id: VALID_UUID, status: "dismissed" })
    const response = await PATCH(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("returns 200 on reported status with optional reported_to and reference", async () => {
    const req = createPatchRequest({
      id: VALID_UUID,
      status: "reported",
      reported_to: "NCMEC",
      report_reference: "REF-2026-001",
    })
    const response = await PATCH(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("https://clarusapp.io/api/admin/flagged-content", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "not valid json{{",
    })
    const response = await PATCH(req)

    expect(response.status).toBe(400)
  })
})

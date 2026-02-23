import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — declared before imports
// =============================================================================

// Auth — controllable per test
let mockAuthSuccess = true
const mockUser = { id: "user-export-123", email: "export@clarusapp.io" }

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
  getAdminClient: vi.fn(() => mockAdminClient),
}))

// logger — silence noise
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// =============================================================================
// Admin client mock — build after vi.mock hoisting
// =============================================================================

// Shared chainable query builder
function makeQueryChain(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ["select", "eq", "in", "order", "limit", "single", "maybeSingle"]
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain)
  })
  // Make it thenable so Promise.all awaits it
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(resolve)
  return chain
}

const mockAdminClient = {
  from: vi.fn((table: string) => {
    return makeQueryChain(
      table === "users"
        ? {
            data: {
              id: mockUser.id,
              email: mockUser.email,
              name: "Test User",
              tier: "pro",
              created_at: "2025-01-01T00:00:00Z",
              digest_enabled: true,
            },
            error: null,
          }
        : { data: [], error: null }
    )
  }),
}

// =============================================================================
// Import handler AFTER mocks
// =============================================================================

import { GET } from "@/app/api/account/export/route"

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true

    // Reset the admin client mock to return sensible defaults
    mockAdminClient.from.mockImplementation((table: string) => {
      return makeQueryChain(
        table === "users"
          ? {
              data: {
                id: mockUser.id,
                email: mockUser.email,
                name: "Test User",
                tier: "pro",
                created_at: "2025-01-01T00:00:00Z",
                digest_enabled: true,
              },
              error: null,
            }
          : { data: [], error: null }
      )
    })
  })

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------

  it("returns 200 with a JSON attachment on successful export", async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/json")
    expect(response.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="clarus-data-export-\d{4}-\d{2}-\d{2}\.json"/
    )
  })

  it("includes expected top-level keys in the export body", async () => {
    const response = await GET()
    const text = await response.text()
    const body = JSON.parse(text)

    expect(body).toHaveProperty("exported_at")
    expect(body).toHaveProperty("format_version", "1.0")
    expect(body).toHaveProperty("account")
    expect(body).toHaveProperty("content")
    expect(body).toHaveProperty("analyses")
    expect(body).toHaveProperty("chat_threads")
    expect(body).toHaveProperty("chat_messages")
    expect(body).toHaveProperty("collections")
    expect(body).toHaveProperty("collection_items")
    expect(body).toHaveProperty("ratings")
    expect(body).toHaveProperty("claims")
    expect(body).toHaveProperty("podcast_subscriptions")
    expect(body).toHaveProperty("usage_history")
    expect(body).toHaveProperty("api_usage")
  })

  it("includes safe account fields but omits sensitive internal fields", async () => {
    const response = await GET()
    const text = await response.text()
    const body = JSON.parse(text)

    expect(body.account).toMatchObject({
      id: mockUser.id,
      email: mockUser.email,
      name: "Test User",
      tier: "pro",
    })
    // Sensitive fields like polar_customer_id should NOT be present
    expect(body.account).not.toHaveProperty("polar_customer_id")
  })

  it("exported_at is a valid ISO timestamp", async () => {
    const response = await GET()
    const text = await response.text()
    const body = JSON.parse(text)

    expect(new Date(body.exported_at).toISOString()).toBe(body.exported_at)
  })

  it("defaults array fields to empty arrays when no data exists", async () => {
    // Already defaulted via mockAdminClient returning [] for non-users tables
    const response = await GET()
    const text = await response.text()
    const body = JSON.parse(text)

    expect(Array.isArray(body.content)).toBe(true)
    expect(Array.isArray(body.analyses)).toBe(true)
    expect(Array.isArray(body.chat_threads)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Error path
  // -------------------------------------------------------------------------

  it("returns 500 when an unexpected error occurs", async () => {
    // Force one of the admin client's table queries to throw,
    // which will bubble up through Promise.all and be caught by the route's try/catch.
    mockAdminClient.from.mockImplementationOnce(() => {
      throw new Error("DB connection lost")
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to export data")
  })
})

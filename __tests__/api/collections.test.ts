import { describe, it, expect, vi, beforeEach } from "vitest"

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
const mockUser = { id: "user-abc-123", email: "test@clarusapp.io" }

// Supabase query builder mock — controlled per test
type MockQueryResult = { data: unknown; error: unknown; count?: number | null }
const mockSupabaseQuery = vi.fn()

vi.mock("@/lib/auth", () => ({
  authenticateRequest: vi.fn(async () => {
    if (!mockAuthSuccess) {
      const { NextResponse } = await import("next/server")
      return {
        success: false,
        response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      }
    }
    return { success: true, user: mockUser, supabase: mockSupabaseQuery() }
  }),
  AuthErrors: {
    unauthorized: () => {
      const { NextResponse } = require("next/server")
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    },
    forbidden: () => {
      const { NextResponse } = require("next/server")
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    },
    notFound: (resource = "Resource") => {
      const { NextResponse } = require("next/server")
      return NextResponse.json({ error: `${resource} not found` }, { status: 404 })
    },
    badRequest: (message = "Invalid request") => {
      const { NextResponse } = require("next/server")
      return NextResponse.json({ error: message }, { status: 400 })
    },
    rateLimit: (resetIn: number) => {
      const { NextResponse } = require("next/server")
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
      )
    },
    serverError: () => {
      const { NextResponse } = require("next/server")
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    },
  },
}))

// getUserTierAndAdmin — controllable per test
const mockGetUserTierAndAdmin = vi.fn()
vi.mock("@/lib/usage", () => ({
  getUserTierAndAdmin: (...args: unknown[]) => mockGetUserTierAndAdmin(...args),
}))

// getEffectiveLimits — controllable per test
const mockGetEffectiveLimits = vi.fn()
vi.mock("@/lib/tier-limits", () => ({
  getEffectiveLimits: (...args: unknown[]) => mockGetEffectiveLimits(...args),
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
// Import handlers AFTER mocks are in place
// =============================================================================

import { GET as collectionsGET, POST as collectionsPOST } from "@/app/api/collections/route"
import { PATCH as collectionPATCH, DELETE as collectionDELETE } from "@/app/api/collections/[id]/route"
import { POST as itemsPOST } from "@/app/api/collections/[id]/items/route"
import { DELETE as itemDELETE } from "@/app/api/collections/[id]/items/[contentId]/route"

// =============================================================================
// Test constants
// =============================================================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"
const VALID_UUID_2 = "660e8400-e29b-41d4-a716-446655440001"
const VALID_UUID_3 = "770e8400-e29b-41d4-a716-446655440002"
const INVALID_ID = "not-a-uuid"

const MOCK_COLLECTION = {
  id: VALID_UUID,
  name: "My Collection",
  description: "A test collection",
  color: "#1d9bf0",
  icon: null,
  is_default: false,
  item_count: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
}

const MOCK_ITEM = {
  id: VALID_UUID_3,
  collection_id: VALID_UUID,
  content_id: VALID_UUID_2,
  added_at: "2024-01-01T00:00:00Z",
  sort_order: 0,
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Creates a simple sequential supabase mock where each `.from()` call
 * returns a pre-configured result in sequence.
 */
function makeSupabase(...results: MockQueryResult[]): object {
  let callIndex = 0

  function makeChain(getResult: () => MockQueryResult): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    const chainMethods = ["eq", "neq", "in", "order", "limit"]
    for (const m of chainMethods) {
      chain[m] = vi.fn(() => chain)
    }
    chain.select = vi.fn((_fields?: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) {
        // count query — returns { data: null, error: null, count: N }
        return Promise.resolve(getResult())
      }
      return chain
    })
    chain.insert = vi.fn(() => chain)
    chain.update = vi.fn(() => chain)
    chain.delete = vi.fn(() => {
      // delete resolves directly OR via .eq().eq()
      const deleteChain: Record<string, unknown> = {}
      deleteChain.eq = vi.fn(() => deleteChain)
      // Make the chain thenable so await works without .single()
      deleteChain.then = (resolve: (v: unknown) => void, _reject?: unknown) => {
        const res = getResult()
        resolve(res)
        return Promise.resolve(res)
      }
      return deleteChain
    })
    chain.single = vi.fn(() => Promise.resolve(getResult()))
    chain.then = (resolve: (v: unknown) => void, _reject?: unknown) => {
      const res = getResult()
      resolve(res)
      return Promise.resolve(res)
    }
    return chain
  }

  return {
    from: vi.fn((_table: string) => {
      const index = callIndex++
      return makeChain(() => results[index] ?? { data: null, error: null, count: null })
    }),
  }
}

/**
 * Creates a supabase mock where each from() call uses a different result set.
 * Each result set is an array of possible results (one per .single()/.then() call).
 * The chain is fully thenable — every method returns the same chain, and awaiting
 * the chain resolves to the result for that from() call.
 *
 * This is specifically designed for the POST /collections route which uses Promise.all
 * with a count query (.select + .eq, awaited directly) AND an insert query (.insert + .select + .single).
 */
function buildThenableSupabase(...perFromResults: MockQueryResult[][]): object {
  let fromCallIndex = 0

  return {
    from: vi.fn((_table: string) => {
      const myIndex = fromCallIndex++
      const results = perFromResults[myIndex] ?? [{ data: null, error: null, count: null }]
      let resultIndex = 0

      function makeChain(): Record<string, unknown> {
        const chain: Record<string, unknown> = {}
        const chainMethods = ["eq", "neq", "order", "limit"]
        for (const m of chainMethods) {
          chain[m] = vi.fn(() => chain)
        }
        chain.select = vi.fn(() => chain)
        chain.insert = vi.fn(() => chain)
        chain.update = vi.fn(() => chain)
        chain.delete = vi.fn(() => {
          const dc: Record<string, unknown> = {}
          dc.eq = vi.fn(() => dc)
          dc.then = (resolve: (v: unknown) => void, _reject?: unknown) => {
            const r = results[resultIndex] ?? { data: null, error: null }
            resultIndex++
            resolve(r)
            return Promise.resolve(r)
          }
          return dc
        })
        chain.single = vi.fn(() => {
          const r = results[resultIndex] ?? { data: null, error: null }
          resultIndex++
          return Promise.resolve(r)
        })
        // Make the chain itself thenable for count queries (awaited directly after .eq())
        chain.then = (resolve: (v: unknown) => void, _reject?: unknown) => {
          const r = results[resultIndex] ?? { data: null, error: null, count: null }
          resultIndex++
          resolve(r)
          return Promise.resolve(r)
        }
        return chain
      }

      return makeChain()
    }),
  }
}

function createRequest(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1", ...headers },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new Request(url, init)
}

// =============================================================================
// Tests
// =============================================================================

describe("Collections API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "free", isAdmin: false })
    mockGetEffectiveLimits.mockReturnValue({
      analyses: 5,
      chatMessagesMonthly: 50,
      chatMessagesPerContent: 10,
      shareLinks: 0,
      exports: 0,
      bookmarks: 5,
      tags: 3,
      library: 25,
      podcastAnalyses: 0,
      podcastSubscriptions: 0,
      youtubeSubscriptions: 0,
      collections: 3,
    })
  })

  // ===========================================================================
  // GET /api/collections
  // ===========================================================================

  describe("GET /api/collections", () => {
    it("returns 429 when rate limit is exceeded", async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })
      const request = createRequest("GET", "https://clarusapp.io/api/collections")
      const response = await collectionsGET(request)
      expect(response.status).toBe(429)
      const body = await response.json()
      expect(body.error).toMatch(/too many requests/i)
    })

    it("returns 401 when user is not authenticated", async () => {
      mockAuthSuccess = false
      const request = createRequest("GET", "https://clarusapp.io/api/collections")
      const response = await collectionsGET(request)
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("Authentication required")
    })

    it("returns 200 with empty collections list", async () => {
      mockSupabaseQuery.mockReturnValue(
        makeSupabase({ data: [], error: null })
      )
      const request = createRequest("GET", "https://clarusapp.io/api/collections")
      const response = await collectionsGET(request)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.collections).toEqual([])
    })

    it("returns 200 with user collections", async () => {
      mockSupabaseQuery.mockReturnValue(
        makeSupabase({ data: [MOCK_COLLECTION], error: null })
      )
      const request = createRequest("GET", "https://clarusapp.io/api/collections")
      const response = await collectionsGET(request)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.collections).toHaveLength(1)
      expect(body.collections[0].id).toBe(VALID_UUID)
      expect(body.collections[0].name).toBe("My Collection")
    })

    it("returns 500 when database query fails", async () => {
      mockSupabaseQuery.mockReturnValue(
        makeSupabase({ data: null, error: { message: "DB error" } })
      )
      const request = createRequest("GET", "https://clarusapp.io/api/collections")
      const response = await collectionsGET(request)
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.success).toBe(false)
    })

    it("sets Cache-Control header on success", async () => {
      mockSupabaseQuery.mockReturnValue(
        makeSupabase({ data: [], error: null })
      )
      const request = createRequest("GET", "https://clarusapp.io/api/collections")
      const response = await collectionsGET(request)
      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toMatch(/private/)
    })
  })

  // ===========================================================================
  // POST /api/collections
  // ===========================================================================

  describe("POST /api/collections", () => {
    it("returns 429 when rate limit is exceeded", async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 15000 })
      const request = createRequest("POST", "https://clarusapp.io/api/collections", {
        name: "Test",
      })
      const response = await collectionsPOST(request)
      expect(response.status).toBe(429)
    })

    it("returns 401 when user is not authenticated", async () => {
      mockAuthSuccess = false
      const request = createRequest("POST", "https://clarusapp.io/api/collections", {
        name: "Test",
      })
      const response = await collectionsPOST(request)
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("Authentication required")
    })

    it("returns 400 when name is missing", async () => {
      mockSupabaseQuery.mockReturnValue(makeSupabase())
      const request = createRequest("POST", "https://clarusapp.io/api/collections", {})
      const response = await collectionsPOST(request)
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBeDefined()
    })

    it("returns 400 when name is empty string", async () => {
      mockSupabaseQuery.mockReturnValue(makeSupabase())
      const request = createRequest("POST", "https://clarusapp.io/api/collections", {
        name: "",
      })
      const response = await collectionsPOST(request)
      expect(response.status).toBe(400)
    })

    it("returns 400 when name exceeds 100 characters", async () => {
      mockSupabaseQuery.mockReturnValue(makeSupabase())
      const request = createRequest("POST", "https://clarusapp.io/api/collections", {
        name: "x".repeat(101),
      })
      const response = await collectionsPOST(request)
      expect(response.status).toBe(400)
    })

    it("returns 400 when color is invalid", async () => {
      mockSupabaseQuery.mockReturnValue(makeSupabase())
      const request = createRequest("POST", "https://clarusapp.io/api/collections", {
        name: "Test",
        color: "#badcol",
      })
      const response = await collectionsPOST(request)
      expect(response.status).toBe(400)
    })

    it("returns 400 for invalid JSON body", async () => {
      const request = new Request("https://clarusapp.io/api/collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-valid-json{{",
      })
      const response = await collectionsPOST(request)
      expect(response.status).toBe(400)
    })

    it("returns 403 when collection limit is reached", async () => {
      // getUserTierAndAdmin is mocked globally — returns free tier with collections limit of 3
      // supabase mock handles the count query: user already has 3 collections
      mockSupabaseQuery.mockReturnValue(
        buildThenableSupabase([{ data: null, error: null, count: 3 }])
      )

      const request = createRequest("POST", "https://clarusapp.io/api/collections", {
        name: "New Collection",
      })
      const response = await collectionsPOST(request)
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.upgrade_required).toBe(true)
    })

    it("returns 201 with created collection on success", async () => {
      mockGetEffectiveLimits.mockReturnValue({ collections: 10 })
      // Two from() calls: count query (returns count 2) + insert query (returns MOCK_COLLECTION)
      mockSupabaseQuery.mockReturnValue(
        buildThenableSupabase(
          [{ data: null, error: null, count: 2 }],
          [{ data: MOCK_COLLECTION, error: null }]
        )
      )

      const request = createRequest("POST", "https://clarusapp.io/api/collections", {
        name: "My Collection",
        description: "A test collection",
        color: "#1d9bf0",
      })
      const response = await collectionsPOST(request)
      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.collection).toBeDefined()
      expect(body.collection.name).toBe("My Collection")
    })

    it("returns 400 when collection name already exists (unique constraint)", async () => {
      mockGetEffectiveLimits.mockReturnValue({ collections: 10 })
      // Two from() calls: count query + insert query (unique constraint error)
      mockSupabaseQuery.mockReturnValue(
        buildThenableSupabase(
          [{ data: null, error: null, count: 0 }],
          [{ data: null, error: { code: "23505", message: "unique constraint" } }]
        )
      )

      const request = createRequest("POST", "https://clarusapp.io/api/collections", {
        name: "Existing Collection",
      })
      const response = await collectionsPOST(request)
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/already exists/i)
    })
  })

  // ===========================================================================
  // PATCH /api/collections/[id]
  // ===========================================================================

  describe("PATCH /api/collections/[id]", () => {
    const makeParams = (id: string) => Promise.resolve({ id })

    it("returns 429 when rate limit is exceeded", async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })
      const request = createRequest("PATCH", `https://clarusapp.io/api/collections/${VALID_UUID}`, {
        name: "Updated",
      })
      const response = await collectionPATCH(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(429)
    })

    it("returns 400 when collection ID is not a valid UUID", async () => {
      const request = createRequest("PATCH", `https://clarusapp.io/api/collections/${INVALID_ID}`, {
        name: "Updated",
      })
      const response = await collectionPATCH(request, { params: makeParams(INVALID_ID) })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/invalid collection id/i)
    })

    it("returns 401 when user is not authenticated", async () => {
      mockAuthSuccess = false
      const request = createRequest("PATCH", `https://clarusapp.io/api/collections/${VALID_UUID}`, {
        name: "Updated",
      })
      const response = await collectionPATCH(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(401)
    })

    it("returns 400 when body has no valid update fields", async () => {
      mockSupabaseQuery.mockReturnValue(
        makeSupabase({ data: { id: VALID_UUID, user_id: mockUser.id }, error: null })
      )
      const request = createRequest("PATCH", `https://clarusapp.io/api/collections/${VALID_UUID}`, {})
      const response = await collectionPATCH(request, { params: makeParams(VALID_UUID) })
      // Empty body passes schema (all fields optional) but gets caught by "No fields to update"
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/no fields to update/i)
    })

    it("returns 404 when collection does not exist", async () => {
      mockSupabaseQuery.mockReturnValue(
        makeSupabase({ data: null, error: { message: "Not found", code: "PGRST116" } })
      )
      const request = createRequest("PATCH", `https://clarusapp.io/api/collections/${VALID_UUID}`, {
        name: "Updated",
      })
      const response = await collectionPATCH(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toMatch(/collection not found/i)
    })

    it("returns 403 when collection belongs to a different user", async () => {
      mockSupabaseQuery.mockReturnValue(
        makeSupabase({ data: { id: VALID_UUID, user_id: "other-user-id" }, error: null })
      )
      const request = createRequest("PATCH", `https://clarusapp.io/api/collections/${VALID_UUID}`, {
        name: "Updated",
      })
      const response = await collectionPATCH(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toMatch(/access denied/i)
    })

    it("returns 200 with updated collection on success", async () => {
      const updatedCollection = { ...MOCK_COLLECTION, name: "Updated Name" }
      mockSupabaseQuery.mockReturnValue(
        (() => {
          let callCount = 0
          return {
            from: vi.fn((_table: string) => {
              callCount++
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.update = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() => {
                if (callCount === 1) {
                  return Promise.resolve({ data: { id: VALID_UUID, user_id: mockUser.id }, error: null })
                }
                return Promise.resolve({ data: updatedCollection, error: null })
              })
              return chain
            }),
          }
        })()
      )

      const request = createRequest("PATCH", `https://clarusapp.io/api/collections/${VALID_UUID}`, {
        name: "Updated Name",
      })
      const response = await collectionPATCH(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.collection.name).toBe("Updated Name")
    })

    it("returns 400 when updated name already exists (unique constraint)", async () => {
      mockSupabaseQuery.mockReturnValue(
        (() => {
          let callCount = 0
          return {
            from: vi.fn((_table: string) => {
              callCount++
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.update = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() => {
                if (callCount === 1) {
                  return Promise.resolve({ data: { id: VALID_UUID, user_id: mockUser.id }, error: null })
                }
                return Promise.resolve({ data: null, error: { code: "23505", message: "unique" } })
              })
              return chain
            }),
          }
        })()
      )

      const request = createRequest("PATCH", `https://clarusapp.io/api/collections/${VALID_UUID}`, {
        name: "Duplicate Name",
      })
      const response = await collectionPATCH(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/already exists/i)
    })
  })

  // ===========================================================================
  // DELETE /api/collections/[id]
  // ===========================================================================

  describe("DELETE /api/collections/[id]", () => {
    const makeParams = (id: string) => Promise.resolve({ id })

    it("returns 429 when rate limit is exceeded", async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })
      const request = createRequest("DELETE", `https://clarusapp.io/api/collections/${VALID_UUID}`)
      const response = await collectionDELETE(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(429)
    })

    it("returns 400 when collection ID is not a valid UUID", async () => {
      const request = createRequest("DELETE", `https://clarusapp.io/api/collections/${INVALID_ID}`)
      const response = await collectionDELETE(request, { params: makeParams(INVALID_ID) })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/invalid collection id/i)
    })

    it("returns 401 when user is not authenticated", async () => {
      mockAuthSuccess = false
      const request = createRequest("DELETE", `https://clarusapp.io/api/collections/${VALID_UUID}`)
      const response = await collectionDELETE(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(401)
    })

    it("returns 404 when collection does not exist", async () => {
      mockSupabaseQuery.mockReturnValue(
        makeSupabase({ data: null, error: { message: "Not found", code: "PGRST116" } })
      )
      const request = createRequest("DELETE", `https://clarusapp.io/api/collections/${VALID_UUID}`)
      const response = await collectionDELETE(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(404)
    })

    it("returns 403 when collection belongs to a different user", async () => {
      mockSupabaseQuery.mockReturnValue(
        makeSupabase({ data: { id: VALID_UUID, user_id: "other-user-id" }, error: null })
      )
      const request = createRequest("DELETE", `https://clarusapp.io/api/collections/${VALID_UUID}`)
      const response = await collectionDELETE(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(403)
    })

    it("returns 200 on successful deletion", async () => {
      mockSupabaseQuery.mockReturnValue(
        (() => {
          let callCount = 0
          return {
            from: vi.fn((_table: string) => {
              callCount++
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() => {
                if (callCount === 1) {
                  return Promise.resolve({ data: { id: VALID_UUID, user_id: mockUser.id }, error: null })
                }
                return Promise.resolve({ data: null, error: null })
              })
              chain.delete = vi.fn(() => {
                const deleteChain: Record<string, unknown> = {}
                deleteChain.eq = vi.fn(() => deleteChain)
                deleteChain.then = (resolve: (v: unknown) => void) => {
                  resolve({ data: null, error: null })
                  return Promise.resolve({ data: null, error: null })
                }
                return deleteChain
              })
              return chain
            }),
          }
        })()
      )

      const request = createRequest("DELETE", `https://clarusapp.io/api/collections/${VALID_UUID}`)
      const response = await collectionDELETE(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
    })

    it("returns 500 when database delete fails", async () => {
      mockSupabaseQuery.mockReturnValue(
        (() => {
          let callCount = 0
          return {
            from: vi.fn((_table: string) => {
              callCount++
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() => {
                if (callCount === 1) {
                  return Promise.resolve({ data: { id: VALID_UUID, user_id: mockUser.id }, error: null })
                }
                return Promise.resolve({ data: null, error: null })
              })
              chain.delete = vi.fn(() => {
                const deleteChain: Record<string, unknown> = {}
                deleteChain.eq = vi.fn(() => deleteChain)
                deleteChain.then = (resolve: (v: unknown) => void) => {
                  resolve({ data: null, error: { message: "DB error" } })
                  return Promise.resolve({ data: null, error: { message: "DB error" } })
                }
                return deleteChain
              })
              return chain
            }),
          }
        })()
      )

      const request = createRequest("DELETE", `https://clarusapp.io/api/collections/${VALID_UUID}`)
      const response = await collectionDELETE(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(500)
    })
  })

  // ===========================================================================
  // POST /api/collections/[id]/items
  // ===========================================================================

  describe("POST /api/collections/[id]/items", () => {
    const makeParams = (id: string) => Promise.resolve({ id })

    it("returns 429 when rate limit is exceeded", async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })
      const request = createRequest("POST", `https://clarusapp.io/api/collections/${VALID_UUID}/items`, {
        content_id: VALID_UUID_2,
      })
      const response = await itemsPOST(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(429)
    })

    it("returns 400 when collection ID is not a valid UUID", async () => {
      const request = createRequest("POST", `https://clarusapp.io/api/collections/${INVALID_ID}/items`, {
        content_id: VALID_UUID_2,
      })
      const response = await itemsPOST(request, { params: makeParams(INVALID_ID) })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/invalid collection id/i)
    })

    it("returns 401 when user is not authenticated", async () => {
      mockAuthSuccess = false
      const request = createRequest("POST", `https://clarusapp.io/api/collections/${VALID_UUID}/items`, {
        content_id: VALID_UUID_2,
      })
      const response = await itemsPOST(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(401)
    })

    it("returns 400 when content_id is missing", async () => {
      mockSupabaseQuery.mockReturnValue(makeSupabase())
      const request = createRequest("POST", `https://clarusapp.io/api/collections/${VALID_UUID}/items`, {})
      const response = await itemsPOST(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(400)
    })

    it("returns 400 when content_id is not a valid UUID", async () => {
      mockSupabaseQuery.mockReturnValue(makeSupabase())
      const request = createRequest("POST", `https://clarusapp.io/api/collections/${VALID_UUID}/items`, {
        content_id: INVALID_ID,
      })
      const response = await itemsPOST(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(400)
    })

    it("returns 404 when collection does not exist", async () => {
      mockSupabaseQuery.mockReturnValue(
        (() => {
          return {
            from: vi.fn((_table: string) => {
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() =>
                Promise.resolve({ data: null, error: { code: "PGRST116", message: "Not found" } })
              )
              return chain
            }),
          }
        })()
      )

      const request = createRequest("POST", `https://clarusapp.io/api/collections/${VALID_UUID}/items`, {
        content_id: VALID_UUID_2,
      })
      const response = await itemsPOST(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toMatch(/collection not found/i)
    })

    it("returns 403 when collection belongs to a different user", async () => {
      mockSupabaseQuery.mockReturnValue(
        (() => {
          return {
            from: vi.fn((_table: string) => {
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() =>
                Promise.resolve({ data: { id: VALID_UUID, user_id: "other-user-id" }, error: null })
              )
              return chain
            }),
          }
        })()
      )

      const request = createRequest("POST", `https://clarusapp.io/api/collections/${VALID_UUID}/items`, {
        content_id: VALID_UUID_2,
      })
      const response = await itemsPOST(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(403)
    })

    it("returns 404 when content does not exist", async () => {
      mockSupabaseQuery.mockReturnValue(
        (() => {
          let callCount = 0
          return {
            from: vi.fn((_table: string) => {
              callCount++
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() => {
                // First call: collections table — success
                if (callCount === 1) {
                  return Promise.resolve({ data: { id: VALID_UUID, user_id: mockUser.id }, error: null })
                }
                // Second call: content table — not found
                return Promise.resolve({ data: null, error: { code: "PGRST116", message: "Not found" } })
              })
              return chain
            }),
          }
        })()
      )

      const request = createRequest("POST", `https://clarusapp.io/api/collections/${VALID_UUID}/items`, {
        content_id: VALID_UUID_2,
      })
      const response = await itemsPOST(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toMatch(/content not found/i)
    })

    it("returns 403 when content belongs to a different user", async () => {
      mockSupabaseQuery.mockReturnValue(
        (() => {
          let callCount = 0
          return {
            from: vi.fn((_table: string) => {
              callCount++
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() => {
                if (callCount === 1) {
                  return Promise.resolve({ data: { id: VALID_UUID, user_id: mockUser.id }, error: null })
                }
                return Promise.resolve({ data: { id: VALID_UUID_2, user_id: "other-user-id" }, error: null })
              })
              return chain
            }),
          }
        })()
      )

      const request = createRequest("POST", `https://clarusapp.io/api/collections/${VALID_UUID}/items`, {
        content_id: VALID_UUID_2,
      })
      const response = await itemsPOST(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(403)
    })

    it("returns 201 with item on success", async () => {
      mockSupabaseQuery.mockReturnValue(
        (() => {
          let callCount = 0
          return {
            from: vi.fn((_table: string) => {
              callCount++
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.insert = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() => {
                if (callCount === 1) {
                  return Promise.resolve({ data: { id: VALID_UUID, user_id: mockUser.id }, error: null })
                }
                if (callCount === 2) {
                  return Promise.resolve({ data: { id: VALID_UUID_2, user_id: mockUser.id }, error: null })
                }
                // Insert result
                return Promise.resolve({ data: MOCK_ITEM, error: null })
              })
              return chain
            }),
          }
        })()
      )

      const request = createRequest("POST", `https://clarusapp.io/api/collections/${VALID_UUID}/items`, {
        content_id: VALID_UUID_2,
      })
      const response = await itemsPOST(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.item).toBeDefined()
    })

    it("returns 400 when item is already in the collection (unique constraint)", async () => {
      mockSupabaseQuery.mockReturnValue(
        (() => {
          let callCount = 0
          return {
            from: vi.fn((_table: string) => {
              callCount++
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.insert = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() => {
                if (callCount === 1) {
                  return Promise.resolve({ data: { id: VALID_UUID, user_id: mockUser.id }, error: null })
                }
                if (callCount === 2) {
                  return Promise.resolve({ data: { id: VALID_UUID_2, user_id: mockUser.id }, error: null })
                }
                return Promise.resolve({ data: null, error: { code: "23505", message: "unique constraint" } })
              })
              return chain
            }),
          }
        })()
      )

      const request = createRequest("POST", `https://clarusapp.io/api/collections/${VALID_UUID}/items`, {
        content_id: VALID_UUID_2,
      })
      const response = await itemsPOST(request, { params: makeParams(VALID_UUID) })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/already in this collection/i)
    })
  })

  // ===========================================================================
  // DELETE /api/collections/[id]/items/[contentId]
  // ===========================================================================

  describe("DELETE /api/collections/[id]/items/[contentId]", () => {
    const makeParams = (id: string, contentId: string) => Promise.resolve({ id, contentId })

    it("returns 429 when rate limit is exceeded", async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })
      const request = createRequest(
        "DELETE",
        `https://clarusapp.io/api/collections/${VALID_UUID}/items/${VALID_UUID_2}`
      )
      const response = await itemDELETE(request, { params: makeParams(VALID_UUID, VALID_UUID_2) })
      expect(response.status).toBe(429)
    })

    it("returns 400 when collection ID is not a valid UUID", async () => {
      const request = createRequest(
        "DELETE",
        `https://clarusapp.io/api/collections/${INVALID_ID}/items/${VALID_UUID_2}`
      )
      const response = await itemDELETE(request, { params: makeParams(INVALID_ID, VALID_UUID_2) })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/invalid collection id/i)
    })

    it("returns 400 when content ID is not a valid UUID", async () => {
      const request = createRequest(
        "DELETE",
        `https://clarusapp.io/api/collections/${VALID_UUID}/items/${INVALID_ID}`
      )
      const response = await itemDELETE(request, { params: makeParams(VALID_UUID, INVALID_ID) })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/invalid content id/i)
    })

    it("returns 401 when user is not authenticated", async () => {
      mockAuthSuccess = false
      const request = createRequest(
        "DELETE",
        `https://clarusapp.io/api/collections/${VALID_UUID}/items/${VALID_UUID_2}`
      )
      const response = await itemDELETE(request, { params: makeParams(VALID_UUID, VALID_UUID_2) })
      expect(response.status).toBe(401)
    })

    it("returns 404 when collection does not exist", async () => {
      mockSupabaseQuery.mockReturnValue(
        makeSupabase({ data: null, error: { code: "PGRST116", message: "Not found" } })
      )
      const request = createRequest(
        "DELETE",
        `https://clarusapp.io/api/collections/${VALID_UUID}/items/${VALID_UUID_2}`
      )
      const response = await itemDELETE(request, { params: makeParams(VALID_UUID, VALID_UUID_2) })
      expect(response.status).toBe(404)
    })

    it("returns 403 when collection belongs to a different user", async () => {
      mockSupabaseQuery.mockReturnValue(
        makeSupabase({ data: { id: VALID_UUID, user_id: "other-user-id" }, error: null })
      )
      const request = createRequest(
        "DELETE",
        `https://clarusapp.io/api/collections/${VALID_UUID}/items/${VALID_UUID_2}`
      )
      const response = await itemDELETE(request, { params: makeParams(VALID_UUID, VALID_UUID_2) })
      expect(response.status).toBe(403)
    })

    it("returns 200 on successful item removal", async () => {
      mockSupabaseQuery.mockReturnValue(
        (() => {
          let callCount = 0
          return {
            from: vi.fn((_table: string) => {
              callCount++
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() => {
                if (callCount === 1) {
                  return Promise.resolve({ data: { id: VALID_UUID, user_id: mockUser.id }, error: null })
                }
                return Promise.resolve({ data: null, error: null })
              })
              chain.delete = vi.fn(() => {
                const deleteChain: Record<string, unknown> = {}
                deleteChain.eq = vi.fn(() => deleteChain)
                deleteChain.then = (resolve: (v: unknown) => void) => {
                  resolve({ data: null, error: null })
                  return Promise.resolve({ data: null, error: null })
                }
                return deleteChain
              })
              return chain
            }),
          }
        })()
      )

      const request = createRequest(
        "DELETE",
        `https://clarusapp.io/api/collections/${VALID_UUID}/items/${VALID_UUID_2}`
      )
      const response = await itemDELETE(request, { params: makeParams(VALID_UUID, VALID_UUID_2) })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
    })

    it("returns 500 when database delete fails", async () => {
      mockSupabaseQuery.mockReturnValue(
        (() => {
          let callCount = 0
          return {
            from: vi.fn((_table: string) => {
              callCount++
              const chain: Record<string, unknown> = {}
              chain.select = vi.fn(() => chain)
              chain.eq = vi.fn(() => chain)
              chain.single = vi.fn(() => {
                if (callCount === 1) {
                  return Promise.resolve({ data: { id: VALID_UUID, user_id: mockUser.id }, error: null })
                }
                return Promise.resolve({ data: null, error: null })
              })
              chain.delete = vi.fn(() => {
                const deleteChain: Record<string, unknown> = {}
                deleteChain.eq = vi.fn(() => deleteChain)
                deleteChain.then = (resolve: (v: unknown) => void) => {
                  resolve({ data: null, error: { message: "DB error" } })
                  return Promise.resolve({ data: null, error: { message: "DB error" } })
                }
                return deleteChain
              })
              return chain
            }),
          }
        })()
      )

      const request = createRequest(
        "DELETE",
        `https://clarusapp.io/api/collections/${VALID_UUID}/items/${VALID_UUID_2}`
      )
      const response = await itemDELETE(request, { params: makeParams(VALID_UUID, VALID_UUID_2) })
      expect(response.status).toBe(500)
    })
  })
})

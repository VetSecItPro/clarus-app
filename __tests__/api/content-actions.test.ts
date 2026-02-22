import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before any imports that pull in route code
// =============================================================================

// ---------- Rate limiting — allow by default ----------
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// ---------- Auth — fully controllable per-test ----------
let mockAuthSuccess = true
const mockUser = { id: "user-abc-123", email: "test@clarusapp.io" }

// Supabase builder state (shared across all routes, reset in beforeEach)
type MockQueryResult = { data: unknown; error: unknown }
const mockQueryResult: MockQueryResult = { data: null, error: null }

function buildChainableMock() {
  // Minimal fluent Supabase builder that routes actually traverse
  const chain: Record<string, unknown> = {}

  const self = new Proxy(chain, {
    get(_target, prop: string) {
      if (prop === "then") return undefined // not a Promise itself
      if (prop === "single" || prop === "maybeSingle") {
        return () => Promise.resolve(mockQueryResult)
      }
      if (prop === "select") return () => self
      if (prop === "eq") return () => self
      if (prop === "neq") return () => self
      if (prop === "not") return () => self
      if (prop === "limit") return () => Promise.resolve(mockQueryResult)
      if (prop === "update") return (_payload: unknown) => {
        return self
      }
      if (prop === "upsert") return (_payload: unknown) => {
        return Promise.resolve({ error: null })
      }
      // Default: return self for chaining
      return () => self
    },
  })

  return self
}

function makeSupabase(overrides: Record<string, unknown> = {}) {
  const fromMap: Record<string, unknown> = {}
  return {
    from: (table: string) => {
      if (fromMap[table]) return fromMap[table]
      return buildChainableMock()
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  }
}

let mockSupabase = makeSupabase()

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
  verifyContentOwnership: vi.fn(async (_supabase: unknown, _userId: string, _contentId: string) => {
    return mockOwnershipResult()
  }),
  AuthErrors: {
    badRequest: (msg = "Invalid request") => {
      const { NextResponse } = require("next/server")
      return NextResponse.json({ error: msg }, { status: 400 })
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
    notFound: (resource = "Resource") => {
      const { NextResponse } = require("next/server")
      return NextResponse.json({ error: `${resource} not found` }, { status: 404 })
    },
  },
}))

// ---------- Ownership state ----------
let ownershipOwned = true
const mockContent = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  user_id: "user-abc-123",
  title: "Test Article",
  url: "https://example.com/article",
  type: "article",
  thumbnail_url: null,
  tags: ["news", "tech"],
  is_bookmarked: false,
  date_added: "2024-01-01T00:00:00Z",
  share_token: null,
  author: null,
  duration: null,
  detected_tone: null,
}

function mockOwnershipResult() {
  const { NextResponse } = require("next/server")
  if (!ownershipOwned) {
    return {
      owned: false,
      response: NextResponse.json({ error: "Content not found" }, { status: 404 }),
    }
  }
  return { owned: true, content: { ...mockContent } }
}

// ---------- Usage enforcement ----------
const mockEnforceAndIncrementUsage = vi.fn()
vi.mock("@/lib/usage", () => ({
  enforceAndIncrementUsage: (...args: unknown[]) => mockEnforceAndIncrementUsage(...args),
  getUserTier: vi.fn().mockResolvedValue("pro"),
  getUserTierAndAdmin: vi.fn().mockResolvedValue({ tier: "pro", isAdmin: false }),
}))

// ---------- Tier features ----------
vi.mock("@/lib/tier-limits", () => ({
  TIER_FEATURES: {
    free: {
      claimTracking: false,
      shareLinks: false,
      multiLanguageAnalysis: false,
    },
    starter: {
      claimTracking: false,
      shareLinks: true,
      multiLanguageAnalysis: true,
    },
    pro: {
      claimTracking: true,
      shareLinks: true,
      multiLanguageAnalysis: true,
    },
    day_pass: {
      claimTracking: true,
      shareLinks: true,
      multiLanguageAnalysis: true,
    },
  },
  normalizeTier: vi.fn((_tier: unknown, _exp: unknown) => "pro"),
  getEffectiveLimits: vi.fn(() => ({
    tags: 100,
  })),
}))

// ---------- Share token generation ----------
vi.mock("@/lib/share-token", () => ({
  generateShareToken: vi.fn(() => "MockToken1234"),
}))

// ---------- Language validation ----------
const mockIsValidLanguage = vi.fn()
const mockGetLanguageConfig = vi.fn()
vi.mock("@/lib/languages", () => ({
  isValidLanguage: (...args: unknown[]) => mockIsValidLanguage(...args),
  getLanguageConfig: (...args: unknown[]) => mockGetLanguageConfig(...args),
}))

// ---------- API usage logging ----------
vi.mock("@/lib/api-usage", () => ({
  logApiUsage: vi.fn().mockResolvedValue(undefined),
}))

// ---------- Prompt sanitizer ----------
vi.mock("@/lib/prompt-sanitizer", () => ({
  sanitizeForPrompt: vi.fn((s: unknown) => s),
  wrapUserContent: vi.fn((s: unknown) => String(s)),
  INSTRUCTION_ANCHOR: "\n[END OF USER CONTENT]",
  detectOutputLeakage: vi.fn(),
}))

// ---------- Logger ----------
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

// =============================================================================
// Import route handlers AFTER all mocks are in place
// =============================================================================

import { PATCH as bookmarkPATCH } from "@/app/api/content/[id]/bookmark/route"
import { GET as crossRefsGET } from "@/app/api/content/[id]/cross-references/route"
import { GET as shareLinkGET, POST as shareLinkPOST } from "@/app/api/content/[id]/share-link/route"
import { GET as tagsGET, PATCH as tagsPATCH } from "@/app/api/content/[id]/tags/route"
import { POST as translatePOST } from "@/app/api/content/[id]/translate/route"

// =============================================================================
// Helpers
// =============================================================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"
const INVALID_ID = "not-a-valid-uuid"

/** Build the params Promise that Next.js dynamic routes receive */
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeRequest(method: string, body?: unknown, headers: Record<string, string> = {}) {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4", ...headers },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new Request(`https://clarusapp.io/api/content/${VALID_UUID}`, init)
}

// =============================================================================
// Reset helpers
// =============================================================================

function resetDefaults() {
  vi.clearAllMocks()
  mockAuthSuccess = true
  ownershipOwned = true
  mockSupabase = makeSupabase()
  mockQueryResult.data = null
  mockQueryResult.error = null

  mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
  mockEnforceAndIncrementUsage.mockResolvedValue({
    allowed: true,
    currentCount: 1,
    limit: 5,
    tier: "pro",
  })
  mockIsValidLanguage.mockReturnValue(true)
  mockGetLanguageConfig.mockReturnValue({ name: "Spanish", nativeName: "Español", dir: "ltr" })
}

// =============================================================================
// BOOKMARK — PATCH /api/content/[id]/bookmark
// =============================================================================

describe("PATCH /api/content/[id]/bookmark", () => {
  beforeEach(resetDefaults)

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false
    const response = await bookmarkPATCH(makeRequest("PATCH", { is_bookmarked: true }), makeParams(VALID_UUID))
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it("returns 400 for invalid content ID", async () => {
    const response = await bookmarkPATCH(makeRequest("PATCH", { is_bookmarked: true }), makeParams(INVALID_ID))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/invalid content id/i)
  })

  it("returns 404 when content not found or not owned", async () => {
    ownershipOwned = false
    const response = await bookmarkPATCH(makeRequest("PATCH", { is_bookmarked: true }), makeParams(VALID_UUID))
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toMatch(/content not found/i)
  })

  it("returns 400 when body is missing is_bookmarked field", async () => {
    const response = await bookmarkPATCH(makeRequest("PATCH", {}), makeParams(VALID_UUID))
    expect(response.status).toBe(400)
  })

  it("returns 403 when bookmark limit is reached while adding", async () => {
    mockEnforceAndIncrementUsage.mockResolvedValue({
      allowed: false,
      currentCount: 5,
      limit: 5,
      tier: "free",
    })
    mockQueryResult.data = { id: VALID_UUID, is_bookmarked: true }
    const response = await bookmarkPATCH(makeRequest("PATCH", { is_bookmarked: true }), makeParams(VALID_UUID))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.upgrade_required).toBe(true)
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })
    const response = await bookmarkPATCH(makeRequest("PATCH", { is_bookmarked: true }), makeParams(VALID_UUID))
    expect(response.status).toBe(429)
  })

  it("returns 200 when adding a bookmark successfully", async () => {
    // Wire up a Supabase mock that returns a successful result from .single()
    const updateChain = {
      eq: () => updateChain,
      select: () => updateChain,
      single: () => Promise.resolve({ data: { id: VALID_UUID, is_bookmarked: true }, error: null }),
    }
    mockSupabase = {
      from: () => ({ update: () => updateChain }),
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await bookmarkPATCH(makeRequest("PATCH", { is_bookmarked: true }), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.is_bookmarked).toBe(true)
  })

  it("returns 200 when removing a bookmark (skips usage check)", async () => {
    const updateChain = {
      eq: () => updateChain,
      select: () => updateChain,
      single: () => Promise.resolve({ data: { id: VALID_UUID, is_bookmarked: false }, error: null }),
    }
    mockSupabase = {
      from: () => ({ update: () => updateChain }),
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await bookmarkPATCH(makeRequest("PATCH", { is_bookmarked: false }), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.is_bookmarked).toBe(false)
    // Usage should NOT have been incremented when removing
    expect(mockEnforceAndIncrementUsage).not.toHaveBeenCalled()
  })
})

// =============================================================================
// CROSS-REFERENCES — GET /api/content/[id]/cross-references
// =============================================================================

describe("GET /api/content/[id]/cross-references", () => {
  beforeEach(resetDefaults)

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false
    const response = await crossRefsGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(401)
  })

  it("returns 400 for invalid content ID", async () => {
    const response = await crossRefsGET(makeRequest("GET"), makeParams(INVALID_ID))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/invalid content id/i)
  })

  it("returns 403 when user is on free tier (no claim tracking)", async () => {
    const { getUserTier } = await import("@/lib/usage")
    vi.mocked(getUserTier).mockResolvedValueOnce("free")

    const response = await crossRefsGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.upgrade).toBe(true)
    expect(body.error).toMatch(/claim tracking/i)
  })

  it("returns 404 when content not found or not owned", async () => {
    ownershipOwned = false
    const response = await crossRefsGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(404)
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 15000 })
    const response = await crossRefsGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(429)
  })

  it("returns 200 with empty crossReferences when no claims exist", async () => {
    // The claims query chains: .from("claims").select(...).eq(...).eq(...)
    // The second .eq() must return a thenable that resolves to { data, error }.
    function makeClaimsChain(result: { data: unknown; error: unknown }) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        // First .eq() returns the same chain
        eq: () => secondEqChain,
      }
      const secondEqChain: Record<string, unknown> = {
        // Second .eq() returns a real Promise so the route can await it
        eq: () => Promise.resolve(result),
        then: undefined,
      }
      return chain
    }

    mockSupabase = {
      from: (table: string) => {
        if (table === "claims") return makeClaimsChain({ data: [], error: null })
        return buildChainableMock()
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await crossRefsGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.crossReferences).toEqual([])
  })

  it("returns 200 with crossReferences when similar claims are found", async () => {
    const fakeClaims = [{ id: "claim-1", claim_text: "The earth is flat" }]
    const fakeSimilar = [
      {
        content_id: "other-content-uuid",
        content_title: "Conspiracy Theories",
        claim_text: "Earth is flat",
        status: "disputed",
        similarity_score: 0.9,
      },
    ]

    function makeClaimsChain(result: { data: unknown; error: unknown }) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => secondEqChain,
      }
      const secondEqChain: Record<string, unknown> = {
        eq: () => Promise.resolve(result),
        then: undefined,
      }
      return chain
    }

    mockSupabase = {
      from: (table: string) => {
        if (table === "claims") return makeClaimsChain({ data: fakeClaims, error: null })
        return buildChainableMock()
      },
      rpc: vi.fn().mockResolvedValue({ data: fakeSimilar, error: null }),
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await crossRefsGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.crossReferences).toHaveLength(1)
    expect(body.crossReferences[0].claimText).toBe("The earth is flat")
    expect(body.crossReferences[0].matches[0].contentId).toBe("other-content-uuid")
  })
})

// =============================================================================
// SHARE LINK — GET /api/content/[id]/share-link
// =============================================================================

describe("GET /api/content/[id]/share-link", () => {
  beforeEach(resetDefaults)

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false
    const response = await shareLinkGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(401)
  })

  it("returns 400 for invalid content ID", async () => {
    const response = await shareLinkGET(makeRequest("GET"), makeParams(INVALID_ID))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/invalid content id/i)
  })

  it("returns 404 when content not found or not owned", async () => {
    ownershipOwned = false
    const response = await shareLinkGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(404)
  })

  it("returns 200 with null share_token when no token exists", async () => {
    // mockContent.share_token is null by default
    const response = await shareLinkGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.share_token).toBeNull()
    expect(body.share_url).toBeNull()
  })

  it("returns 200 with share_token and share_url when token exists", async () => {
    const { verifyContentOwnership } = await import("@/lib/auth")
    vi.mocked(verifyContentOwnership).mockResolvedValueOnce({
      owned: true,
      content: { ...mockContent, share_token: "ExistingToken1" },
    })

    const response = await shareLinkGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.share_token).toBe("ExistingToken1")
    expect(body.share_url).toContain("ExistingToken1")
  })
})

// =============================================================================
// SHARE LINK — POST /api/content/[id]/share-link
// =============================================================================

describe("POST /api/content/[id]/share-link", () => {
  beforeEach(resetDefaults)

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false
    const response = await shareLinkPOST(makeRequest("POST"), makeParams(VALID_UUID))
    expect(response.status).toBe(401)
  })

  it("returns 400 for invalid content ID", async () => {
    const response = await shareLinkPOST(makeRequest("POST"), makeParams(INVALID_ID))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/invalid content id/i)
  })

  it("returns 404 when content not found or not owned", async () => {
    ownershipOwned = false
    const response = await shareLinkPOST(makeRequest("POST"), makeParams(VALID_UUID))
    expect(response.status).toBe(404)
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 60000 })
    const response = await shareLinkPOST(makeRequest("POST"), makeParams(VALID_UUID))
    expect(response.status).toBe(429)
  })

  it("returns 403 when user tier does not support share links", async () => {
    const { normalizeTier } = await import("@/lib/tier-limits")
    vi.mocked(normalizeTier).mockReturnValueOnce("free")

    // Wire up a supabase that returns free-tier user data
    const usersChain = {
      select: () => usersChain,
      eq: () => usersChain,
      single: () => Promise.resolve({ data: { tier: "free", day_pass_expires_at: null }, error: null }),
    }
    mockSupabase = {
      from: () => usersChain,
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await shareLinkPOST(makeRequest("POST"), makeParams(VALID_UUID))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.upgrade_required).toBe(true)
    expect(body.error).toMatch(/share links require/i)
  })

  it("returns 200 with existing token when content already has a share_token", async () => {
    const { verifyContentOwnership } = await import("@/lib/auth")
    vi.mocked(verifyContentOwnership).mockResolvedValueOnce({
      owned: true,
      content: { ...mockContent, share_token: "ExistingToken99" },
    })

    const usersChain = {
      select: () => usersChain,
      eq: () => usersChain,
      single: () => Promise.resolve({ data: { tier: "pro", day_pass_expires_at: null }, error: null }),
    }
    mockSupabase = { from: () => usersChain } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await shareLinkPOST(makeRequest("POST"), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.share_token).toBe("ExistingToken99")
    // Usage should NOT have been incremented for an already-generated token
    expect(mockEnforceAndIncrementUsage).not.toHaveBeenCalled()
  })

  it("returns 200 with new token when generating for the first time", async () => {
    // Simulate pro user, content with no existing token, usage allowed
    const updateChain = {
      eq: () => Promise.resolve({ error: null }),
    }
    const usersChain = {
      select: () => usersChain,
      eq: () => usersChain,
      single: () => Promise.resolve({ data: { tier: "pro", day_pass_expires_at: null }, error: null }),
    }
    mockSupabase = {
      from: (table: string) => {
        if (table === "users") return usersChain
        if (table === "content") return { update: () => updateChain }
        return buildChainableMock()
      },
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await shareLinkPOST(makeRequest("POST"), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.share_token).toBe("MockToken1234")
    expect(body.share_url).toContain("MockToken1234")
    expect(mockEnforceAndIncrementUsage).toHaveBeenCalledWith(
      expect.anything(),
      mockUser.id,
      "share_links_count"
    )
  })

  it("returns 403 when monthly share link limit is reached", async () => {
    mockEnforceAndIncrementUsage.mockResolvedValue({
      allowed: false,
      currentCount: 10,
      limit: 10,
      tier: "starter",
    })

    const usersChain = {
      select: () => usersChain,
      eq: () => usersChain,
      single: () => Promise.resolve({ data: { tier: "starter", day_pass_expires_at: null }, error: null }),
    }
    mockSupabase = { from: () => usersChain } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await shareLinkPOST(makeRequest("POST"), makeParams(VALID_UUID))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.upgrade_required).toBe(true)
    expect(body.error).toMatch(/share link limit/i)
  })
})

// =============================================================================
// TAGS — GET /api/content/[id]/tags
// =============================================================================

describe("GET /api/content/[id]/tags", () => {
  beforeEach(resetDefaults)

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false
    const response = await tagsGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(401)
  })

  it("returns 400 for invalid content ID", async () => {
    const response = await tagsGET(makeRequest("GET"), makeParams(INVALID_ID))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/invalid content id/i)
  })

  it("returns 404 when content not found or not owned", async () => {
    ownershipOwned = false
    const response = await tagsGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(404)
  })

  it("returns 200 with tags array from content", async () => {
    const response = await tagsGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.tags).toEqual(["news", "tech"])
  })

  it("returns 200 with empty array when content has no tags", async () => {
    const { verifyContentOwnership } = await import("@/lib/auth")
    vi.mocked(verifyContentOwnership).mockResolvedValueOnce({
      owned: true,
      content: { ...mockContent, tags: [] },
    })

    const response = await tagsGET(makeRequest("GET"), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.tags).toEqual([])
  })
})

// =============================================================================
// TAGS — PATCH /api/content/[id]/tags
// =============================================================================

describe("PATCH /api/content/[id]/tags", () => {
  beforeEach(resetDefaults)

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false
    const response = await tagsPATCH(makeRequest("PATCH", { action: "add", tag: "science" }), makeParams(VALID_UUID))
    expect(response.status).toBe(401)
  })

  it("returns 400 for invalid content ID", async () => {
    const response = await tagsPATCH(makeRequest("PATCH", { action: "add", tag: "x" }), makeParams(INVALID_ID))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/invalid content id/i)
  })

  it("returns 404 when content not found or not owned", async () => {
    ownershipOwned = false
    const response = await tagsPATCH(makeRequest("PATCH", { action: "add", tag: "science" }), makeParams(VALID_UUID))
    expect(response.status).toBe(404)
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })
    const response = await tagsPATCH(makeRequest("PATCH", { action: "add", tag: "science" }), makeParams(VALID_UUID))
    expect(response.status).toBe(429)
  })

  it("returns 400 when body has invalid action", async () => {
    const response = await tagsPATCH(makeRequest("PATCH", { action: "delete", tag: "news" }), makeParams(VALID_UUID))
    expect(response.status).toBe(400)
  })

  it("returns 400 when tag is empty string", async () => {
    const response = await tagsPATCH(makeRequest("PATCH", { action: "add", tag: "   " }), makeParams(VALID_UUID))
    expect(response.status).toBe(400)
  })

  it("returns 200 when adding a new tag", async () => {
    const updateChain = {
      eq: () => updateChain,
      select: () => updateChain,
      single: () => Promise.resolve({ data: { id: VALID_UUID, tags: ["news", "tech", "science"] }, error: null }),
    }
    // Tags PATCH also calls .from("content").select("tags").eq().not().limit()
    const allContentChain = {
      select: () => allContentChain,
      eq: () => allContentChain,
      not: () => allContentChain,
      limit: () => Promise.resolve({ data: [{ tags: ["news", "tech"] }], error: null }),
    }
    mockSupabase = {
      from: (table: string) => {
        if (table === "content") return {
          ...allContentChain,
          update: () => updateChain,
        }
        return buildChainableMock()
      },
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await tagsPATCH(makeRequest("PATCH", { action: "add", tag: "science" }), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.tags).toContain("science")
  })

  it("returns 200 when removing a tag", async () => {
    const updateChain = {
      eq: () => updateChain,
      select: () => updateChain,
      single: () => Promise.resolve({ data: { id: VALID_UUID, tags: ["tech"] }, error: null }),
    }
    mockSupabase = {
      from: () => ({ update: () => updateChain }),
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await tagsPATCH(makeRequest("PATCH", { action: "remove", tag: "news" }), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.tags).not.toContain("news")
  })

  it("returns 200 when setting tags via set action", async () => {
    const updateChain = {
      eq: () => updateChain,
      select: () => updateChain,
      single: () => Promise.resolve({ data: { id: VALID_UUID, tags: ["alpha", "beta"] }, error: null }),
    }
    mockSupabase = {
      from: () => ({ update: () => updateChain }),
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await tagsPATCH(makeRequest("PATCH", { action: "set", tags: ["alpha", "beta"] }), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
  })

  it("returns 403 when unique tag limit is exceeded for add action", async () => {
    const { getEffectiveLimits } = await import("@/lib/tier-limits")
    vi.mocked(getEffectiveLimits).mockReturnValueOnce({ tags: 2 } as ReturnType<typeof getEffectiveLimits>)

    // All content query returns enough tags to exceed limit
    const allContentChain = {
      select: () => allContentChain,
      eq: () => allContentChain,
      not: () => allContentChain,
      limit: () => Promise.resolve({ data: [{ tags: ["news", "tech"] }], error: null }),
    }
    mockSupabase = {
      from: () => allContentChain,
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await tagsPATCH(makeRequest("PATCH", { action: "add", tag: "newone" }), makeParams(VALID_UUID))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toMatch(/tag limit reached/i)
  })
})

// =============================================================================
// TRANSLATE — POST /api/content/[id]/translate
// =============================================================================

describe("POST /api/content/[id]/translate", () => {
  beforeEach(() => {
    resetDefaults()
    // Default: language valid
    mockIsValidLanguage.mockReturnValue(true)
    // Default: tier supports multiLanguageAnalysis via normalizeTier returning 'pro'
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthSuccess = false
    const response = await translatePOST(makeRequest("POST", { language: "es" }), makeParams(VALID_UUID))
    expect(response.status).toBe(401)
  })

  it("returns 400 for invalid content ID", async () => {
    const response = await translatePOST(makeRequest("POST", { language: "es" }), makeParams(INVALID_ID))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/invalid content id/i)
  })

  it("returns 404 when content not found or not owned", async () => {
    ownershipOwned = false
    const response = await translatePOST(makeRequest("POST", { language: "es" }), makeParams(VALID_UUID))
    expect(response.status).toBe(404)
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 20000 })
    const response = await translatePOST(makeRequest("POST", { language: "es" }), makeParams(VALID_UUID))
    expect(response.status).toBe(429)
  })

  it("returns 400 for invalid JSON body", async () => {
    const request = new Request(`https://clarusapp.io/api/content/${VALID_UUID}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
      body: "{{invalid json",
    })
    const response = await translatePOST(request, makeParams(VALID_UUID))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/invalid json body/i)
  })

  it("returns 400 when language is missing from body", async () => {
    const response = await translatePOST(makeRequest("POST", {}), makeParams(VALID_UUID))
    expect(response.status).toBe(400)
  })

  it("returns 400 when language code is invalid", async () => {
    mockIsValidLanguage.mockReturnValue(false)
    const response = await translatePOST(makeRequest("POST", { language: "xx" }), makeParams(VALID_UUID))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/invalid.*language/i)
  })

  it("returns 403 when tier does not support multi-language analysis", async () => {
    const { normalizeTier } = await import("@/lib/tier-limits")
    vi.mocked(normalizeTier).mockReturnValueOnce("free")

    const usersChain = {
      select: () => usersChain,
      eq: () => usersChain,
      single: () => Promise.resolve({ data: { tier: "free", day_pass_expires_at: null }, error: null }),
    }
    const summariesChain = {
      select: () => summariesChain,
      eq: () => summariesChain,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    }
    mockSupabase = {
      from: (table: string) => {
        if (table === "users") return usersChain
        if (table === "summaries") return summariesChain
        return buildChainableMock()
      },
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await translatePOST(makeRequest("POST", { language: "es" }), makeParams(VALID_UUID))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.upgrade_required).toBe(true)
    expect(body.error).toMatch(/multi-language/i)
  })

  it("returns the existing translation when already complete", async () => {
    const completeSummary = {
      id: "sum-1",
      content_id: VALID_UUID,
      user_id: mockUser.id,
      language: "es",
      processing_status: "complete",
      brief_overview: "Resumen en español",
      model_name: "gemini",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    }

    const usersChain = {
      select: () => usersChain,
      eq: () => usersChain,
      single: () => Promise.resolve({ data: { tier: "pro", day_pass_expires_at: null }, error: null }),
    }
    const summaryMaybeSingle = vi.fn().mockResolvedValue({ data: completeSummary, error: null })
    const summariesChain = {
      select: () => summariesChain,
      eq: () => summariesChain,
      maybeSingle: summaryMaybeSingle,
    }
    mockSupabase = {
      from: (table: string) => {
        if (table === "users") return usersChain
        if (table === "summaries") return summariesChain
        return buildChainableMock()
      },
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await translatePOST(makeRequest("POST", { language: "es" }), makeParams(VALID_UUID))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.processing_status).toBe("complete")
    expect(body.language).toBe("es")
  })

  it("returns 202 when translation is already in progress", async () => {
    const inProgressSummary = {
      id: "sum-1",
      content_id: VALID_UUID,
      language: "es",
      processing_status: "translating",
    }

    const usersChain = {
      select: () => usersChain,
      eq: () => usersChain,
      single: () => Promise.resolve({ data: { tier: "pro", day_pass_expires_at: null }, error: null }),
    }
    const summariesChain = {
      select: () => summariesChain,
      eq: () => summariesChain,
      maybeSingle: () => Promise.resolve({ data: inProgressSummary, error: null }),
    }
    mockSupabase = {
      from: (table: string) => {
        if (table === "users") return usersChain
        if (table === "summaries") return summariesChain
        return buildChainableMock()
      },
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await translatePOST(makeRequest("POST", { language: "es" }), makeParams(VALID_UUID))
    expect(response.status).toBe(202)
    const body = await response.json()
    expect(body.status).toBe("translating")
  })

  it("returns 400 when no completed source analysis exists to translate from", async () => {
    const usersChain = {
      select: () => usersChain,
      eq: () => usersChain,
      single: () => Promise.resolve({ data: { tier: "pro", day_pass_expires_at: null }, error: null }),
    }

    // maybeSingle returns null (no existing translation), allSummaries returns empty
    const summariesChain = {
      select: () => summariesChain,
      eq: () => summariesChain,
      neq: () => summariesChain,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      // The second query (for source summaries) also returns empty
      then: undefined as undefined,
    }

    let summaryCallCount = 0
    mockSupabase = {
      from: (table: string) => {
        if (table === "users") return usersChain
        if (table === "summaries") {
          summaryCallCount++
          if (summaryCallCount === 1) {
            // First: maybeSingle for existing translation
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
            }
          }
          // Second: source summaries query returns empty
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  neq: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }
        }
        return buildChainableMock()
      },
    } as unknown as ReturnType<typeof makeSupabase>

    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      supabase: mockSupabase as never,
    })

    const response = await translatePOST(makeRequest("POST", { language: "es" }), makeParams(VALID_UUID))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/no completed analysis/i)
  })
})

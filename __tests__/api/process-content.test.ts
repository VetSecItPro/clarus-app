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
}))

// Language validation — pass by default
const mockIsValidLanguage = vi.fn()
vi.mock("@/lib/languages", () => ({
  isValidLanguage: (...args: unknown[]) => mockIsValidLanguage(...args),
}))

// processContent — the core pipeline, mocked entirely
const mockProcessContent = vi.fn()
vi.mock("@/lib/process-content", async () => {
  // Import the real ProcessContentError class shape
  const { ProcessContentError } = await import("@/lib/pipeline/types")
  return {
    processContent: (...args: unknown[]) => mockProcessContent(...args),
    ProcessContentError,
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

import { POST } from "@/app/api/process-content/route"
import { ProcessContentError } from "@/lib/pipeline/types"

// =============================================================================
// Helpers
// =============================================================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

function createRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://clarusapp.io/api/process-content", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/process-content", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true

    // Default: rate limit allows all requests
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })

    // Default: language validation passes
    mockIsValidLanguage.mockReturnValue(true)

    // Default: processContent returns a successful result
    mockProcessContent.mockResolvedValue({
      success: true,
      cached: false,
      contentId: VALID_UUID,
      sectionsGenerated: ["triage", "truth_check", "action_items"],
      language: "en",
      message: "Analysis complete",
      transcriptId: null,
      paywallWarning: null,
    })
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 30000 })

    const request = createRequest({ content_id: VALID_UUID })
    const response = await POST(request)
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

    const request = createRequest({ content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  it("bypasses session auth when a valid internal API secret is provided", async () => {
    // Set env so the route can validate it
    process.env.INTERNAL_API_SECRET = "super-secret-key"
    // Even with auth disabled, an internal call should pass
    mockAuthSuccess = false

    const request = createRequest(
      { content_id: VALID_UUID },
      { authorization: "Bearer super-secret-key" }
    )
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)

    delete process.env.INTERNAL_API_SECRET
  })

  // ---------------------------------------------------------------------------
  // Request body validation
  // ---------------------------------------------------------------------------

  it("returns 400 for invalid JSON body", async () => {
    const request = new Request("https://clarusapp.io/api/process-content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not valid json{{",
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/invalid request body/i)
  })

  it("returns 400 when content_id is missing", async () => {
    const request = createRequest({ force_regenerate: false })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when content_id is not a valid UUID", async () => {
    const request = createRequest({ content_id: "not-a-uuid" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Language validation
  // ---------------------------------------------------------------------------

  it("returns 400 when an unsupported language code is provided", async () => {
    mockIsValidLanguage.mockReturnValue(false)

    const request = createRequest({ content_id: VALID_UUID, language: "xx" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/invalid language/i)
  })

  it("accepts a valid non-English language code", async () => {
    mockIsValidLanguage.mockReturnValue(true)

    const request = createRequest({ content_id: VALID_UUID, language: "es" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("defaults to English when no language is provided", async () => {
    const request = createRequest({ content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.language).toBe("en")
  })

  // ---------------------------------------------------------------------------
  // Tier / usage enforcement (403 via ProcessContentError)
  // ---------------------------------------------------------------------------

  it("returns 403 when user exceeds their tier limit", async () => {
    mockProcessContent.mockRejectedValue(
      new ProcessContentError("Monthly analysis limit reached", 403, true, "free")
    )

    const request = createRequest({ content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/monthly analysis limit/i)
    expect(body.upgrade_required).toBe(true)
    expect(body.tier).toBe("free")
    expect(body.success).toBe(false)
  })

  it("returns 402 with upgrade_required flag for payment-required errors", async () => {
    mockProcessContent.mockRejectedValue(
      new ProcessContentError("Upgrade required to analyse podcasts", 402, true, "free")
    )

    const request = createRequest({ content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(402)
    expect(body.upgrade_required).toBe(true)
    expect(body.success).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Content not found / other pipeline errors
  // ---------------------------------------------------------------------------

  it("returns 404 when the content record does not exist", async () => {
    mockProcessContent.mockRejectedValue(
      new ProcessContentError("Content not found", 404)
    )

    const request = createRequest({ content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/content not found/i)
  })

  it("returns 500 for unexpected errors", async () => {
    mockProcessContent.mockRejectedValue(new Error("Unexpected DB failure"))

    const request = createRequest({ content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe("Internal server error")
  })

  // ---------------------------------------------------------------------------
  // 200 success — shape validation
  // ---------------------------------------------------------------------------

  it("returns 200 with correct shape on successful analysis", async () => {
    mockProcessContent.mockResolvedValue({
      success: true,
      cached: false,
      contentId: VALID_UUID,
      sectionsGenerated: ["triage", "truth_check", "action_items", "detailed_summary"],
      language: "en",
      message: "Analysis complete",
      transcriptId: "txn-123",
      paywallWarning: null,
    })

    const request = createRequest({ content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.cached).toBe(false)
    expect(body.content_id).toBe(VALID_UUID)
    expect(body.sections_generated).toEqual(["triage", "truth_check", "action_items", "detailed_summary"])
    expect(body.language).toBe("en")
    expect(body.transcript_id).toBe("txn-123")
    expect(body.paywall_warning).toBeNull()
  })

  it("returns 200 with cached=true when content was already analysed", async () => {
    mockProcessContent.mockResolvedValue({
      success: true,
      cached: true,
      contentId: VALID_UUID,
      sectionsGenerated: [],
      language: "en",
      message: "Served from cache",
      transcriptId: null,
      paywallWarning: null,
    })

    const request = createRequest({ content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.cached).toBe(true)
    expect(body.message).toBe("Served from cache")
  })

  it("passes force_regenerate and skipScraping flags through to processContent", async () => {
    const request = createRequest({
      content_id: VALID_UUID,
      force_regenerate: true,
      skipScraping: true,
    })
    await POST(request)

    expect(mockProcessContent).toHaveBeenCalledWith(
      expect.objectContaining({
        forceRegenerate: true,
        skipScraping: true,
        contentId: VALID_UUID,
        userId: mockUser.id,
      })
    )
  })

  // ---------------------------------------------------------------------------
  // 200-status blocked content (partial success path)
  // ---------------------------------------------------------------------------

  it("returns 200 with content_blocked=true when content is blocked at 200 status", async () => {
    mockProcessContent.mockRejectedValue(
      new ProcessContentError("Content blocked by safety filters", 200)
    )

    const request = createRequest({ content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.content_blocked).toBe(true)
    expect(body.success).toBe(false)
  })
})

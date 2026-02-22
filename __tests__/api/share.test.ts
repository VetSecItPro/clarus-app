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
const mockUser = {
  id: "user-share-123",
  email: "share@clarusapp.io",
  user_metadata: { display_name: "Share User" },
}

// Mutable supabase client for verifyContentOwnership
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
  verifyContentOwnership: vi.fn(async (supabase: unknown, userId: string, contentId: string) => {
    // Delegate to the mockVerifyOwnership function so tests can override it
    return mockVerifyOwnership(supabase, userId, contentId)
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

// verifyContentOwnership helper — mutable so tests can override
let mockVerifyOwnership = vi.fn(async (_supabase: unknown, _userId: string, _contentId: string) => ({
  owned: true,
  content: { id: "550e8400-e29b-41d4-a716-446655440000", user_id: "user-share-123" },
}))

// Email sending — success by default
const mockSendShareAnalysisEmail = vi.fn()
vi.mock("@/lib/email", () => ({
  sendShareAnalysisEmail: (...args: unknown[]) => mockSendShareAnalysisEmail(...args),
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

import { POST } from "@/app/api/share/route"

// =============================================================================
// Helpers
// =============================================================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"
const VALID_URL = "https://example.com/article"

function createRequest(body: unknown) {
  return new Request("https://clarusapp.io/api/share", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/share", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockSendShareAnalysisEmail.mockResolvedValue({ success: true, messageId: "msg-abc-123" })
    mockVerifyOwnership = vi.fn(async () => ({
      owned: true,
      content: { id: VALID_UUID, user_id: mockUser.id },
    }))
    mockSupabase = {}
    // Set RESEND_API_KEY so the route doesn't short-circuit on missing env
    process.env.RESEND_API_KEY = "test-resend-key"
  })

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 60000 })

    const request = createRequest({ to: "recipient@example.com", content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const request = createRequest({ to: "recipient@example.com", content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Environment configuration
  // ---------------------------------------------------------------------------

  it("returns 500 when RESEND_API_KEY is not configured", async () => {
    delete process.env.RESEND_API_KEY

    const request = createRequest({ to: "recipient@example.com", content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/email service is not configured/i)

    process.env.RESEND_API_KEY = "test-resend-key"
  })

  // ---------------------------------------------------------------------------
  // Request body validation
  // ---------------------------------------------------------------------------

  it("returns 400 when to field is missing", async () => {
    const request = createRequest({ content_id: VALID_UUID, contentTitle: "Test" })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when to field is not a valid email", async () => {
    const request = createRequest({ to: "not-an-email", content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when both content_id and contentUrl are absent", async () => {
    const request = createRequest({ to: "recipient@example.com", contentTitle: "Test Article" })
    const response = await POST(request)
    const body = await response.json()

    // The route rejects: "Either content_id or contentUrl is required"
    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Ownership verification
  // ---------------------------------------------------------------------------

  it("returns 404 when content_id does not belong to user", async () => {
    const { NextResponse } = await import("next/server")
    mockVerifyOwnership = vi.fn(async () => ({
      owned: false,
      response: NextResponse.json({ error: "Content not found" }, { status: 404 }),
    }))

    const request = createRequest({ to: "recipient@example.com", content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toMatch(/content not found/i)
  })

  it("returns 403 when content_id belongs to a different user", async () => {
    const { NextResponse } = await import("next/server")
    mockVerifyOwnership = vi.fn(async () => ({
      owned: false,
      response: NextResponse.json({ error: "Access denied" }, { status: 403 }),
    }))

    const request = createRequest({ to: "recipient@example.com", content_id: VALID_UUID })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/access denied/i)
  })

  // ---------------------------------------------------------------------------
  // 200 success cases
  // ---------------------------------------------------------------------------

  it("returns 200 with messageId when sharing by content_id", async () => {
    const request = createRequest({
      to: "friend@example.com",
      content_id: VALID_UUID,
      contentTitle: "Test Article",
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.id).toBe("msg-abc-123")
  })

  it("returns 200 when sharing by contentUrl without content_id", async () => {
    const request = createRequest({
      to: "friend@example.com",
      contentUrl: VALID_URL,
      contentTitle: "External Article",
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("calls sendShareAnalysisEmail with correct sender info", async () => {
    const request = createRequest({
      to: "friend@example.com",
      content_id: VALID_UUID,
      contentTitle: "My Article",
      personalMessage: "Check this out!",
    })
    await POST(request)

    expect(mockSendShareAnalysisEmail).toHaveBeenCalledWith(
      "friend@example.com",
      "Share User",        // display_name from user_metadata
      mockUser.email,
      undefined,           // recipientName
      "My Article",
      expect.any(String),  // finalContentUrl
      expect.any(String),  // analysisUrl
      "Check this out!"
    )
  })

  it("uses email prefix as sender name when display_name is missing", async () => {
    mockAuthSuccess = true
    // Override auth to return user without display_name
    const { authenticateRequest } = await import("@/lib/auth")
    vi.mocked(authenticateRequest).mockResolvedValueOnce({
      success: true,
      user: { id: "user-share-123", email: "noname@clarusapp.io", user_metadata: {} } as Parameters<typeof authenticateRequest>[0] extends never ? never : Awaited<ReturnType<typeof authenticateRequest>> extends { user: infer U } ? U : never,
      supabase: mockSupabase as Parameters<typeof authenticateRequest>[0] extends never ? never : Awaited<ReturnType<typeof authenticateRequest>> extends { supabase: infer S } ? S : never,
    } as Awaited<ReturnType<typeof authenticateRequest>>)

    const request = createRequest({
      to: "friend@example.com",
      content_id: VALID_UUID,
      contentTitle: "Article",
    })
    await POST(request)

    expect(mockSendShareAnalysisEmail).toHaveBeenCalledWith(
      "friend@example.com",
      "noname",           // email prefix used as fallback
      "noname@clarusapp.io",
      undefined,
      "Article",
      expect.any(String),
      expect.any(String),
      undefined
    )
  })

  // ---------------------------------------------------------------------------
  // Email send failure
  // ---------------------------------------------------------------------------

  it("returns 500 when sendShareAnalysisEmail fails", async () => {
    mockSendShareAnalysisEmail.mockResolvedValue({ success: false, error: "Resend API error" })

    const request = createRequest({
      to: "friend@example.com",
      content_id: VALID_UUID,
      contentTitle: "Article",
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to send email/i)
  })

  it("returns 500 when sendShareAnalysisEmail throws an unexpected error", async () => {
    mockSendShareAnalysisEmail.mockRejectedValue(new Error("Network failure"))

    const request = createRequest({
      to: "friend@example.com",
      content_id: VALID_UUID,
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to send email/i)
  })

  // ---------------------------------------------------------------------------
  // analysisUrl construction
  // ---------------------------------------------------------------------------

  it("constructs analysisUrl from content_id when both content_id and contentUrl are provided", async () => {
    const request = createRequest({
      to: "friend@example.com",
      content_id: VALID_UUID,
      contentUrl: VALID_URL,
      contentTitle: "Article",
    })
    await POST(request)

    expect(mockSendShareAnalysisEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      undefined,
      "Article",
      VALID_URL,                                     // finalContentUrl = contentUrl when both provided
      `https://clarusapp.io/item/${VALID_UUID}`,     // analysisUrl built from content_id
      undefined
    )
  })
})

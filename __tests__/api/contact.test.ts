import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

// Rate limiting — always allow by default
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Supabase createClient mock — used directly in this route (not via lib/auth)
const mockInsertChain = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn(),
}
const mockUpdateChain = {
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockResolvedValue({ error: null }),
}

const mockFrom = vi.fn()

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}))

// Email — controllable per test
const mockSendContactFormEmail = vi.fn()
vi.mock("@/lib/email", () => ({
  sendContactFormEmail: (...args: unknown[]) => mockSendContactFormEmail(...args),
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

import { POST } from "@/app/api/contact/route"

// =============================================================================
// Helpers
// =============================================================================

const VALID_SUBMISSION = {
  name: "Alice Smith",
  email: "alice@example.com",
  subject: "Product question",
  message: "I have a question about your pricing plans.",
}

function createRequest(body: unknown, ip = "1.2.3.4") {
  return new Request("https://clarusapp.io/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })

    // Default: DB insert succeeds
    mockInsertChain.single.mockResolvedValue({ data: { id: "sub-001" }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === "contact_submissions") {
        return {
          insert: vi.fn().mockReturnValue(mockInsertChain),
          update: vi.fn().mockReturnValue(mockUpdateChain),
        }
      }
      return { insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis() }
    })

    // Default: email sends successfully
    mockSendContactFormEmail.mockResolvedValue({ success: true, messageId: "msg-abc" })

    // Set required env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
  })

  // ---------------------------------------------------------------------------
  // Rate limiting — 429
  // ---------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 3600000 })

    const req = createRequest(VALID_SUBMISSION)
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many submissions/i)
  })

  it("uses the client IP for rate limit key", async () => {
    const req = createRequest(VALID_SUBMISSION, "10.20.30.40")
    await POST(req)

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "contact:10.20.30.40",
      5,
      3600000
    )
  })

  it("uses 'unknown' as IP key when no forwarded-for header is present", async () => {
    const req = new Request("https://clarusapp.io/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_SUBMISSION),
    })
    await POST(req)

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "contact:unknown",
      5,
      3600000
    )
  })

  // ---------------------------------------------------------------------------
  // Request body validation — 400
  // ---------------------------------------------------------------------------

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("https://clarusapp.io/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
      body: "not valid json{{",
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid JSON")
  })

  it("returns 400 when name is missing", async () => {
    const req = createRequest({ ...VALID_SUBMISSION, name: undefined })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when email is invalid", async () => {
    const req = createRequest({ ...VALID_SUBMISSION, email: "not-an-email" })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when subject is missing", async () => {
    const req = createRequest({ ...VALID_SUBMISSION, subject: undefined })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when message is too short (min 10 chars)", async () => {
    const req = createRequest({ ...VALID_SUBMISSION, message: "Hi" })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it("returns 400 when message is too long (max 5000 chars)", async () => {
    const req = createRequest({ ...VALID_SUBMISSION, message: "x".repeat(5001) })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Database errors — 500
  // ---------------------------------------------------------------------------

  it("returns 500 when database insert fails", async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        ...mockInsertChain,
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "Insert failed" } }),
      }),
    })

    const req = createRequest(VALID_SUBMISSION)
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to process submission/i)
  })

  // ---------------------------------------------------------------------------
  // 200 success — shape validation
  // ---------------------------------------------------------------------------

  it("returns 200 with success:true when submission is processed", async () => {
    const req = createRequest(VALID_SUBMISSION)
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("returns 200 even when email sending fails (submission logged for retry)", async () => {
    mockSendContactFormEmail.mockResolvedValue({
      success: false,
      error: "SMTP connection refused",
    })

    const req = createRequest(VALID_SUBMISSION)
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("uses the first IP from x-forwarded-for when multiple are present", async () => {
    const req = createRequest(VALID_SUBMISSION, "5.6.7.8, 9.10.11.12")
    await POST(req)

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "contact:5.6.7.8",
      5,
      3600000
    )
  })

  it("calls sendContactFormEmail with correct parameters", async () => {
    const req = createRequest(VALID_SUBMISSION)
    await POST(req)

    expect(mockSendContactFormEmail).toHaveBeenCalledWith(
      VALID_SUBMISSION.name,
      VALID_SUBMISSION.email,
      VALID_SUBMISSION.subject,
      VALID_SUBMISSION.message
    )
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — declared before imports
// =============================================================================

// Rate limiting — always allow by default
const mockCheckRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Auth — controllable per test
let mockAuthSuccess = true
const mockUser = { id: "user-pdf-123", email: "pdf@clarusapp.io" }

// Supabase client used by the route for library count queries
const mockAuthSupabaseFrom = vi.fn()
const mockAuthSupabase = {
  from: mockAuthSupabaseFrom,
}

vi.mock("@/lib/auth", () => ({
  authenticateRequest: vi.fn(async () => {
    if (!mockAuthSuccess) {
      const { NextResponse } = await import("next/server")
      return {
        success: false,
        response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      }
    }
    return { success: true, user: mockUser, supabase: mockAuthSupabase }
  }),
}))

// getUserTierAndAdmin
const mockGetUserTierAndAdmin = vi.fn()
vi.mock("@/lib/usage", () => ({
  getUserTierAndAdmin: (...args: unknown[]) => mockGetUserTierAndAdmin(...args),
}))

// getEffectiveLimits — use real implementation
vi.mock("@/lib/tier-limits", async () => {
  const real = await vi.importActual<typeof import("@/lib/tier-limits")>("@/lib/tier-limits")
  return { ...real }
})

// processContent — mocked to avoid real AI pipeline
const mockProcessContent = vi.fn()
vi.mock("@/lib/process-content", async () => {
  const { ProcessContentError } = await import("@/lib/pipeline/types")
  return {
    processContent: (...args: unknown[]) => mockProcessContent(...args),
    ProcessContentError,
  }
})

// Supabase JS client (createClient used directly in the route)
const mockSingle = vi.fn()
const mockInsertChain = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: mockSingle,
}
const mockAdminClient = {
  from: vi.fn(() => mockInsertChain),
}
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockAdminClient),
}))

// pdf-parse — dynamically imported inside the route via `await import("pdf-parse")`
// Must use a proper class-style constructor that returns the expected object shape.
const mockGetText = vi.fn()
const mockDestroy = vi.fn()
vi.mock("pdf-parse", () => {
  class PDFParseMock {
    constructor(_opts: unknown) {}
    getText() {
      return mockGetText()
    }
    destroy() {
      return mockDestroy()
    }
  }
  return { PDFParse: PDFParseMock }
})

// logger — silence noise
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// =============================================================================
// Import handler AFTER mocks
// =============================================================================

import { NextRequest } from "next/server"
import { POST } from "@/app/api/process-pdf/route"

// =============================================================================
// Helpers
// =============================================================================

// Create a valid PDF buffer with %PDF- magic bytes
function makePdfBuffer(bodyText = "A".repeat(300)): Buffer {
  const header = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]) // %PDF-
  const body = Buffer.from(bodyText, "utf-8")
  return Buffer.concat([header, body])
}

function createFormDataRequest(
  fileContent: Buffer,
  fileName: string,
  mimeType: string,
  extra: Record<string, string> = {}
): NextRequest {
  const formData = new FormData()
  const blob = new Blob([fileContent], { type: mimeType })
  formData.append("file", blob, fileName)
  Object.entries(extra).forEach(([k, v]) => formData.append(k, v))

  return new NextRequest("https://clarusapp.io/api/process-pdf", {
    method: "POST",
    body: formData,
  })
}

// Build a thenable chain that resolves with a `count` for library/bookmark queries
function buildCountChain(count: number) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ count, error: null }).then(resolve)
  return chain
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/process-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess = true

    mockCheckRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 })
    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "pro", isAdmin: false })
    mockProcessContent.mockResolvedValue({ success: true })
    mockDestroy.mockResolvedValue(undefined)

    // Library count is well under the pro limit (5000)
    mockAuthSupabaseFrom.mockReturnValue(buildCountChain(5))

    // pdf-parse returns enough text by default (> 100 chars minimum)
    mockGetText.mockResolvedValue({ text: "A".repeat(300), pages: [] })

    // Admin insert chain defaults
    mockInsertChain.insert.mockReturnThis()
    mockInsertChain.select.mockReturnThis()
    mockSingle.mockResolvedValue({
      data: { id: "content-pdf-uuid-123" },
      error: null,
    })
    mockAdminClient.from.mockReturnValue(mockInsertChain)
  })

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, resetIn: 3600000 })

    const req = createFormDataRequest(makePdfBuffer(), "test.pdf", "application/pdf")
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatch(/too many uploads/i)
  })

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    mockAuthSuccess = false

    const req = createFormDataRequest(makePdfBuffer(), "test.pdf", "application/pdf")
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // -------------------------------------------------------------------------
  // Library limit
  // -------------------------------------------------------------------------

  it("returns 403 when user has reached their library limit", async () => {
    // Pro tier library limit is 5000; count equals limit
    mockGetUserTierAndAdmin.mockResolvedValue({ tier: "pro", isAdmin: false })
    mockAuthSupabaseFrom.mockReturnValue(buildCountChain(5000))

    const req = createFormDataRequest(makePdfBuffer(), "test.pdf", "application/pdf")
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatch(/library limit reached/i)
  })

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  it("returns 400 when no file is provided", async () => {
    const formData = new FormData()
    const req = new NextRequest("https://clarusapp.io/api/process-pdf", {
      method: "POST",
      body: formData,
    })

    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/no file provided/i)
  })

  it("returns 400 for an empty file", async () => {
    const emptyBuffer = Buffer.alloc(0)
    const req = createFormDataRequest(emptyBuffer, "empty.pdf", "application/pdf")
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/file is empty/i)
  })

  it("returns 400 for an unsupported MIME type", async () => {
    const req = createFormDataRequest(
      Buffer.from("some image data"),
      "photo.png",
      "image/png"
    )
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/unsupported file type/i)
  })

  it("returns 400 when PDF magic bytes are invalid", async () => {
    // A buffer that is big enough but does NOT start with %PDF-
    const badBuffer = Buffer.alloc(10, 0x00)
    const req = createFormDataRequest(badBuffer, "fake.pdf", "application/pdf")
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/invalid pdf/i)
  })

  it("returns 400 when DOCX magic bytes are invalid", async () => {
    // A DOCX-typed file that is NOT a ZIP (PK header)
    const badBuffer = Buffer.alloc(10, 0xFF)
    const req = createFormDataRequest(
      badBuffer,
      "fake.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/invalid office document/i)
  })

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------

  it("returns 200 with contentId and title on successful PDF upload", async () => {
    const req = createFormDataRequest(makePdfBuffer(), "my-report.pdf", "application/pdf")
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.contentId).toBe("content-pdf-uuid-123")
    expect(body.title).toBe("my-report")
  })

  it("calls processContent after saving the content record", async () => {
    const req = createFormDataRequest(makePdfBuffer(), "test.pdf", "application/pdf")
    await POST(req)

    expect(mockProcessContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId: "content-pdf-uuid-123",
        userId: mockUser.id,
        skipScraping: true,
      })
    )
  })

  it("still returns 200 when processContent throws (content is saved)", async () => {
    mockProcessContent.mockRejectedValue(new Error("AI pipeline failure"))

    const req = createFormDataRequest(makePdfBuffer(), "test.pdf", "application/pdf")
    const response = await POST(req)
    const body = await response.json()

    // Route catches processContent errors and does NOT fail the upload
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  // -------------------------------------------------------------------------
  // DB error
  // -------------------------------------------------------------------------

  it("returns 500 when the content insert fails", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "DB write error" },
    })

    const req = createFormDataRequest(makePdfBuffer(), "test.pdf", "application/pdf")
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to save pdf/i)
  })
})

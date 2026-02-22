import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Environment variables — set before any module reads process.env
// =============================================================================

// These must be set at module evaluation time (not in beforeAll/beforeEach)
// because the route reads them at the module's top level when imported.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
process.env.OPENROUTER_API_KEY = "test-openrouter-key"
// Deliberately leave TAVILY_API_KEY unset so tools are disabled in tests

// =============================================================================
// Module mocks — declared before imports (Vitest hoists vi.mock calls)
// =============================================================================

const mockUser = { id: "user-123", email: "test@test.com" }
let mockAuthSuccess = true

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

// ---------------------------------------------------------------------------
// Rate limit mock — allow all requests by default
// ---------------------------------------------------------------------------
const mockCheckRateLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 99, resetIn: 60000 })
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// ---------------------------------------------------------------------------
// Usage mock — allow by default; override per test to simulate limit exceeded
// ---------------------------------------------------------------------------
const mockEnforceAndIncrementUsage = vi.fn(async () => ({
  allowed: true,
  tier: "starter" as const,
  newCount: 1,
  limit: 300,
}))
vi.mock("@/lib/usage", () => ({
  enforceAndIncrementUsage: (...args: unknown[]) => mockEnforceAndIncrementUsage(...args),
}))

// ---------------------------------------------------------------------------
// Tier-limits mock
// ---------------------------------------------------------------------------
vi.mock("@/lib/tier-limits", () => ({
  getEffectiveLimits: vi.fn(() => ({ chatMessagesPerContent: 25 })),
  getLimitForField: vi.fn(() => 300),
  getCurrentPeriod: vi.fn(() => "2026-02"),
  normalizeTier: vi.fn((tier: string) => tier ?? "free"),
}))

// ---------------------------------------------------------------------------
// Prompt-sanitizer / validation / logger mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/prompt-sanitizer", () => ({
  sanitizeForPrompt: vi.fn((text: string) => text),
  sanitizeChatMessage: vi.fn((text: string) => text),
  wrapUserContent: vi.fn((text: string) => text),
  INSTRUCTION_ANCHOR: "<!-- /INSTRUCTIONS -->",
  detectOutputLeakage: vi.fn(() => []),
}))

vi.mock("@/lib/validation", () => ({
  validateContentId: vi.fn((id: string) => {
    if (!id || id === "invalid") {
      return { isValid: false, error: "Invalid content ID format" }
    }
    return { isValid: true, sanitized: id }
  }),
  validateChatMessage: vi.fn((text: string) => ({ isValid: true, sanitized: text })),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// AI SDK mocks — streamText returns a fake streaming response object
// ---------------------------------------------------------------------------

const mockStreamText = vi.fn()
const mockToUIMessageStreamResponse = vi.fn(() => new Response("streamed", { status: 200 }))

vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => {
    mockStreamText(...args)
    return {
      toUIMessageStreamResponse: mockToUIMessageStreamResponse,
    }
  },
  convertToModelMessages: vi.fn((msgs: unknown[]) => msgs),
  consumeStream: vi.fn(),
  tool: vi.fn((config: unknown) => config),
  stepCountIs: vi.fn((n: number) => n),
}))

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn(() => (modelName: string) => ({ modelId: modelName })),
}))

// ---------------------------------------------------------------------------
// Supabase client mock
//
// The route calls createClient() inside POST() and then performs chained
// Supabase queries. We mock the entire @supabase/supabase-js module so that
// createClient() returns a controlled fake that reads from mutable variables.
//
// Key tables queried by the route:
//   content          — fetch article data (first messages: with full_text)
//   chat_threads     — look up existing thread for this content
//   users            — check is_admin flag
//   chat_messages    — count user messages in thread (per-content limit)
//   summaries        — fetch summary data to include in system prompt
//   active_chat_prompt — fetch model config (temperature, tokens, model name)
// ---------------------------------------------------------------------------

// Mutable state — reset to happy-path defaults in beforeEach
let mockContentData: Record<string, unknown> | null = null
let mockContentError: Record<string, unknown> | null = null
let mockThreadData: { id: string } | null = null
let mockAdminCheckData: { is_admin: boolean } | null = { is_admin: false }
let mockMessageCount = 0
let mockSummaryData: Record<string, unknown> | null = null
let mockPromptData: Record<string, unknown> | null = null

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      switch (table) {
        case "content":
          return {
            select: (_fields: string) => ({
              eq: (_field: string, _value: unknown) => ({
                single: () => ({ data: mockContentData, error: mockContentError }),
              }),
            }),
          }

        case "chat_threads":
          return {
            select: (_fields: string) => ({
              eq: (_f: string, _v: unknown) => ({
                eq: (_f2: string, _v2: unknown) => ({
                  maybeSingle: () => ({ data: mockThreadData, error: null }),
                }),
              }),
            }),
          }

        case "users":
          return {
            select: (_fields: string) => ({
              eq: (_f: string, _v: unknown) => ({
                single: () => ({ data: mockAdminCheckData, error: null }),
              }),
            }),
          }

        case "chat_messages":
          // Route uses: .select("*", { count: "exact", head: true }).eq(...).eq(...)
          // The result must be awaitable with { count, error }
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  // Return a thenable so the route can await it
                  then: (resolve: (v: { count: number; error: null }) => unknown) =>
                    Promise.resolve({ count: mockMessageCount, error: null }).then(resolve),
                }),
              }),
            }),
          }

        case "summaries":
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () => ({ data: mockSummaryData, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }

        case "active_chat_prompt":
          return {
            select: () => ({
              eq: () => ({
                single: () => ({
                  data: mockPromptData,
                  error: mockPromptData ? null : { message: "Row not found" },
                }),
              }),
            }),
          }

        default:
          return {
            select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
          }
      }
    },
    // rpc is called by enforceAndIncrementUsage (mocked separately)
    rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "rpc not available in tests" } }),
  }),
}))

// =============================================================================
// Import the handler AFTER all mocks are defined
// =============================================================================

import { POST } from "@/app/api/chat/route"

// =============================================================================
// Test helpers
// =============================================================================

const VALID_CONTENT_ID = "550e8400-e29b-41d4-a716-446655440000"

function makeMessages(text = "What is this article about?") {
  return [
    {
      id: "msg-1",
      role: "user" as const,
      content: text,
      parts: [{ type: "text", text }],
    },
  ]
}

function createChatRequest(body: unknown) {
  return new Request("https://clarusapp.io/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function defaultContent(): Record<string, unknown> {
  return {
    title: "Test Article",
    url: "https://example.com/test",
    type: "article",
    author: "John Doe",
    user_id: "user-123",
    detected_tone: "neutral",
    full_text: "This is a test article with full content.",
  }
}

function defaultPromptData(): Record<string, unknown> {
  return {
    temperature: 0.7,
    top_p: null,
    max_tokens: 1024,
    model_name: "google/gemini-2.5-flash",
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset state to happy-path defaults
    mockAuthSuccess = true
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetIn: 60000 })
    mockEnforceAndIncrementUsage.mockResolvedValue({ allowed: true, tier: "starter", newCount: 1, limit: 300 })

    mockContentData = defaultContent()
    mockContentError = null
    mockThreadData = null
    mockAdminCheckData = { is_admin: false }
    mockMessageCount = 0
    mockSummaryData = null
    mockPromptData = defaultPromptData()

    mockStreamText.mockClear()
    mockToUIMessageStreamResponse.mockReturnValue(new Response("streamed", { status: 200 }))
  })

  // -------------------------------------------------------------------------
  // 401 — Authentication
  // -------------------------------------------------------------------------

  it("returns 401 when not authenticated", async () => {
    mockAuthSuccess = false

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // -------------------------------------------------------------------------
  // 400 — Missing / invalid required fields
  // -------------------------------------------------------------------------

  it("returns 400 when contentId is missing", async () => {
    const request = createChatRequest({
      messages: makeMessages(),
      // contentId intentionally omitted — will be undefined
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeTruthy()
  })

  it("returns 400 when contentId is invalid format", async () => {
    const request = createChatRequest({
      contentId: "invalid",
      messages: makeMessages(),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain("Invalid content ID")
  })

  it("returns 400 when messages array is empty", async () => {
    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: [],
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Messages are required.")
  })

  it("returns 400 when messages is not an array", async () => {
    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: "this should be an array",
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Messages are required.")
  })

  it("returns 400 when the user message exceeds 2000 characters", async () => {
    const longText = "x".repeat(2001)
    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(longText),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain("Message too long")
    expect(body.error).toContain("2000")
  })

  // -------------------------------------------------------------------------
  // 404 — Content not found
  // -------------------------------------------------------------------------

  it("returns 404 when content record does not exist", async () => {
    mockContentData = null
    mockContentError = { code: "PGRST116", message: "Row not found" }

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe("Content not found")
  })

  // -------------------------------------------------------------------------
  // 403 — Content ownership
  // -------------------------------------------------------------------------

  it("returns 403 when content is owned by a different user", async () => {
    mockContentData = {
      ...defaultContent(),
      user_id: "different-user-999",
    }

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe("Access denied")
  })

  // -------------------------------------------------------------------------
  // 403 — Monthly chat usage limit
  // -------------------------------------------------------------------------

  it("returns 403 with upgrade_required when monthly chat limit is exhausted", async () => {
    mockEnforceAndIncrementUsage.mockResolvedValueOnce({
      allowed: false,
      tier: "free" as const,
      limit: 50,
    })

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.upgrade_required).toBe(true)
    expect(body.error).toContain("Monthly chat message limit reached")
    expect(body.tier).toBe("free")
  })

  // -------------------------------------------------------------------------
  // 403 — Per-content message limit
  // -------------------------------------------------------------------------

  it("returns 403 with upgrade_required when per-content message cap is hit", async () => {
    // Simulate an existing thread with messages at the limit (25 for free/starter)
    mockThreadData = { id: "thread-existing-abc" }
    mockMessageCount = 25

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.upgrade_required).toBe(true)
    expect(body.error).toContain("Message limit reached for this content")
  })

  // -------------------------------------------------------------------------
  // 500 — Missing active_chat_prompt
  // -------------------------------------------------------------------------

  it("returns 500 when active_chat_prompt row is missing", async () => {
    mockPromptData = null

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe("Could not load chat prompt.")
  })

  // -------------------------------------------------------------------------
  // 429 — Rate limiting
  // -------------------------------------------------------------------------

  it("returns 429 when the per-minute IP rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetIn: 30000 })

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toContain("Too many requests")
  })

  it("returns 429 when the hourly IP rate limit is exceeded", async () => {
    // minute limit passes, hour limit fails
    mockCheckRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 10, resetIn: 60000 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, resetIn: 1800000 })

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toContain("Hourly limit reached")
  })

  // -------------------------------------------------------------------------
  // 200 — Happy path with mocked AI streaming response
  // -------------------------------------------------------------------------

  it("returns 200 for a valid authenticated request with correct content", async () => {
    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages("What are the main points of this article?"),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])

    expect(response.status).toBe(200)
    expect(mockToUIMessageStreamResponse).toHaveBeenCalledOnce()
  })

  it("calls streamText with a system prompt containing Clarus branding and the content title", async () => {
    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages("Summarize the key points"),
    })
    await POST(request as unknown as Parameters<typeof POST>[0])

    expect(mockStreamText).toHaveBeenCalledOnce()
    const callArgs = mockStreamText.mock.calls[0][0] as { system: string; messages: unknown[] }
    expect(callArgs.system).toContain("Clarus")
    expect(callArgs.system).toContain("Test Article")
    expect(Array.isArray(callArgs.messages)).toBe(true)
  })

  it("uses the model name from the active_chat_prompt DB row", async () => {
    mockPromptData = {
      temperature: 0.5,
      top_p: 0.9,
      max_tokens: 512,
      model_name: "anthropic/claude-3-haiku",
    }

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    await POST(request as unknown as Parameters<typeof POST>[0])

    expect(mockStreamText).toHaveBeenCalledOnce()
    const callArgs = mockStreamText.mock.calls[0][0] as {
      model: { modelId: string }
      temperature: number
    }
    expect(callArgs.model).toEqual({ modelId: "anthropic/claude-3-haiku" })
    expect(callArgs.temperature).toBe(0.5)
  })

  it("caps maxOutputTokens at 1024 even when DB prompt specifies a higher value", async () => {
    mockPromptData = {
      temperature: 0.7,
      top_p: null,
      max_tokens: 9999,
      model_name: "google/gemini-2.5-flash",
    }

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    await POST(request as unknown as Parameters<typeof POST>[0])

    expect(mockStreamText).toHaveBeenCalledOnce()
    const callArgs = mockStreamText.mock.calls[0][0] as { maxOutputTokens: number }
    expect(callArgs.maxOutputTokens).toBeLessThanOrEqual(1024)
  })

  it("injects summary data into the system prompt when summaries exist", async () => {
    mockSummaryData = {
      brief_overview: "A comprehensive overview of the test content",
      mid_length_summary: "Key takeaways from the test article",
      detailed_summary: null,
      triage: null,
      truth_check: null,
      action_items: null,
    }

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    await POST(request as unknown as Parameters<typeof POST>[0])

    expect(mockStreamText).toHaveBeenCalledOnce()
    const callArgs = mockStreamText.mock.calls[0][0] as { system: string }
    expect(callArgs.system).toContain("A comprehensive overview of the test content")
  })

  it("allows chat when an existing thread has messages below the per-content limit", async () => {
    mockThreadData = { id: "thread-partial" }
    mockMessageCount = 10 // 10 < 25 limit → should be allowed

    const request = createChatRequest({
      contentId: VALID_CONTENT_ID,
      messages: makeMessages(),
    })
    const response = await POST(request as unknown as Parameters<typeof POST>[0])

    expect(response.status).toBe(200)
  })
})

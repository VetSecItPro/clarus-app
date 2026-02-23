/**
 * Integration tests for POST /api/deepgram-webhook
 *
 * The route reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * DEEPGRAM_WEBHOOK_TOKEN as module-level constants at import time.
 * All tests therefore use vi.resetModules() + dynamic import so each test
 * gets a fresh module instance with the correct env vars already in place.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

// =============================================================================
// Module mocks — declared before all imports (hoisted by Vitest)
// =============================================================================

// --- Supabase ----------------------------------------------------------------

/**
 * Controls what the content table's .single() returns.
 * First call = primary lookup (by podcast_transcript_id).
 * Subsequent calls = fallback lookup (by id / extra.content_id).
 */
let mockContentSequence: Array<{
  id: string
  user_id: string | null
  url: string
  type: string | null
} | null> = [
  {
    id: "content-abc",
    user_id: "user-123",
    url: "https://example.com/podcast.mp3",
    type: "podcast",
  },
]
let contentCallCount = 0

const mockSupabaseFrom = vi.fn()
const mockSupabaseUpdate = vi.fn()
const mockSupabaseUpsert = vi.fn()
const mockSupabaseEq = vi.fn()

function makeContentQueryBuilder() {
  return {
    update: (data: unknown) => {
      mockSupabaseUpdate(data)
      return {
        eq: (field: string, value: string) => {
          mockSupabaseEq(field, value)
          return { error: null }
        },
      }
    },
    select: (_fields: string) => ({
      eq: (_field: string, _value: string) => ({
        single: () => {
          const result = mockContentSequence[contentCallCount] ?? null
          contentCallCount++
          return result
            ? { data: result, error: null }
            : { data: null, error: { code: "PGRST116" } }
        },
      }),
    }),
  }
}

function makeSummariesQueryBuilder() {
  return {
    upsert: (data: unknown, opts?: unknown) => {
      mockSupabaseUpsert(data, opts)
      return { error: null }
    },
  }
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      mockSupabaseFrom(table)
      if (table === "content") return makeContentQueryBuilder()
      return makeSummariesQueryBuilder()
    },
  }),
}))

// --- lib/deepgram ------------------------------------------------------------

const mockFormatTranscript = vi.fn()

vi.mock("@/lib/deepgram", () => ({
  formatTranscript: (...args: unknown[]) => mockFormatTranscript(...args),
}))

// --- lib/api-usage -----------------------------------------------------------

const mockLogApiUsage = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/api-usage", () => ({
  logApiUsage: (...args: unknown[]) => mockLogApiUsage(...args),
}))

// --- lib/process-content -----------------------------------------------------

const mockProcessContent = vi.fn()

vi.mock("@/lib/process-content", () => {
  // Class must be defined inline — factory is hoisted before variable declarations
  class ProcessContentError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "ProcessContentError"
    }
  }
  return {
    processContent: (...args: unknown[]) => mockProcessContent(...args),
    ProcessContentError,
  }
})

// --- lib/logger --------------------------------------------------------------

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// =============================================================================
// Helpers
// =============================================================================

const WEBHOOK_TOKEN = "test-webhook-token"

/** Build a valid Deepgram callback payload with optional overrides. */
function buildPayload(overrides: {
  metadata?: Record<string, unknown>
  results?: Record<string, unknown>
  err_code?: number
  err_msg?: string
} = {}) {
  return {
    metadata: {
      request_id: "req-abc-123",
      duration: 3600,
      channels: 1,
      models: ["nova-3"],
      ...(overrides.metadata ?? {}),
    },
    results: {
      utterances: [
        { speaker: 0, transcript: "Hello world.", start: 0.0, end: 2.5 },
        { speaker: 1, transcript: "How are you?", start: 3.0, end: 5.0 },
      ],
      ...(overrides.results ?? {}),
    },
    ...(overrides.err_code !== undefined
      ? { err_code: overrides.err_code, err_msg: overrides.err_msg }
      : {}),
  }
}

/** Create a POST NextRequest compatible with Next.js route handlers. */
function createRequest(
  body: unknown,
  token: string = WEBHOOK_TOKEN,
  opts: { malformed?: boolean } = {},
) {
  const url = token
    ? `https://clarusapp.io/api/deepgram-webhook?token=${token}`
    : "https://clarusapp.io/api/deepgram-webhook"
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: opts.malformed ? "{ not valid json }" : JSON.stringify(body),
  })
}

/**
 * Set env vars, reset modules, and dynamically import a fresh route instance.
 * Returns the { POST, GET } exports from the route module.
 */
async function importRoute(envOverrides: Record<string, string | undefined> = {}) {
  const defaults = {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    DEEPGRAM_WEBHOOK_TOKEN: WEBHOOK_TOKEN,
  }
  const merged = { ...defaults, ...envOverrides }

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  vi.resetModules()
  return import("@/app/api/deepgram-webhook/route")
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks()
  contentCallCount = 0
  mockContentSequence = [
    {
      id: "content-abc",
      user_id: "user-123",
      url: "https://example.com/podcast.mp3",
      type: "podcast",
    },
  ]

  mockFormatTranscript.mockReturnValue({
    full_text: "[0:00] Speaker A: Hello world.\n\n[0:03] Speaker B: How are you?",
    duration_seconds: 3600,
    speaker_count: 2,
  })

  mockProcessContent.mockResolvedValue({ success: true })
})

afterEach(() => {
  // Restore env vars that may have been deleted
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
  process.env.DEEPGRAM_WEBHOOK_TOKEN = WEBHOOK_TOKEN
})

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

describe("GET /api/deepgram-webhook", () => {
  it("returns 200 health-check response", async () => {
    const { GET } = await importRoute()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe("ok")
    expect(body.endpoint).toBe("deepgram-webhook")
  })
})

// ---------------------------------------------------------------------------
// Missing configuration
// ---------------------------------------------------------------------------

describe("POST /api/deepgram-webhook — missing configuration", () => {
  it("returns 500 when Supabase URL is not configured", async () => {
    const { POST } = await importRoute({ NEXT_PUBLIC_SUPABASE_URL: undefined })
    const request = createRequest(buildPayload())
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe("Server configuration error")
  })

  it("returns 500 when Supabase service role key is not configured", async () => {
    const { POST } = await importRoute({ SUPABASE_SERVICE_ROLE_KEY: undefined })
    const request = createRequest(buildPayload())
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe("Server configuration error")
  })

  it("returns 503 when DEEPGRAM_WEBHOOK_TOKEN is not configured", async () => {
    const { POST } = await importRoute({ DEEPGRAM_WEBHOOK_TOKEN: undefined })
    const request = createRequest(buildPayload())
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toBe("Webhook not configured")
  })
})

// ---------------------------------------------------------------------------
// Token / signature verification
// ---------------------------------------------------------------------------

describe("POST /api/deepgram-webhook — auth", () => {
  it("returns 401 when webhook token is missing from query string", async () => {
    const { POST } = await importRoute()
    const url = "https://clarusapp.io/api/deepgram-webhook"
    const request = new NextRequest(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildPayload()),
    })
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 401 when webhook token does not match", async () => {
    const { POST } = await importRoute()
    const request = createRequest(buildPayload(), "wrong-token")
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Unauthorized")
  })
})

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

describe("POST /api/deepgram-webhook — request validation", () => {
  it("returns 400 when payload is malformed JSON", async () => {
    const { POST } = await importRoute()
    const request = createRequest({}, WEBHOOK_TOKEN, { malformed: true })
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid JSON body")
  })

  it("returns 400 when request_id is missing from metadata", async () => {
    const { POST } = await importRoute()
    const payload = {
      metadata: { duration: 100, channels: 1, models: [] },
      results: { utterances: [] },
    }
    const request = createRequest(payload)
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid request_id")
  })

  it("returns 400 when request_id exceeds 100 characters", async () => {
    const { POST } = await importRoute()
    const longId = "x".repeat(101)
    const payload = buildPayload({
      metadata: { request_id: longId, duration: 100, channels: 1, models: [] },
    })
    const request = createRequest(payload)
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid request_id")
  })
})

// ---------------------------------------------------------------------------
// Content lookup
// ---------------------------------------------------------------------------

describe("POST /api/deepgram-webhook — content lookup", () => {
  it("returns 404 when no content matches the request_id", async () => {
    mockContentSequence = [null, null] // both primary and fallback fail
    const { POST } = await importRoute()

    const request = createRequest(buildPayload())
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe("Unknown request_id")
  })

  it("returns 400 when matched content type is not podcast", async () => {
    mockContentSequence = [
      { id: "content-abc", user_id: "user-123", url: "https://example.com/article", type: "article" },
    ]
    const { POST } = await importRoute()

    const request = createRequest(buildPayload())
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Content is not a podcast")
  })

  it("falls back to extra.content_id when primary request_id lookup returns no content", async () => {
    // First call (primary) → not found; second call (fallback) → found
    mockContentSequence = [
      null,
      { id: "content-abc", user_id: "user-123", url: "https://example.com/podcast.mp3", type: "podcast" },
    ]
    const { POST } = await importRoute()

    const payload = buildPayload({
      metadata: {
        request_id: "req-abc-123",
        duration: 3600,
        channels: 1,
        models: ["nova-3"],
        extra: { content_id: "content-abc" },
      },
    })

    const request = createRequest(payload)
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.content_id).toBe("content-abc")
    expect(contentCallCount).toBe(2)
  })

  it("returns 404 when both primary and fallback lookups fail", async () => {
    mockContentSequence = [null, null]
    const { POST } = await importRoute()

    const payload = buildPayload({
      metadata: {
        request_id: "req-abc-123",
        duration: 3600,
        channels: 1,
        models: ["nova-3"],
        extra: { content_id: "unknown-content" },
      },
    })

    const request = createRequest(payload)
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe("Unknown request_id")
  })
})

// ---------------------------------------------------------------------------
// Deepgram error payload
// ---------------------------------------------------------------------------

describe("POST /api/deepgram-webhook — Deepgram errors", () => {
  it("returns 200 success:false and marks content as failed when Deepgram err_code present", async () => {
    const { POST } = await importRoute()
    const payload = buildPayload({ err_code: 400, err_msg: "Audio too large" })
    const request = createRequest(payload)
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(false)
    expect(body.message).toBe("Transcription failed")

    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ full_text: expect.stringContaining("PROCESSING_FAILED") }),
    )
  })

  it("returns 200 success:false when formatTranscript produces empty full_text", async () => {
    mockFormatTranscript.mockReturnValue({ full_text: "", duration_seconds: 0, speaker_count: 0 })

    const { POST } = await importRoute()
    const request = createRequest(buildPayload())
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(false)
    expect(body.message).toBe("Empty transcript")

    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ full_text: expect.stringContaining("TRANSCRIPTION_EMPTY") }),
    )
  })
})

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe("POST /api/deepgram-webhook — success", () => {
  it("returns 200 with success:true and analysisTriggered:true", async () => {
    const { POST } = await importRoute()
    const request = createRequest(buildPayload())
    const response = await POST(request as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.content_id).toBe("content-abc")
    expect(body.analysisTriggered).toBe(true)
  })

  it("saves transcript text and duration to the content row", async () => {
    const { POST } = await importRoute()
    const request = createRequest(buildPayload())
    await POST(request as Parameters<typeof POST>[0])

    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        full_text: expect.any(String),
        duration: expect.any(Number),
      }),
    )
  })

  it("calls logApiUsage with apiName=deepgram and operation=transcribe", async () => {
    const { POST } = await importRoute()
    const request = createRequest(buildPayload())
    await POST(request as Parameters<typeof POST>[0])

    expect(mockLogApiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        apiName: "deepgram",
        operation: "transcribe",
        status: "success",
        contentId: "content-abc",
        userId: "user-123",
      }),
    )
  })

  it("calls processContent with the correct contentId and userId", async () => {
    const { POST } = await importRoute()
    const request = createRequest(buildPayload())
    await POST(request as Parameters<typeof POST>[0])

    expect(mockProcessContent).toHaveBeenCalledWith(
      expect.objectContaining({ contentId: "content-abc", userId: "user-123" }),
    )
  })
})

// ---------------------------------------------------------------------------
// processContent retry behaviour
// ---------------------------------------------------------------------------

describe("POST /api/deepgram-webhook — processContent retries", () => {
  it("retries processContent up to 3 times and sets analysisTriggered:false when all fail", async () => {
    vi.useFakeTimers()
    mockProcessContent.mockRejectedValue(new Error("AI service unavailable"))

    const { POST } = await importRoute()
    const requestPromise = POST(createRequest(buildPayload()) as Parameters<typeof POST>[0])

    // Drain all timers for the exponential backoff (1s + 2s delays)
    await vi.runAllTimersAsync()
    const response = await requestPromise
    const body = await response.json()

    vi.useRealTimers()

    expect(response.status).toBe(200)
    expect(body.analysisTriggered).toBe(false)
    expect(mockProcessContent).toHaveBeenCalledTimes(3)

    expect(mockSupabaseUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: "error" }),
      expect.anything(),
    )
  })

  it("succeeds on second attempt when first processContent call throws", async () => {
    vi.useFakeTimers()
    mockProcessContent
      .mockRejectedValueOnce(new Error("Transient error"))
      .mockResolvedValue({ success: true })

    const { POST } = await importRoute()
    const requestPromise = POST(createRequest(buildPayload()) as Parameters<typeof POST>[0])
    await vi.runAllTimersAsync()
    const response = await requestPromise
    const body = await response.json()

    vi.useRealTimers()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.analysisTriggered).toBe(true)
    expect(mockProcessContent).toHaveBeenCalledTimes(2)
  })
})

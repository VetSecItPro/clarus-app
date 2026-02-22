import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

// Supabase admin client
const mockSupabaseFrom = vi.fn()
const mockSupabaseClient = {
  from: (...args: unknown[]) => mockSupabaseFrom(...args),
}
vi.mock("@/lib/auth", () => ({
  getAdminClient: vi.fn(() => mockSupabaseClient),
}))

// RSS parser
const mockFetchAndParseFeed = vi.fn()
const mockClassifyFeedError = vi.fn()
vi.mock("@/lib/rss-parser", () => ({
  fetchAndParseFeed: (...args: unknown[]) => mockFetchAndParseFeed(...args),
  classifyFeedError: (...args: unknown[]) => mockClassifyFeedError(...args),
}))

// Deepgram
const mockPollTranscriptionResult = vi.fn()
const mockFormatTranscript = vi.fn()
vi.mock("@/lib/deepgram", () => ({
  pollTranscriptionResult: (...args: unknown[]) => mockPollTranscriptionResult(...args),
  formatTranscript: (...args: unknown[]) => mockFormatTranscript(...args),
}))

// processContent
const mockProcessContent = vi.fn()
vi.mock("@/lib/process-content", () => ({
  processContent: (...args: unknown[]) => mockProcessContent(...args),
  ProcessContentError: class ProcessContentError extends Error {
    status: number
    constructor(message: string, status = 500) {
      super(message)
      this.status = status
    }
  },
}))

// logApiUsage
const mockLogApiUsage = vi.fn()
vi.mock("@/lib/api-usage", () => ({
  logApiUsage: (...args: unknown[]) => mockLogApiUsage(...args),
}))

// Feed encryption
const mockDecryptFeedCredential = vi.fn()
vi.mock("@/lib/feed-encryption", () => ({
  decryptFeedCredential: (...args: unknown[]) => mockDecryptFeedCredential(...args),
}))

// Email
const mockSendNewEpisodeEmail = vi.fn()
vi.mock("@/lib/email", () => ({
  sendNewEpisodeEmail: (...args: unknown[]) => mockSendNewEpisodeEmail(...args),
}))

// Logger — silence noise
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

import { GET } from "@/app/api/crons/check-podcast-feeds/route"

// =============================================================================
// Helpers
// =============================================================================

const CRON_SECRET = "test-cron-secret-abc123"

function createRequest(headers: Record<string, string> = {}) {
  return new Request("https://clarusapp.io/api/crons/check-podcast-feeds", {
    method: "GET",
    headers,
  })
}

function createAuthedRequest() {
  return createRequest({ authorization: `Bearer ${CRON_SECRET}` })
}

// =============================================================================
// Tests
// =============================================================================

describe("GET /api/crons/check-podcast-feeds", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET
    process.env.DEEPGRAM_API_KEY = "test-deepgram-key"

    // Default: classify feed errors as generic message
    mockClassifyFeedError.mockReturnValue("Feed unreachable")

    // Default: email sends succeed
    mockSendNewEpisodeEmail.mockResolvedValue({ success: true, messageId: "msg-001" })

    // Default: processContent succeeds
    mockProcessContent.mockResolvedValue({ success: true })

    // Default: logApiUsage is a no-op
    mockLogApiUsage.mockResolvedValue(undefined)

    // Default: decrypt returns a valid header
    mockDecryptFeedCredential.mockReturnValue("Basic dXNlcjpwYXNz")
  })

  // ---------------------------------------------------------------------------
  // Auth / secret verification
  // ---------------------------------------------------------------------------

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET

    const request = createRequest({ authorization: "Bearer anything" })
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/server misconfigured/i)
  })

  it("returns 401 when authorization header is missing", async () => {
    const request = createRequest()
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/unauthorized/i)
  })

  it("returns 401 when authorization header has wrong secret", async () => {
    const request = createRequest({ authorization: "Bearer wrong-secret" })
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/unauthorized/i)
  })

  it("returns 401 when authorization header uses wrong scheme", async () => {
    const request = createRequest({ authorization: CRON_SECRET })
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/unauthorized/i)
  })

  // ---------------------------------------------------------------------------
  // Database errors
  // ---------------------------------------------------------------------------

  it("returns 500 when fetching subscriptions fails", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: "DB connection failed" } }),
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to fetch subscriptions/i)
  })

  // ---------------------------------------------------------------------------
  // No subscriptions to process
  // ---------------------------------------------------------------------------

  it("returns 200 with zeros when there are no active subscriptions", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.checked).toBe(0)
    expect(body.newEpisodes).toBe(0)
    expect(body.emailsSent).toBe(0)
  })

  it("returns 200 with zeros when subscriptions exist but none are due", async () => {
    const recentlyChecked = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
    const subscriptions = [
      {
        id: "sub-1",
        user_id: "user-1",
        feed_url: "https://example.com/feed.xml",
        podcast_name: "Test Podcast",
        last_checked_at: recentlyChecked,
        check_frequency_hours: 24, // requires 24h gap, but only 1h has passed
        last_episode_date: null,
        consecutive_failures: 0,
        feed_auth_header_encrypted: null,
      },
    ]

    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.checked).toBe(0)
    expect(body.newEpisodes).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // Success: no new episodes
  // ---------------------------------------------------------------------------

  it("returns 200 with checked=1, newEpisodes=0 when subscription is due but feed has no new episodes", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() // 48h ago
    const subscriptions = [
      {
        id: "sub-1",
        user_id: "user-1",
        feed_url: "https://example.com/feed.xml",
        podcast_name: "Test Podcast",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_episode_date: new Date().toISOString(),
        consecutive_failures: 0,
        feed_auth_header_encrypted: null,
      },
    ]

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    const stuckContentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: updateMock,
        }
      }
      if (table === "content") return stuckContentQuery
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) }
    })

    // Feed returns episodes older than last_episode_date — none are "new"
    mockFetchAndParseFeed.mockResolvedValue({
      episodes: [
        {
          title: "Old Episode",
          url: "https://example.com/ep1.mp3",
          pubDate: new Date(Date.now() - 96 * 60 * 60 * 1000), // 4 days ago, older than last_episode_date
          durationSeconds: 3600,
          description: "Old",
        },
      ],
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.newEpisodes).toBe(0)
    expect(body.emailsSent).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // Success: new episodes found and inserted
  // ---------------------------------------------------------------------------

  it("returns 200 with correct counts when new episodes are found and emails sent", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "sub-1",
        user_id: "user-1",
        feed_url: "https://example.com/feed.xml",
        podcast_name: "Tech Talk",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_episode_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        consecutive_failures: 0,
        feed_auth_header_encrypted: null,
      },
    ]

    const insertedEpisodes = [
      { id: "ep-id-1", episode_title: "New Episode 1", episode_date: new Date().toISOString(), duration_seconds: 3600 },
    ]

    const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) }
    const inChain = { resolvedValue: { error: null } }
    const notifiedUpdateChain = { in: vi.fn().mockResolvedValue(inChain) }
    const upsertChain = {
      select: vi.fn().mockResolvedValue({ data: insertedEpisodes, error: null }),
    }
    const episodeUpdateChain = {
      in: vi.fn().mockResolvedValue({ error: null }),
    }
    const stuckContentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: vi.fn().mockReturnValue(updateChain),
        }
      }
      if (table === "podcast_episodes") {
        return {
          upsert: vi.fn().mockReturnValue(upsertChain),
          update: vi.fn().mockReturnValue(episodeUpdateChain),
        }
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { email: "user@test.com", name: "Test User" }, error: null }),
        }
      }
      if (table === "content") return stuckContentQuery
      return notifiedUpdateChain
    })

    mockFetchAndParseFeed.mockResolvedValue({
      episodes: [
        {
          title: "New Episode 1",
          url: "https://example.com/ep1.mp3",
          pubDate: new Date(), // today — newer than last_episode_date
          durationSeconds: 3600,
          description: "Fresh content",
        },
      ],
    })

    mockSendNewEpisodeEmail.mockResolvedValue({ success: true, messageId: "msg-001" })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailsSent).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // Private feed with auth header decryption
  // ---------------------------------------------------------------------------

  it("decrypts feed credentials and passes authHeader to fetchAndParseFeed for private feeds", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "sub-private",
        user_id: "user-1",
        feed_url: "https://private.example.com/feed.xml",
        podcast_name: "Private Podcast",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_episode_date: null,
        consecutive_failures: 0,
        feed_auth_header_encrypted: "iv:tag:ciphertext",
      },
    ]

    const stuckContentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      if (table === "content") return stuckContentQuery
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) }
    })

    mockDecryptFeedCredential.mockReturnValue("Basic dXNlcjpwYXNz")
    mockFetchAndParseFeed.mockResolvedValue({ episodes: [] })

    await GET(createAuthedRequest())

    expect(mockDecryptFeedCredential).toHaveBeenCalledWith("iv:tag:ciphertext")
    expect(mockFetchAndParseFeed).toHaveBeenCalledWith(
      "https://private.example.com/feed.xml",
      expect.objectContaining({ authHeader: "Basic dXNlcjpwYXNz" }),
    )
  })

  // ---------------------------------------------------------------------------
  // Feed fetch failure / consecutive failures / auto-deactivation
  // ---------------------------------------------------------------------------

  it("increments consecutive_failures when RSS feed fetch throws", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "sub-1",
        user_id: "user-1",
        feed_url: "https://example.com/feed.xml",
        podcast_name: "Failing Podcast",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_episode_date: null,
        consecutive_failures: 2,
        feed_auth_header_encrypted: null,
      },
    ]

    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const stuckContentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: updateFn,
        }
      }
      if (table === "content") return stuckContentQuery
      return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
    })

    mockFetchAndParseFeed.mockRejectedValue(new Error("Network error"))
    mockClassifyFeedError.mockReturnValue("Feed unreachable")

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    // The update must have been called with incremented failures (3)
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ consecutive_failures: 3, last_error: "Feed unreachable" }),
    )
  })

  it("auto-deactivates a subscription after 7 consecutive failures", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "sub-1",
        user_id: "user-1",
        feed_url: "https://example.com/feed.xml",
        podcast_name: "Dead Podcast",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_episode_date: null,
        consecutive_failures: 6, // one more failure → 7 → deactivate
        feed_auth_header_encrypted: null,
      },
    ]

    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const stuckContentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: updateFn,
        }
      }
      if (table === "content") return stuckContentQuery
      return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
    })

    mockFetchAndParseFeed.mockRejectedValue(new Error("Still dead"))
    mockClassifyFeedError.mockReturnValue("Feed unreachable")

    await GET(createAuthedRequest())

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false, consecutive_failures: 7 }),
    )
  })

  // ---------------------------------------------------------------------------
  // Episode insert failure
  // ---------------------------------------------------------------------------

  it("continues processing when episode insert fails for one subscription", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "sub-1",
        user_id: "user-1",
        feed_url: "https://example.com/feed.xml",
        podcast_name: "Test Podcast",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_episode_date: null,
        consecutive_failures: 0,
        feed_auth_header_encrypted: null,
      },
    ]

    const stuckContentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      if (table === "podcast_episodes") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: null, error: { message: "Insert failed" } }),
          }),
        }
      }
      if (table === "content") return stuckContentQuery
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) }
    })

    mockFetchAndParseFeed.mockResolvedValue({
      episodes: [
        {
          title: "New Episode",
          url: "https://example.com/ep1.mp3",
          pubDate: new Date(),
          durationSeconds: 1800,
          description: null,
        },
      ],
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    // Should still return 200 — failure is soft
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.newEpisodes).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // Email send failure (graceful degradation)
  // ---------------------------------------------------------------------------

  it("returns 200 even when email send fails", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "sub-1",
        user_id: "user-1",
        feed_url: "https://example.com/feed.xml",
        podcast_name: "Tech Talk",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_episode_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        consecutive_failures: 0,
        feed_auth_header_encrypted: null,
      },
    ]

    const insertedEpisodes = [
      { id: "ep-id-1", episode_title: "New Episode", episode_date: new Date().toISOString(), duration_seconds: 1800 },
    ]

    const stuckContentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      if (table === "podcast_episodes") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: insertedEpisodes, error: null }),
          }),
          update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { email: "user@test.com", name: "Test User" }, error: null }),
        }
      }
      if (table === "content") return stuckContentQuery
      return {}
    })

    mockFetchAndParseFeed.mockResolvedValue({
      episodes: [
        {
          title: "New Episode",
          url: "https://example.com/ep1.mp3",
          pubDate: new Date(),
          durationSeconds: 1800,
          description: null,
        },
      ],
    })

    mockSendNewEpisodeEmail.mockResolvedValue({ success: false, error: "SMTP error" })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailsSent).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // Response shape
  // ---------------------------------------------------------------------------

  it("returns the correct response shape on success", async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "podcast_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(body).toMatchObject({
      success: true,
      checked: expect.any(Number),
      newEpisodes: expect.any(Number),
      emailsSent: expect.any(Number),
    })
  })
})

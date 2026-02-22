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

// YouTube resolver
const mockExtractYouTubeVideoId = vi.fn()
vi.mock("@/lib/youtube-resolver", () => ({
  extractYouTubeVideoId: (...args: unknown[]) => mockExtractYouTubeVideoId(...args),
}))

// Email
const mockSendNewVideoEmail = vi.fn()
vi.mock("@/lib/email", () => ({
  sendNewVideoEmail: (...args: unknown[]) => mockSendNewVideoEmail(...args),
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

import { GET } from "@/app/api/crons/check-youtube-feeds/route"

// =============================================================================
// Helpers
// =============================================================================

const CRON_SECRET = "test-cron-secret-yt-456"

function createRequest(headers: Record<string, string> = {}) {
  return new Request("https://clarusapp.io/api/crons/check-youtube-feeds", {
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

describe("GET /api/crons/check-youtube-feeds", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET

    // Default: classify feed errors generically
    mockClassifyFeedError.mockReturnValue("Feed unreachable")

    // Default: email sends succeed
    mockSendNewVideoEmail.mockResolvedValue({ success: true, messageId: "msg-yt-001" })

    // Default: YouTube ID extraction returns a video ID
    mockExtractYouTubeVideoId.mockImplementation((url: string) => {
      const match = url.match(/[?&]v=([^&]+)/)
      return match ? match[1] : null
    })
  })

  // ---------------------------------------------------------------------------
  // Auth / secret verification
  // ---------------------------------------------------------------------------

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET

    const response = await GET(createRequest({ authorization: "Bearer anything" }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/server misconfigured/i)
  })

  it("returns 401 when authorization header is missing", async () => {
    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/unauthorized/i)
  })

  it("returns 401 when authorization header has wrong secret", async () => {
    const response = await GET(createRequest({ authorization: "Bearer wrong-secret" }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/unauthorized/i)
  })

  it("returns 401 when Bearer prefix is missing from authorization header", async () => {
    const response = await GET(createRequest({ authorization: CRON_SECRET }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/unauthorized/i)
  })

  // ---------------------------------------------------------------------------
  // Database errors
  // ---------------------------------------------------------------------------

  it("returns 500 when fetching YouTube subscriptions fails", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
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
    expect(body.newVideos).toBe(0)
    expect(body.emailsSent).toBe(0)
  })

  it("returns 200 with zeros when subscriptions exist but none are due for checking", async () => {
    const recentlyChecked = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "yt-sub-1",
        user_id: "user-1",
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC123",
        channel_name: "Tech Channel",
        last_checked_at: recentlyChecked,
        check_frequency_hours: 24,
        last_video_date: null,
        consecutive_failures: 0,
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
    expect(body.newVideos).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // Success: subscription is due but no new videos
  // ---------------------------------------------------------------------------

  it("returns 200 with newVideos=0 when feed has no episodes newer than last_video_date", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "yt-sub-1",
        user_id: "user-1",
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC123",
        channel_name: "Tech Channel",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_video_date: new Date().toISOString(), // last video was today
        consecutive_failures: 0,
      },
    ]

    const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) }

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: vi.fn().mockReturnValue(updateChain),
        }
      }
      return {}
    })

    // All feed episodes are older than last_video_date
    mockFetchAndParseFeed.mockResolvedValue({
      episodes: [
        {
          title: "Old Video",
          url: "https://www.youtube.com/watch?v=abc123",
          pubDate: new Date(Date.now() - 96 * 60 * 60 * 1000),
          durationSeconds: null,
          description: "Old video",
        },
      ],
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.newVideos).toBe(0)
    expect(body.emailsSent).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // Success: new videos found and emails sent
  // ---------------------------------------------------------------------------

  it("returns 200 with correct counts when new videos are found and email is sent", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "yt-sub-1",
        user_id: "user-1",
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC123",
        channel_name: "Tech Channel",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_video_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        consecutive_failures: 0,
      },
    ]

    const insertedVideos = [
      { id: "vid-id-1", video_title: "New Video 1", published_date: new Date().toISOString() },
    ]

    const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) }
    const inChain = { error: null }

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: vi.fn().mockReturnValue(updateChain),
        }
      }
      if (table === "youtube_videos") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: insertedVideos, error: null }),
          }),
          update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue(inChain) }),
        }
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { email: "user@test.com", name: "Test User" }, error: null }),
        }
      }
      return {}
    })

    mockFetchAndParseFeed.mockResolvedValue({
      episodes: [
        {
          title: "New Video 1",
          url: "https://www.youtube.com/watch?v=newvid1",
          pubDate: new Date(),
          durationSeconds: null,
          description: "New content",
        },
      ],
    })

    mockExtractYouTubeVideoId.mockReturnValue("newvid1")
    mockSendNewVideoEmail.mockResolvedValue({ success: true, messageId: "msg-yt-002" })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailsSent).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // First-time subscription (no last_video_date)
  // ---------------------------------------------------------------------------

  it("treats all feed episodes as new when last_video_date is null (first check)", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "yt-sub-new",
        user_id: "user-2",
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC999",
        channel_name: "New Channel",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_video_date: null, // first check
        consecutive_failures: 0,
      },
    ]

    const insertedVideos = [
      { id: "vid-2", video_title: "Episode 1", published_date: new Date().toISOString() },
      { id: "vid-3", video_title: "Episode 2", published_date: new Date().toISOString() },
    ]

    const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) }

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: vi.fn().mockReturnValue(updateChain),
        }
      }
      if (table === "youtube_videos") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: insertedVideos, error: null }),
          }),
          update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { email: "user2@test.com", name: "User Two" }, error: null }),
        }
      }
      return {}
    })

    mockFetchAndParseFeed.mockResolvedValue({
      episodes: [
        { title: "Episode 1", url: "https://www.youtube.com/watch?v=ep1", pubDate: new Date(), durationSeconds: null, description: null },
        { title: "Episode 2", url: "https://www.youtube.com/watch?v=ep2", pubDate: new Date(), durationSeconds: null, description: null },
      ],
    })

    mockExtractYouTubeVideoId.mockReturnValue("ep1")
    mockSendNewVideoEmail.mockResolvedValue({ success: true })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    // Both episodes should be treated as new on first check
    expect(body.newVideos).toBe(2)
  })

  // ---------------------------------------------------------------------------
  // Feed fetch failure / consecutive failures / auto-deactivation
  // ---------------------------------------------------------------------------

  it("increments consecutive_failures when YouTube feed fetch throws", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "yt-sub-fail",
        user_id: "user-1",
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCbroken",
        channel_name: "Broken Channel",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_video_date: null,
        consecutive_failures: 3,
      },
    ]

    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: updateFn,
        }
      }
      return {}
    })

    mockFetchAndParseFeed.mockRejectedValue(new Error("Connection refused"))
    mockClassifyFeedError.mockReturnValue("Feed unreachable")

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ consecutive_failures: 4, last_error: "Feed unreachable" }),
    )
  })

  it("auto-deactivates a subscription after 7 consecutive failures", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "yt-sub-dead",
        user_id: "user-1",
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCdead",
        channel_name: "Dead Channel",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_video_date: null,
        consecutive_failures: 6, // next failure → 7 → deactivate
      },
    ]

    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: updateFn,
        }
      }
      return {}
    })

    mockFetchAndParseFeed.mockRejectedValue(new Error("404 Not Found"))
    mockClassifyFeedError.mockReturnValue("Feed not found")

    await GET(createAuthedRequest())

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false, consecutive_failures: 7 }),
    )
  })

  // ---------------------------------------------------------------------------
  // Video insert failure (graceful degradation)
  // ---------------------------------------------------------------------------

  it("returns 200 with newVideos=0 when video insert fails", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "yt-sub-1",
        user_id: "user-1",
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC123",
        channel_name: "Tech Channel",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_video_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        consecutive_failures: 0,
      },
    ]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      if (table === "youtube_videos") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: null, error: { message: "Insert constraint violation" } }),
          }),
        }
      }
      return {}
    })

    mockFetchAndParseFeed.mockResolvedValue({
      episodes: [
        {
          title: "New Video",
          url: "https://www.youtube.com/watch?v=fail123",
          pubDate: new Date(),
          durationSeconds: null,
          description: null,
        },
      ],
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.newVideos).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // Email failure graceful degradation
  // ---------------------------------------------------------------------------

  it("returns emailsSent=0 but still 200 when email sending fails", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "yt-sub-1",
        user_id: "user-1",
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC123",
        channel_name: "Tech Channel",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_video_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        consecutive_failures: 0,
      },
    ]

    const insertedVideos = [
      { id: "vid-id-1", video_title: "New Video", published_date: new Date().toISOString() },
    ]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      if (table === "youtube_videos") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: insertedVideos, error: null }),
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
      return {}
    })

    mockFetchAndParseFeed.mockResolvedValue({
      episodes: [
        {
          title: "New Video",
          url: "https://www.youtube.com/watch?v=newvid",
          pubDate: new Date(),
          durationSeconds: null,
          description: null,
        },
      ],
    })

    mockExtractYouTubeVideoId.mockReturnValue("newvid")
    mockSendNewVideoEmail.mockResolvedValue({ success: false, error: "Resend API error" })

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
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    const response = await GET(createAuthedRequest())
    const body = await response.json()

    expect(body).toMatchObject({
      success: true,
      checked: expect.any(Number),
      newVideos: expect.any(Number),
      emailsSent: expect.any(Number),
    })
  })

  // ---------------------------------------------------------------------------
  // Failure count reset on success
  // ---------------------------------------------------------------------------

  it("resets consecutive_failures to 0 when a previously-failing subscription succeeds", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const subscriptions = [
      {
        id: "yt-sub-recovering",
        user_id: "user-1",
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC456",
        channel_name: "Recovering Channel",
        last_checked_at: oldDate,
        check_frequency_hours: 24,
        last_video_date: null,
        consecutive_failures: 3, // had failures before
      },
    ]

    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "youtube_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: subscriptions, error: null }),
          update: updateFn,
        }
      }
      if (table === "youtube_videos") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }
      return {}
    })

    // Feed fetch succeeds this time with no new videos
    mockFetchAndParseFeed.mockResolvedValue({ episodes: [] })

    await GET(createAuthedRequest())

    // Should call update to reset consecutive_failures
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ consecutive_failures: 0, last_error: null }),
    )
  })
})

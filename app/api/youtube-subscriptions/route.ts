/**
 * @module api/youtube-subscriptions
 * @description API routes for managing YouTube channel subscriptions.
 *
 * GET  - List all subscriptions for the authenticated user
 * POST - Add a new YouTube channel subscription (resolves channel, checks tier limits)
 */

import { NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limit"
import { getUserTier } from "@/lib/usage"
import { TIER_LIMITS } from "@/lib/tier-limits"
import { parseBody, addYouTubeSubscriptionSchema } from "@/lib/schemas"
import { resolveYouTubeChannel } from "@/lib/youtube-resolver"
import { logger } from "@/lib/logger"

/**
 * GET /api/youtube-subscriptions
 * Lists the authenticated user's YouTube subscriptions with latest video info.
 */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  const { data: subscriptions, error } = await supabase
    .from("youtube_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    logger.error("[youtube-subscriptions] Failed to fetch subscriptions:", error.message)
    return AuthErrors.serverError()
  }

  // Fetch latest video per subscription in a single query
  const subscriptionIds = (subscriptions ?? []).map((s) => s.id)

  let latestVideos: Record<string, { video_title: string; published_date: string | null }> = {}
  if (subscriptionIds.length > 0) {
    const { data: videos } = await supabase
      .from("youtube_videos")
      .select("subscription_id, video_title, published_date")
      .in("subscription_id", subscriptionIds)
      .order("published_date", { ascending: false, nullsFirst: false })
      .limit(subscriptionIds.length * 2)

    if (videos) {
      for (const vid of videos) {
        if (!latestVideos[vid.subscription_id]) {
          latestVideos[vid.subscription_id] = {
            video_title: vid.video_title,
            published_date: vid.published_date,
          }
        }
      }
    }
  }

  const enriched = (subscriptions ?? []).map((sub) => ({
    ...sub,
    latest_video: latestVideos[sub.id] ?? null,
  }))

  return NextResponse.json(
    { subscriptions: enriched },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
  )
}

/**
 * POST /api/youtube-subscriptions
 * Adds a new YouTube channel subscription after resolving the channel.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  // Rate limit: 10 requests per minute
  const rateCheck = await checkRateLimit(`yt-sub:${user.id}`, 10, 60_000)
  if (!rateCheck.allowed) {
    return AuthErrors.rateLimit(rateCheck.resetIn)
  }

  // Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return AuthErrors.badRequest("Invalid JSON body")
  }

  const parsed = parseBody(addYouTubeSubscriptionSchema, body)
  if (!parsed.success) {
    return AuthErrors.badRequest(parsed.error)
  }

  const { channel_url } = parsed.data

  // Parallelize tier check and subscription count
  const [tier, countResult] = await Promise.all([
    getUserTier(supabase, user.id),
    supabase
      .from("youtube_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true),
  ])

  const ytSubLimit = TIER_LIMITS[tier].youtubeSubscriptions

  if (ytSubLimit === 0) {
    return NextResponse.json(
      { error: "YouTube subscriptions are not available on the Free tier. Upgrade to Starter or higher." },
      { status: 403 }
    )
  }

  if (countResult.error) {
    logger.error("[youtube-subscriptions] Failed to count subscriptions:", countResult.error.message)
    return AuthErrors.serverError()
  }

  if ((countResult.count ?? 0) >= ytSubLimit) {
    return NextResponse.json(
      { error: `You've reached your limit of ${ytSubLimit} YouTube subscriptions on the ${tier} tier.` },
      { status: 403 }
    )
  }

  // Resolve the YouTube channel
  let channelInfo: Awaited<ReturnType<typeof resolveYouTubeChannel>>
  try {
    channelInfo = await resolveYouTubeChannel(channel_url)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve YouTube channel"
    return AuthErrors.badRequest(`Invalid YouTube URL: ${message}`)
  }

  // Insert the subscription
  const { data: subscription, error: insertError } = await supabase
    .from("youtube_subscriptions")
    .insert({
      user_id: user.id,
      channel_id: channelInfo.channelId,
      channel_name: channelInfo.channelName,
      channel_image_url: channelInfo.channelImageUrl,
      feed_url: channelInfo.feedUrl,
    })
    .select("id, channel_id, channel_name, channel_image_url, feed_url, created_at")
    .single()

  if (insertError) {
    if (insertError.code === "23505") {
      return AuthErrors.badRequest("You're already subscribed to this YouTube channel")
    }
    logger.error("[youtube-subscriptions] Failed to insert subscription:", insertError.message)
    return AuthErrors.serverError()
  }

  return NextResponse.json({ subscription }, { status: 201 })
}

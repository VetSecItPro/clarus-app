/**
 * @module api/podcast-subscriptions
 * @description API routes for managing podcast RSS feed subscriptions.
 *
 * GET  - List all subscriptions for the authenticated user
 * POST - Add a new podcast subscription (validates RSS feed, checks tier limits)
 */

import { NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { checkRateLimit } from "@/lib/validation"
import { getUserTier } from "@/lib/usage"
import { TIER_LIMITS } from "@/lib/tier-limits"
import { parseBody, addPodcastSubscriptionSchema } from "@/lib/schemas"
import { fetchAndParseFeed } from "@/lib/rss-parser"

/**
 * GET /api/podcast-subscriptions
 * Lists the authenticated user's podcast subscriptions with latest episode info.
 */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  // SECURITY: FIX-SEC-010 — Rate limit GET requests for podcast subscriptions
  const rateCheck = checkRateLimit(`podcast-sub-get:${user.id}`, 60, 60000)
  if (!rateCheck.allowed) {
    return AuthErrors.rateLimit(rateCheck.resetIn)
  }

  // PERF: FIX-PERF-008 — select explicit columns instead of .select('*')
  const { data: subscriptions, error } = await supabase
    .from("podcast_subscriptions")
    .select("id, feed_url, podcast_name, podcast_image_url, last_checked_at, last_episode_date, is_active, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[podcast-subscriptions] Failed to fetch subscriptions:", error.message)
    return AuthErrors.serverError()
  }

  // Fetch latest episode for each subscription
  const subscriptionIds = (subscriptions ?? []).map((s) => s.id)

  let latestEpisodes: Record<string, { episode_title: string; episode_date: string | null }> = {}
  if (subscriptionIds.length > 0) {
    const { data: episodes } = await supabase
      .from("podcast_episodes")
      .select("subscription_id, episode_title, episode_date")
      .in("subscription_id", subscriptionIds)
      .order("episode_date", { ascending: false })
      .limit(subscriptionIds.length)

    if (episodes) {
      // Group by subscription_id, take first (latest) per subscription
      for (const ep of episodes) {
        if (!latestEpisodes[ep.subscription_id]) {
          latestEpisodes[ep.subscription_id] = {
            episode_title: ep.episode_title,
            episode_date: ep.episode_date,
          }
        }
      }
    }
  }

  const enriched = (subscriptions ?? []).map((sub) => ({
    ...sub,
    latest_episode: latestEpisodes[sub.id] ?? null,
  }))

  return NextResponse.json({ subscriptions: enriched })
}

/**
 * POST /api/podcast-subscriptions
 * Adds a new podcast subscription after validating the RSS feed.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  // Rate limit: 10 requests per minute
  const rateCheck = checkRateLimit(`podcast-sub:${user.id}`, 10, 60_000)
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

  const parsed = parseBody(addPodcastSubscriptionSchema, body)
  if (!parsed.success) {
    return AuthErrors.badRequest(parsed.error)
  }

  const { feed_url } = parsed.data

  // Check tier limit for podcast subscriptions
  const tier = await getUserTier(supabase, user.id)
  const limit = TIER_LIMITS[tier].podcastSubscriptions

  if (limit === 0) {
    return NextResponse.json(
      { error: "Podcast subscriptions are not available on the Free tier. Upgrade to Starter or higher." },
      { status: 403 }
    )
  }

  // Count existing active subscriptions
  const { count, error: countError } = await supabase
    .from("podcast_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true)

  if (countError) {
    console.error("[podcast-subscriptions] Failed to count subscriptions:", countError.message)
    return AuthErrors.serverError()
  }

  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: `You've reached your limit of ${limit} podcast subscriptions on the ${tier} tier.` },
      { status: 403 }
    )
  }

  // Fetch and validate the RSS feed
  let feedData: Awaited<ReturnType<typeof fetchAndParseFeed>>
  try {
    feedData = await fetchAndParseFeed(feed_url)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse feed"
    return AuthErrors.badRequest(`Invalid podcast feed: ${message}`)
  }

  if (!feedData.feed.title) {
    return AuthErrors.badRequest("Could not extract podcast title from feed")
  }

  // Insert the subscription
  const { data: subscription, error: insertError } = await supabase
    .from("podcast_subscriptions")
    .insert({
      user_id: user.id,
      feed_url,
      podcast_name: feedData.feed.title,
      podcast_image_url: feedData.feed.imageUrl,
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === "23505") {
      return AuthErrors.badRequest("You're already subscribed to this podcast feed")
    }
    console.error("[podcast-subscriptions] Failed to insert subscription:", insertError.message)
    return AuthErrors.serverError()
  }

  return NextResponse.json({ subscription }, { status: 201 })
}

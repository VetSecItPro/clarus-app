/**
 * @module api/podcast-subscriptions
 * @description API routes for managing podcast RSS feed subscriptions.
 *
 * GET  - List all subscriptions for the authenticated user
 * POST - Add a new podcast subscription (validates RSS feed, checks tier limits)
 */

import { NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limit"
import { getUserTier } from "@/lib/usage"
import { TIER_LIMITS, TIER_FEATURES } from "@/lib/tier-limits"
import { parseBody, addPodcastSubscriptionSchema } from "@/lib/schemas"
import { fetchAndParseFeed } from "@/lib/rss-parser"
import { encryptFeedCredential } from "@/lib/feed-encryption"
import { logger } from "@/lib/logger"

/**
 * GET /api/podcast-subscriptions
 * Lists the authenticated user's podcast subscriptions with latest episode info.
 */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  const { data: subscriptions, error } = await supabase
    .from("podcast_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    // PERF: Prevent unbounded result set
    .limit(100)

  if (error) {
    logger.error("[podcast-subscriptions] Failed to fetch subscriptions:", error.message)
    return AuthErrors.serverError()
  }

  // PERF: Fetch latest episodes in a single query using the subscription IDs
  const subscriptionIds = (subscriptions ?? []).map((s) => s.id)

  let latestEpisodes: Record<string, { episode_title: string; episode_date: string | null }> = {}
  if (subscriptionIds.length > 0) {
    const { data: episodes } = await supabase
      .from("podcast_episodes")
      .select("subscription_id, episode_title, episode_date")
      .in("subscription_id", subscriptionIds)
      .order("episode_date", { ascending: false })
      // PERF: Limit to a reasonable number to prevent unbounded results
      .limit(subscriptionIds.length * 2)

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

  const enriched = (subscriptions ?? []).map((sub) => {
    // Strip encrypted credentials — never send to client
    const { feed_auth_header_encrypted, credentials_updated_at, ...rest } = sub
    const hasCredentials = !!feed_auth_header_encrypted
    // Credentials older than 90 days are considered stale
    const CREDENTIAL_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
    const credentialsStale = hasCredentials && credentials_updated_at
      ? Date.now() - new Date(credentials_updated_at).getTime() > CREDENTIAL_MAX_AGE_MS
      : false
    return {
      ...rest,
      has_credentials: hasCredentials,
      credentials_stale: credentialsStale,
      latest_episode: latestEpisodes[sub.id] ?? null,
    }
  })

  // PERF: Cache personalized subscription list for 30s to reduce DB hits on repeated loads
  return NextResponse.json(
    { subscriptions: enriched },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
  )
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
  const rateCheck = await checkRateLimit(`podcast-sub:${user.id}`, 10, 60_000)
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

  // Extract optional auth_header from raw body (not in Zod schema to keep it flexible)
  const rawBody = body as Record<string, unknown>
  const authHeaderValue = typeof rawBody.auth_header === "string" ? rawBody.auth_header.trim() : undefined

  // PERF: Parallelize tier check and subscription count instead of sequential queries
  const [tier, countResult] = await Promise.all([
    getUserTier(supabase, user.id),
    supabase
      .from("podcast_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true),
  ])

  const podcastSubLimit = TIER_LIMITS[tier].podcastSubscriptions

  if (podcastSubLimit === 0) {
    return NextResponse.json(
      { error: "Podcast subscriptions are not available on the Free tier. Upgrade to Starter or higher." },
      { status: 403 }
    )
  }

  if (countResult.error) {
    logger.error("[podcast-subscriptions] Failed to count subscriptions:", countResult.error.message)
    return AuthErrors.serverError()
  }

  if ((countResult.count ?? 0) >= podcastSubLimit) {
    return NextResponse.json(
      { error: `You've reached your limit of ${podcastSubLimit} podcast subscriptions on the ${tier} tier.` },
      { status: 403 }
    )
  }

  // Gate private feed credentials to Pro tier
  if (authHeaderValue && !TIER_FEATURES[tier].privateFeedCredentials) {
    return NextResponse.json(
      { error: "Private feed authentication requires a Pro plan." },
      { status: 403 }
    )
  }

  // Fetch and validate the RSS feed (pass auth header if provided)
  let feedData: Awaited<ReturnType<typeof fetchAndParseFeed>>
  try {
    feedData = await fetchAndParseFeed(feed_url, authHeaderValue ? { authHeader: authHeaderValue } : undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse feed"
    return AuthErrors.badRequest(`Invalid podcast feed: ${message}`)
  }

  if (!feedData.feed.title) {
    return AuthErrors.badRequest("Could not extract podcast title from feed")
  }

  // Encrypt credentials if provided
  let encryptedAuthHeader: string | null = null
  if (authHeaderValue) {
    try {
      encryptedAuthHeader = encryptFeedCredential(authHeaderValue)
    } catch (err) {
      logger.error("[podcast-subscriptions] Failed to encrypt auth header:", err)
      return NextResponse.json(
        { error: "Failed to securely store feed credentials. Please try again." },
        { status: 500 }
      )
    }
  }

  // Insert the subscription
  const { data: subscription, error: insertError } = await supabase
    .from("podcast_subscriptions")
    .insert({
      user_id: user.id,
      feed_url,
      podcast_name: feedData.feed.title,
      podcast_image_url: feedData.feed.imageUrl,
      ...(encryptedAuthHeader ? {
        feed_auth_header_encrypted: encryptedAuthHeader,
        credentials_updated_at: new Date().toISOString(),
      } : {}),
    })
    .select("id, feed_url, podcast_name, podcast_image_url, created_at")
    .single()

  if (insertError) {
    if (insertError.code === "23505") {
      return AuthErrors.badRequest("You're already subscribed to this podcast feed")
    }
    logger.error("[podcast-subscriptions] Failed to insert subscription:", insertError.message)
    return AuthErrors.serverError()
  }

  // Insert initial episodes from the feed so the user sees content immediately
  // (instead of waiting up to 24h for the cron to discover them)
  let episodesInserted = 0
  if (feedData.episodes.length > 0) {
    const episodeRows = feedData.episodes.slice(0, 50).map((ep) => ({
      subscription_id: subscription.id,
      episode_title: ep.title,
      episode_url: ep.url,
      episode_date: ep.pubDate?.toISOString() ?? null,
      duration_seconds: ep.durationSeconds,
      description: ep.description,
      is_notified: true, // Don't send email for initial batch
    }))

    const { data: inserted, error: epError } = await supabase
      .from("podcast_episodes")
      .upsert(episodeRows, {
        onConflict: "subscription_id,episode_url",
        ignoreDuplicates: true,
      })
      .select("id")

    if (epError) {
      // Non-fatal: subscription was created, episodes will be picked up by cron
      logger.error("[podcast-subscriptions] Failed to insert initial episodes:", epError.message)
    } else {
      episodesInserted = inserted?.length ?? 0

      // Set last_episode_date so the cron doesn't re-insert these
      const latestDate = feedData.episodes
        .filter((ep) => ep.pubDate)
        .sort((a, b) => (b.pubDate?.getTime() ?? 0) - (a.pubDate?.getTime() ?? 0))[0]?.pubDate

      if (latestDate) {
        await supabase
          .from("podcast_subscriptions")
          .update({
            last_episode_date: latestDate.toISOString(),
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", subscription.id)
      }
    }
  }

  return NextResponse.json({ subscription, episodes_inserted: episodesInserted }, { status: 201 })
}

/**
 * @module api/crons/check-podcast-feeds
 * @description Cron job that checks subscribed podcast RSS feeds for new episodes.
 *
 * Runs every 6 hours via Vercel Cron. For each active subscription whose
 * last_checked_at is null or older than its check_frequency_hours, it:
 *   1. Fetches and parses the RSS feed
 *   2. Inserts any new episodes into podcast_episodes
 *   3. Sends a notification email to the user (batched per user)
 *   4. Updates last_checked_at and last_episode_date
 *
 * No auto-analysis -- the value is "never miss an episode," not
 * "burn your quota silently."
 */

import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { getAdminClient } from "@/lib/auth"
import { fetchAndParseFeed, type PodcastEpisode } from "@/lib/rss-parser"
import { sendNewEpisodeEmail } from "@/lib/email"
import { logger } from "@/lib/logger"

export const maxDuration = 60

/** Format seconds into a human-readable duration string. */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * GET /api/crons/check-podcast-feeds
 * Called by Vercel Cron every 6 hours.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    logger.error("CRON_SECRET not configured")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const expectedHeader = `Bearer ${cronSecret}`
  const headerBuffer = Buffer.from(authHeader || "")
  const expectedBuffer = Buffer.from(expectedHeader)
  if (headerBuffer.length !== expectedBuffer.length || !timingSafeEqual(headerBuffer, expectedBuffer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getAdminClient()
  const now = new Date()

  // PERF: Push filtering to database instead of fetching all and filtering in JS
  // Calculate the cutoff timestamp for check_frequency_hours
  // We fetch only subscriptions that need checking (last_checked_at is null OR older than check_frequency_hours)
  // NOTE: This requires a query that compares timestamps, which is more complex.
  // For simplicity and correctness, we'll keep the JS filter but add a database-level filter for active subscriptions only.
  // A fully optimized version would use a SQL function or computed column.

  // Fetch all active subscriptions (we still need to filter by check_frequency_hours in JS due to variable hours)
  const { data: subscriptions, error: subError } = await supabase
    .from("podcast_subscriptions")
    .select("id, user_id, feed_url, podcast_name, last_checked_at, check_frequency_hours, last_episode_date")
    .eq("is_active", true)
    .limit(200)

  if (subError) {
    logger.error("[check-podcast-feeds] Failed to fetch subscriptions:", subError.message)
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 })
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ success: true, checked: 0, newEpisodes: 0, emailsSent: 0 })
  }

  // Filter to subscriptions that need checking based on check_frequency_hours
  // NOTE: Pushing this to SQL would require a WHERE clause like:
  // WHERE last_checked_at IS NULL OR last_checked_at < NOW() - INTERVAL '1 hour' * check_frequency_hours
  // However, Supabase query builder doesn't support dynamic intervals easily.
  // For now, we filter in JS (the dataset is small — max 200 subscriptions).
  const dueSubscriptions = subscriptions.filter((sub) => {
    if (!sub.last_checked_at) return true
    const lastChecked = new Date(sub.last_checked_at)
    const hoursElapsed = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60)
    return hoursElapsed >= (sub.check_frequency_hours ?? 6)
  })

  if (dueSubscriptions.length === 0) {
    return NextResponse.json({ success: true, checked: 0, newEpisodes: 0, emailsSent: 0 })
  }

  // Track new episodes per user for batched email notifications
  const newEpisodesByUser = new Map<string, Array<{
    title: string
    podcastName: string
    date: string | null
    duration: string | null
  }>>()
  const podcastCountByUser = new Map<string, Set<string>>()

  let totalNewEpisodes = 0
  let checked = 0

  // Process each subscription
  const processPromises = dueSubscriptions.map(async (sub) => {
    try {
      const feedData = await fetchAndParseFeed(sub.feed_url)
      checked++

      // Find episodes that are new (not already in the database)
      // We check by episode_url uniqueness (UNIQUE constraint on subscription_id + episode_url)
      const newEpisodes: PodcastEpisode[] = []

      for (const episode of feedData.episodes) {
        // Only consider episodes newer than last_episode_date (if set)
        if (sub.last_episode_date && episode.pubDate) {
          const lastEpDate = new Date(sub.last_episode_date)
          if (episode.pubDate <= lastEpDate) continue
        }

        newEpisodes.push(episode)
      }

      if (newEpisodes.length === 0) {
        // Update last_checked_at even if no new episodes
        await supabase
          .from("podcast_subscriptions")
          .update({ last_checked_at: now.toISOString(), updated_at: now.toISOString() })
          .eq("id", sub.id)
        return
      }

      // Insert new episodes (ignore duplicates via ON CONFLICT)
      const episodeRows = newEpisodes.map((ep) => ({
        subscription_id: sub.id,
        episode_title: ep.title,
        episode_url: ep.url,
        episode_date: ep.pubDate?.toISOString() ?? null,
        duration_seconds: ep.durationSeconds,
        description: ep.description,
        is_notified: false,
      }))

      const { data: insertedEpisodes, error: insertError } = await supabase
        .from("podcast_episodes")
        .upsert(episodeRows, {
          onConflict: "subscription_id,episode_url",
          ignoreDuplicates: true,
        })
        .select("id, episode_title, episode_date, duration_seconds")

      if (insertError) {
        logger.error(`[check-podcast-feeds] Failed to insert episodes for ${sub.podcast_name}:`, insertError.message)
        return
      }

      const inserted = insertedEpisodes ?? []
      totalNewEpisodes += inserted.length

      // Track for email notification
      if (inserted.length > 0) {
        const userEpisodes = newEpisodesByUser.get(sub.user_id) ?? []
        const userPodcasts = podcastCountByUser.get(sub.user_id) ?? new Set<string>()

        for (const ep of inserted) {
          userEpisodes.push({
            title: ep.episode_title,
            podcastName: sub.podcast_name,
            date: ep.episode_date
              ? new Date(ep.episode_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null,
            duration: ep.duration_seconds ? formatDuration(ep.duration_seconds) : null,
          })
        }

        userPodcasts.add(sub.podcast_name)
        newEpisodesByUser.set(sub.user_id, userEpisodes)
        podcastCountByUser.set(sub.user_id, userPodcasts)

        // Mark episodes as notified
        const insertedIds = inserted.map((ep) => ep.id)
        if (insertedIds.length > 0) {
          await supabase
            .from("podcast_episodes")
            .update({ is_notified: true })
            .in("id", insertedIds)
        }
      }

      // Update subscription metadata
      const latestEpisodeDate = newEpisodes
        .filter((ep) => ep.pubDate)
        .sort((a, b) => (b.pubDate?.getTime() ?? 0) - (a.pubDate?.getTime() ?? 0))[0]?.pubDate

      await supabase
        .from("podcast_subscriptions")
        .update({
          last_checked_at: now.toISOString(),
          last_episode_date: latestEpisodeDate?.toISOString() ?? sub.last_episode_date,
          updated_at: now.toISOString(),
        })
        .eq("id", sub.id)
    } catch (err) {
      logger.error(`[check-podcast-feeds] Error processing ${sub.podcast_name} (${sub.feed_url}):`, err)
      // Still update last_checked_at to avoid hammering a broken feed
      await supabase
        .from("podcast_subscriptions")
        .update({ last_checked_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("id", sub.id)
    }
  })

  await Promise.all(processPromises)

  // Send batched notification emails per user
  let emailsSent = 0
  const emailPromises: Promise<void>[] = []

  for (const [userId, episodes] of newEpisodesByUser.entries()) {
    if (episodes.length === 0) continue

    emailPromises.push(
      (async () => {
        try {
          // Fetch user email
          const { data: userData } = await supabase
            .from("users")
            .select("email, name")
            .eq("id", userId)
            .single()

          if (!userData?.email) return

          const podcastCount = podcastCountByUser.get(userId)?.size ?? 1

          const result = await sendNewEpisodeEmail(
            userData.email,
            userData.name ?? undefined,
            episodes,
            podcastCount
          )

          if (result.success) {
            emailsSent++
          } else {
            logger.error(`[check-podcast-feeds] Failed to send email to user ${userId}:`, result.error)
          }
        } catch (err) {
          logger.error(`[check-podcast-feeds] Error sending email to user ${userId}:`, err)
        }
      })()
    )
  }

  await Promise.all(emailPromises)

  return NextResponse.json({
    success: true,
    checked,
    newEpisodes: totalNewEpisodes,
    emailsSent,
  })
}

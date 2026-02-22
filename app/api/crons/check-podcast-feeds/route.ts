/**
 * @module api/crons/check-podcast-feeds
 * @description Cron job that checks subscribed podcast RSS feeds for new episodes.
 *
 * Runs daily via Vercel Cron (8:00 UTC). For each active subscription whose
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
import { fetchAndParseFeed, classifyFeedError, type PodcastEpisode } from "@/lib/rss-parser"
import { pollTranscriptionResult, formatTranscript } from "@/lib/deepgram"
import { processContent, ProcessContentError } from "@/lib/process-content"
import { logApiUsage } from "@/lib/api-usage"
import { decryptFeedCredential } from "@/lib/feed-encryption"
import { sendNewEpisodeEmail } from "@/lib/email"
import { logger } from "@/lib/logger"

/** Number of consecutive failures before auto-deactivating a subscription. */
const MAX_CONSECUTIVE_FAILURES = 7

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
 * Called by Vercel Cron daily at 8:00 UTC.
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
    .select("id, user_id, feed_url, podcast_name, last_checked_at, check_frequency_hours, last_episode_date, consecutive_failures, feed_auth_header_encrypted")
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
    return hoursElapsed >= (sub.check_frequency_hours ?? 24)
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
      // Decrypt credentials for private feeds
      let authHeader: string | undefined
      if (sub.feed_auth_header_encrypted) {
        try {
          authHeader = decryptFeedCredential(sub.feed_auth_header_encrypted)
        } catch (decryptErr) {
          logger.error(`[check-podcast-feeds] Failed to decrypt credentials for ${sub.podcast_name}:`, decryptErr)
        }
      }

      const feedData = await fetchAndParseFeed(sub.feed_url, authHeader ? { authHeader } : undefined)
      checked++

      // Reset failure counter on success
      if (sub.consecutive_failures > 0) {
        await supabase
          .from("podcast_subscriptions")
          .update({ consecutive_failures: 0, last_error: null, updated_at: now.toISOString() })
          .eq("id", sub.id)
      }

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
      const errorMessage = classifyFeedError(err)
      const newFailureCount = (sub.consecutive_failures ?? 0) + 1
      logger.error(`[check-podcast-feeds] Error processing ${sub.podcast_name} (failure #${newFailureCount}): ${errorMessage}`)

      // Auto-deactivate after MAX_CONSECUTIVE_FAILURES
      const shouldDeactivate = newFailureCount >= MAX_CONSECUTIVE_FAILURES

      await supabase
        .from("podcast_subscriptions")
        .update({
          last_checked_at: now.toISOString(),
          updated_at: now.toISOString(),
          consecutive_failures: newFailureCount,
          last_error: errorMessage,
          ...(shouldDeactivate ? { is_active: false } : {}),
        })
        .eq("id", sub.id)

      if (shouldDeactivate) {
        logger.warn(`[check-podcast-feeds] Auto-deactivated "${sub.podcast_name}" after ${newFailureCount} consecutive failures`)
      }
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

  // ── Stuck transcription recovery (polling fallback) ─────────────
  // If a Deepgram webhook never fires, podcasts stay in "transcribing"
  // state forever. Before marking as failed, poll Deepgram's API to
  // check if the transcription actually completed — silent recovery.
  //
  // Two-tier window:
  //   20 min – 2 hours: poll Deepgram, recover if completed
  //   > 2 hours: permanently mark as failed (no recovery attempt)
  let stuckTranscriptionsRecovered = 0
  let stuckTranscriptionsCleaned = 0

  const deepgramApiKey = process.env.DEEPGRAM_API_KEY

  try {
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString()
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    const { data: stuckItems, error: stuckError } = await supabase
      .from("content")
      .select("id, user_id, podcast_transcript_id, date_added")
      .eq("type", "podcast")
      .not("podcast_transcript_id", "is", null)
      .or("full_text.is.null,full_text.eq.")
      .lt("date_added", twentyMinAgo)
      .limit(10) // Cap to avoid cron timeout

    if (stuckError) {
      logger.error("[check-podcast-feeds] Failed to query stuck transcriptions:", stuckError.message)
    } else if (stuckItems && stuckItems.length > 0) {
      logger.warn(`[check-podcast-feeds] Found ${stuckItems.length} stuck transcription(s), attempting recovery...`)

      // Process up to 5 in parallel to stay within cron timeout
      const recoveryPromises = stuckItems.slice(0, 5).map(async (item) => {
        const isExpired = item.date_added && item.date_added < twoHoursAgo

        // If older than 2 hours, skip polling — mark as permanently failed
        if (isExpired || !deepgramApiKey || !item.podcast_transcript_id) {
          logger.warn(`[check-podcast-feeds] Marking ${item.id} as permanently failed (age: ${isExpired ? ">2hr" : "no API key/transcript_id"})`)
          await markTranscriptionFailed(supabase, item.id, item.user_id!)
          stuckTranscriptionsCleaned++
          return
        }

        // Poll Deepgram to check if transcription completed
        const pollResult = await pollTranscriptionResult(item.podcast_transcript_id, deepgramApiKey)

        if (pollResult.status === "completed") {
          // Silent recovery — save transcript and trigger AI analysis
          logger.info(`[check-podcast-feeds] Recovered transcription for ${item.id} via polling`)

          const { full_text, duration_seconds, speaker_count } = formatTranscript(pollResult.payload)

          if (!full_text) {
            await markTranscriptionFailed(supabase, item.id, item.user_id!, "Transcription completed but produced no text.")
            stuckTranscriptionsCleaned++
            return
          }

          // Save transcript — use WHERE full_text IS NULL to prevent double-processing
          const { error: updateError } = await supabase
            .from("content")
            .update({ full_text, duration: duration_seconds })
            .eq("id", item.id)
            .is("full_text", null)

          if (updateError) {
            logger.warn(`[check-podcast-feeds] Failed to save recovered transcript for ${item.id}:`, updateError.message)
            return
          }

          // Log transcription API usage
          await logApiUsage({
            userId: item.user_id,
            contentId: item.id,
            apiName: "deepgram",
            operation: "transcribe",
            tokensInput: duration_seconds,
            responseTimeMs: 0,
            status: "success",
            metadata: { speaker_count, duration_seconds, recovered: true },
          })

          // Trigger AI analysis
          try {
            await processContent({
              contentId: item.id,
              userId: item.user_id,
            })
          } catch (err) {
            if (err instanceof ProcessContentError) {
              logger.error(`[check-podcast-feeds] AI analysis failed for recovered ${item.id}: ${err.message}`)
            } else {
              logger.error(`[check-podcast-feeds] AI analysis failed for recovered ${item.id}:`, err)
            }
          }

          stuckTranscriptionsRecovered++
        } else if (pollResult.status === "processing") {
          // Still processing — leave it alone, check again next cron run
          logger.info(`[check-podcast-feeds] Transcription ${item.id} still processing on Deepgram, will retry next run`)
        } else {
          // Failed on Deepgram's side
          logger.warn(`[check-podcast-feeds] Deepgram reports failure for ${item.id}: ${pollResult.error}`)
          await markTranscriptionFailed(supabase, item.id, item.user_id!, pollResult.error)
          stuckTranscriptionsCleaned++
        }
      })

      await Promise.allSettled(recoveryPromises)

      // Handle remaining items (6-10) that weren't processed this run — just log
      if (stuckItems.length > 5) {
        logger.info(`[check-podcast-feeds] ${stuckItems.length - 5} additional stuck items will be processed next run`)
      }

      logger.info(`[check-podcast-feeds] Recovery complete: ${stuckTranscriptionsRecovered} recovered, ${stuckTranscriptionsCleaned} marked failed`)
    }
  } catch (cleanupErr) {
    logger.error("[check-podcast-feeds] Error during stuck transcription recovery:", cleanupErr)
  }

  return NextResponse.json({
    success: true,
    checked,
    newEpisodes: totalNewEpisodes,
    emailsSent,
    stuckTranscriptionsRecovered,
    stuckTranscriptionsCleaned,
  })
}

/** Mark a stuck transcription as permanently failed. */
async function markTranscriptionFailed(
  supabase: ReturnType<typeof getAdminClient>,
  contentId: string,
  userId: string,
  detail?: string,
) {
  await supabase
    .from("content")
    .update({ full_text: "PROCESSING_FAILED::TRANSCRIPTION::TRANSCRIPTION_TIMEOUT" })
    .eq("id", contentId)

  await supabase
    .from("summaries")
    .upsert(
      {
        content_id: contentId,
        user_id: userId,
        language: "en",
        processing_status: "error",
        brief_overview: detail
          ? `Transcription failed: ${detail}. Please try again.`
          : "Transcription timed out. The audio may have been too large or the service was unavailable. Please try again.",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "content_id,language" },
    )
}

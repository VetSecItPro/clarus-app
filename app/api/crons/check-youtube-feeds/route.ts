/**
 * @module api/crons/check-youtube-feeds
 * @description Cron job that checks subscribed YouTube channels for new videos.
 *
 * Runs every 6 hours via Vercel Cron. For each active subscription whose
 * last_checked_at is null or older than its check_frequency_hours, it:
 *   1. Fetches and parses the YouTube Atom feed
 *   2. Inserts any new videos into youtube_videos
 *   3. Sends a notification email to the user (batched per user)
 *   4. Updates last_checked_at and last_video_date
 *
 * @see {@link app/api/crons/check-podcast-feeds/route.ts} for the podcast equivalent
 */

import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { getAdminClient } from "@/lib/auth"
import { fetchAndParseFeed } from "@/lib/rss-parser"
import { sendNewVideoEmail } from "@/lib/email"
import { extractYouTubeVideoId } from "@/lib/youtube-resolver"

export const maxDuration = 60

/**
 * GET /api/crons/check-youtube-feeds
 * Called by Vercel Cron every 6 hours.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("CRON_SECRET not configured")
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

  // Fetch all active YouTube subscriptions
  const { data: subscriptions, error: subError } = await supabase
    .from("youtube_subscriptions")
    .select("id, user_id, feed_url, channel_name, last_checked_at, check_frequency_hours, last_video_date")
    .eq("is_active", true)
    .limit(200)

  if (subError) {
    console.error("[check-youtube-feeds] Failed to fetch subscriptions:", subError.message)
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 })
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ success: true, checked: 0, newVideos: 0, emailsSent: 0 })
  }

  // Filter to subscriptions that need checking
  const dueSubscriptions = subscriptions.filter((sub) => {
    if (!sub.last_checked_at) return true
    const lastChecked = new Date(sub.last_checked_at)
    const hoursElapsed = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60)
    return hoursElapsed >= (sub.check_frequency_hours ?? 6)
  })

  if (dueSubscriptions.length === 0) {
    return NextResponse.json({ success: true, checked: 0, newVideos: 0, emailsSent: 0 })
  }

  // Track new videos per user for batched email notifications
  const newVideosByUser = new Map<string, Array<{
    title: string
    channelName: string
    date: string | null
  }>>()
  const channelCountByUser = new Map<string, Set<string>>()

  let totalNewVideos = 0
  let checked = 0

  // Process each subscription
  const processPromises = dueSubscriptions.map(async (sub) => {
    try {
      const feedData = await fetchAndParseFeed(sub.feed_url)
      checked++

      // Find videos that are new (newer than last_video_date)
      const newVideos = feedData.episodes.filter((episode) => {
        if (sub.last_video_date && episode.pubDate) {
          const lastVidDate = new Date(sub.last_video_date)
          return episode.pubDate > lastVidDate
        }
        // If no last_video_date, all episodes are "new" on first check
        return !sub.last_video_date
      })

      if (newVideos.length === 0) {
        await supabase
          .from("youtube_subscriptions")
          .update({ last_checked_at: now.toISOString(), updated_at: now.toISOString() })
          .eq("id", sub.id)
        return
      }

      // Insert new videos (ignore duplicates via ON CONFLICT)
      const videoRows = newVideos.map((vid) => {
        const videoId = extractYouTubeVideoId(vid.url) ?? vid.url
        return {
          subscription_id: sub.id,
          video_title: vid.title,
          video_url: vid.url,
          video_id: videoId,
          published_date: vid.pubDate?.toISOString() ?? null,
          description: vid.description,
          thumbnail_url: videoId !== vid.url
            ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            : null,
          is_notified: false,
        }
      })

      const { data: insertedVideos, error: insertError } = await supabase
        .from("youtube_videos")
        .upsert(videoRows, {
          onConflict: "subscription_id,video_id",
          ignoreDuplicates: true,
        })
        .select("id, video_title, published_date")

      if (insertError) {
        console.error(`[check-youtube-feeds] Failed to insert videos for ${sub.channel_name}:`, insertError.message)
        return
      }

      const inserted = insertedVideos ?? []
      totalNewVideos += inserted.length

      // Track for email notification
      if (inserted.length > 0) {
        const userVideos = newVideosByUser.get(sub.user_id) ?? []
        const userChannels = channelCountByUser.get(sub.user_id) ?? new Set<string>()

        for (const vid of inserted) {
          userVideos.push({
            title: vid.video_title,
            channelName: sub.channel_name,
            date: vid.published_date
              ? new Date(vid.published_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null,
          })
        }

        userChannels.add(sub.channel_name)
        newVideosByUser.set(sub.user_id, userVideos)
        channelCountByUser.set(sub.user_id, userChannels)

        // Mark videos as notified
        const insertedIds = inserted.map((vid) => vid.id)
        if (insertedIds.length > 0) {
          await supabase
            .from("youtube_videos")
            .update({ is_notified: true })
            .in("id", insertedIds)
        }
      }

      // Update subscription metadata
      const latestVideoDate = newVideos
        .filter((vid) => vid.pubDate)
        .sort((a, b) => (b.pubDate?.getTime() ?? 0) - (a.pubDate?.getTime() ?? 0))[0]?.pubDate

      await supabase
        .from("youtube_subscriptions")
        .update({
          last_checked_at: now.toISOString(),
          last_video_date: latestVideoDate?.toISOString() ?? sub.last_video_date,
          updated_at: now.toISOString(),
        })
        .eq("id", sub.id)
    } catch (err) {
      console.error(`[check-youtube-feeds] Error processing ${sub.channel_name} (${sub.feed_url}):`, err)
      // Still update last_checked_at to avoid hammering a broken feed
      await supabase
        .from("youtube_subscriptions")
        .update({ last_checked_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("id", sub.id)
    }
  })

  await Promise.all(processPromises)

  // Send batched notification emails per user
  let emailsSent = 0
  const emailPromises: Promise<void>[] = []

  for (const [userId, videos] of newVideosByUser.entries()) {
    if (videos.length === 0) continue

    emailPromises.push(
      (async () => {
        try {
          const { data: userData } = await supabase
            .from("users")
            .select("email, name")
            .eq("id", userId)
            .single()

          if (!userData?.email) return

          const channelCount = channelCountByUser.get(userId)?.size ?? 1

          const result = await sendNewVideoEmail(
            userData.email,
            userData.name ?? undefined,
            videos,
            channelCount
          )

          if (result.success) {
            emailsSent++
          } else {
            console.error(`[check-youtube-feeds] Failed to send email to user ${userId}:`, result.error)
          }
        } catch (err) {
          console.error(`[check-youtube-feeds] Error sending email to user ${userId}:`, err)
        }
      })()
    )
  }

  await Promise.all(emailPromises)

  return NextResponse.json({
    success: true,
    checked,
    newVideos: totalNewVideos,
    emailsSent,
  })
}

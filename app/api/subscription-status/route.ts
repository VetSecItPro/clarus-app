/**
 * @module api/subscription-status
 * @description Lightweight endpoint to check if the user subscribes to a specific channel or feed.
 *
 * Used by the SubscribePrompt component on the item detail page to determine
 * whether to show "Subscribe" or "Subscribed" state, without fetching all subscriptions.
 *
 * GET /api/subscription-status?type=youtube&channel_id=UCxxx
 * GET /api/subscription-status?type=podcast&feed_url=https://feeds.example.com/podcast.xml
 *
 * @see {@link components/subscribe-prompt.tsx} for the client component
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get("type")

  if (type === "youtube") {
    const channelId = searchParams.get("channel_id")
    if (!channelId) {
      return AuthErrors.badRequest("channel_id is required for YouTube subscriptions")
    }

    const { data } = await supabase
      .from("youtube_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .maybeSingle()

    return NextResponse.json(
      data
        ? { subscribed: true, subscriptionId: data.id }
        : { subscribed: false },
      { headers: { "Cache-Control": "private, max-age=30" } }
    )
  }

  if (type === "podcast") {
    const feedUrl = searchParams.get("feed_url")
    if (!feedUrl) {
      return AuthErrors.badRequest("feed_url is required for podcast subscriptions")
    }

    const { data } = await supabase
      .from("podcast_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("feed_url", feedUrl)
      .eq("is_active", true)
      .maybeSingle()

    return NextResponse.json(
      data
        ? { subscribed: true, subscriptionId: data.id }
        : { subscribed: false },
      { headers: { "Cache-Control": "private, max-age=30" } }
    )
  }

  return AuthErrors.badRequest("type must be 'youtube' or 'podcast'")
}

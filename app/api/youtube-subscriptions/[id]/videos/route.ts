/**
 * @module api/youtube-subscriptions/[id]/videos
 * @description API route for listing videos of a YouTube subscription.
 *
 * GET - List videos for a specific subscription (verifies ownership)
 */

import { NextResponse, type NextRequest } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { validateUUID } from "@/lib/validation"
import { parseQuery, youtubeVideosQuerySchema } from "@/lib/schemas"
import { logger } from "@/lib/logger"

/**
 * GET /api/youtube-subscriptions/[id]/videos
 * Lists videos for a subscription with pagination.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  const { id } = await params
  const idCheck = validateUUID(id)
  if (!idCheck.isValid) {
    return AuthErrors.badRequest(idCheck.error)
  }

  // Parse query params
  const queryResult = parseQuery(youtubeVideosQuerySchema, request.nextUrl.searchParams)
  if (!queryResult.success) {
    return AuthErrors.badRequest(queryResult.error)
  }
  const { limit, offset } = queryResult.data

  // Verify subscription ownership
  const { data: subscription, error: subError } = await supabase
    .from("youtube_subscriptions")
    .select("id")
    .eq("id", idCheck.sanitized!)
    .eq("user_id", user.id)
    .single()

  if (subError || !subscription) {
    return AuthErrors.notFound("Subscription")
  }

  // Fetch videos
  const { data: videos, error: vidError, count } = await supabase
    .from("youtube_videos")
    .select("*", { count: "exact" })
    .eq("subscription_id", subscription.id)
    .order("published_date", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (vidError) {
    logger.error("[youtube-videos] Failed to fetch videos:", vidError.message)
    return AuthErrors.serverError()
  }

  return NextResponse.json(
    {
      videos: videos ?? [],
      total: count ?? 0,
      limit,
      offset,
    },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
  )
}

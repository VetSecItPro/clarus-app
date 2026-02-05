/**
 * @module api/podcast-subscriptions/[id]/episodes
 * @description API route for listing episodes of a podcast subscription.
 *
 * GET - List episodes for a specific subscription (verifies ownership)
 */

import { NextResponse, type NextRequest } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { validateUUID } from "@/lib/validation"
import { parseQuery, podcastEpisodesQuerySchema } from "@/lib/schemas"

/**
 * GET /api/podcast-subscriptions/[id]/episodes
 * Lists episodes for a subscription with pagination.
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
  const queryResult = parseQuery(podcastEpisodesQuerySchema, request.nextUrl.searchParams)
  if (!queryResult.success) {
    return AuthErrors.badRequest(queryResult.error)
  }
  const { limit, offset } = queryResult.data

  // Verify subscription ownership
  const { data: subscription, error: subError } = await supabase
    .from("podcast_subscriptions")
    .select("id")
    .eq("id", idCheck.sanitized!)
    .eq("user_id", user.id)
    .single()

  if (subError || !subscription) {
    return AuthErrors.notFound("Subscription")
  }

  // Fetch episodes
  const { data: episodes, error: epError, count } = await supabase
    .from("podcast_episodes")
    .select("*", { count: "exact" })
    .eq("subscription_id", subscription.id)
    .order("episode_date", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (epError) {
    console.error("[podcast-episodes] Failed to fetch episodes:", epError.message)
    return AuthErrors.serverError()
  }

  // PERF: Cache episode list for 30s to reduce DB hits on repeated page loads
  return NextResponse.json(
    {
      episodes: episodes ?? [],
      total: count ?? 0,
      limit,
      offset,
    },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
  )
}

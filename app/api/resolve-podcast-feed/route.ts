/**
 * @module api/resolve-podcast-feed
 * @description Resolves a podcast platform URL to its RSS feed URL and metadata.
 *
 * POST /api/resolve-podcast-feed
 * Body: { "url": "https://podcasts.apple.com/..." }
 * Returns: { "feedUrl": "...", "podcastName": "...", "podcastImageUrl": "..." }
 *
 * This endpoint performs network requests (Apple API, HTML scraping) that
 * must happen server-side. Used by the SubscribePrompt component when a user
 * wants to subscribe to a podcast from the item detail page.
 *
 * @see {@link lib/podcast-resolver.ts} for the resolution logic
 * @see {@link components/subscribe-prompt.tsx} for the client component
 */

import { NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limit"
import { parseBody, safeUrlSchema } from "@/lib/schemas"
import { resolvePodcastFeed } from "@/lib/podcast-resolver"
import { z } from "zod"

const resolvePodcastFeedSchema = z.object({
  url: safeUrlSchema,
})

export async function POST(request: Request) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user } = auth

  // Rate limit: 10 requests per minute per user
  const rateCheck = await checkRateLimit(`resolve-podcast:${user.id}`, 10, 60_000)
  if (!rateCheck.allowed) {
    return AuthErrors.rateLimit(rateCheck.resetIn)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return AuthErrors.badRequest("Invalid JSON body")
  }

  const parsed = parseBody(resolvePodcastFeedSchema, body)
  if (!parsed.success) {
    return AuthErrors.badRequest(parsed.error)
  }

  try {
    const feedInfo = await resolvePodcastFeed(parsed.data.url)
    return NextResponse.json(feedInfo)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve podcast feed"
    return NextResponse.json({ error: message }, { status: 422 })
  }
}

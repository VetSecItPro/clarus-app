/**
 * @module api/podcast-subscriptions/[id]/episodes/[episodeId]/analyze
 * @description Triggers analysis for a specific podcast episode.
 *
 * POST - Creates a content entry, links it to the episode, and triggers
 *        the process-content pipeline. Counts against the user's monthly
 *        podcast analysis quota.
 */

import { NextResponse, type NextRequest } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { validateUUID } from "@/lib/validation"
import { checkUsageLimit } from "@/lib/usage"
import { processContent, ProcessContentError } from "@/lib/process-content"
import { logger } from "@/lib/logger"

/**
 * POST /api/podcast-subscriptions/[id]/episodes/[episodeId]/analyze
 * Triggers analysis for a podcast episode.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  const { id, episodeId } = await params

  // Validate both UUIDs
  const subIdCheck = validateUUID(id)
  if (!subIdCheck.isValid) {
    return AuthErrors.badRequest(subIdCheck.error)
  }

  const epIdCheck = validateUUID(episodeId)
  if (!epIdCheck.isValid) {
    return AuthErrors.badRequest(epIdCheck.error)
  }

  // PERF: Parallelize subscription ownership and episode fetch
  const [subResult, epResult] = await Promise.all([
    supabase
      .from("podcast_subscriptions")
      .select("id, user_id")
      .eq("id", subIdCheck.sanitized!)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("podcast_episodes")
      .select("id, episode_title, episode_url, content_id, subscription_id")
      .eq("id", epIdCheck.sanitized!)
      .single(),
  ])

  const { data: subscription, error: subError } = subResult
  if (subError || !subscription) {
    return AuthErrors.notFound("Subscription")
  }

  const { data: episode, error: epError } = epResult
  if (epError || !episode) {
    return AuthErrors.notFound("Episode")
  }

  // Verify episode belongs to this subscription
  if (episode.subscription_id !== subscription.id) {
    return AuthErrors.notFound("Episode")
  }

  // Check if already analyzed
  if (episode.content_id) {
    return NextResponse.json(
      { error: "This episode has already been analyzed", content_id: episode.content_id },
      { status: 409 }
    )
  }

  // Pre-flight usage check (read-only — processContent handles atomic enforcement + increment)
  const gate = await checkUsageLimit(supabase, user.id, "podcast_analyses_count")
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: `You've used ${gate.currentCount}/${gate.limit} podcast analyses this month on the ${gate.tier} tier.`,
      },
      { status: 403 }
    )
  }

  // Create a content entry for this episode
  const { data: content, error: contentError } = await supabase
    .from("content")
    .insert({
      user_id: user.id,
      url: episode.episode_url,
      title: episode.episode_title,
      type: "podcast",
      date_added: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (contentError) {
    logger.error("[podcast-analyze] Failed to create content entry:", contentError.message)
    return AuthErrors.serverError()
  }

  // Link the episode to the content entry
  const { error: linkError } = await supabase
    .from("podcast_episodes")
    .update({ content_id: content.id })
    .eq("id", episode.id)

  if (linkError) {
    logger.error("[podcast-analyze] Failed to link episode to content:", linkError.message)
    // Non-fatal: the content entry was created, we just couldn't link it
  }

  // Usage increment handled atomically by processContent() — no separate increment here

  // PERF: Direct function call instead of HTTP fetch — saves 50-200ms
  try {
    await processContent({
      contentId: content.id,
      userId: user.id,
    })
  } catch (err) {
    if (err instanceof ProcessContentError) {
      logger.error("[podcast-analyze] Process-content failed:", err.message)
    } else {
      logger.error("[podcast-analyze] Failed to trigger process-content:", err)
    }
    // Non-fatal: content was created, processing can be retried
  }

  return NextResponse.json({
    success: true,
    content_id: content.id,
    message: "Analysis started. Check your library for results.",
  })
}

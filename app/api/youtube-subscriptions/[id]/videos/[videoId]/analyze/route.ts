/**
 * @module api/youtube-subscriptions/[id]/videos/[videoId]/analyze
 * @description Triggers analysis for a specific YouTube video.
 *
 * POST - Creates a content entry, links it to the video, and triggers
 *        the process-content pipeline. Counts against the user's monthly
 *        analyses quota (shared with regular analyses, not a separate counter).
 */

import { NextResponse, type NextRequest } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { validateUUID } from "@/lib/validation"
import { enforceUsageLimit, incrementUsage } from "@/lib/usage"
import { processContent, ProcessContentError } from "@/lib/process-content"

/**
 * POST /api/youtube-subscriptions/[id]/videos/[videoId]/analyze
 * Triggers analysis for a YouTube video from a subscription.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  const { id, videoId } = await params

  // Validate both UUIDs
  const subIdCheck = validateUUID(id)
  if (!subIdCheck.isValid) {
    return AuthErrors.badRequest(subIdCheck.error)
  }

  const vidIdCheck = validateUUID(videoId)
  if (!vidIdCheck.isValid) {
    return AuthErrors.badRequest(vidIdCheck.error)
  }

  // Parallelize subscription ownership and video fetch
  const [subResult, vidResult] = await Promise.all([
    supabase
      .from("youtube_subscriptions")
      .select("id, user_id")
      .eq("id", subIdCheck.sanitized!)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("youtube_videos")
      .select("id, video_title, video_url, content_id, subscription_id")
      .eq("id", vidIdCheck.sanitized!)
      .single(),
  ])

  const { data: subscription, error: subError } = subResult
  if (subError || !subscription) {
    return AuthErrors.notFound("Subscription")
  }

  const { data: video, error: vidError } = vidResult
  if (vidError || !video) {
    return AuthErrors.notFound("Video")
  }

  // Verify video belongs to this subscription
  if (video.subscription_id !== subscription.id) {
    return AuthErrors.notFound("Video")
  }

  // Check if already analyzed
  if (video.content_id) {
    return NextResponse.json(
      { error: "This video has already been analyzed", content_id: video.content_id },
      { status: 409 }
    )
  }

  // Check analyses quota (YouTube uses the shared analyses_count, not a separate counter)
  const gate = await enforceUsageLimit(supabase, user.id, "analyses_count")
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: `You've used ${gate.currentCount}/${gate.limit} analyses this month on the ${gate.tier} tier.`,
      },
      { status: 403 }
    )
  }

  // Create a content entry for this video
  const { data: content, error: contentError } = await supabase
    .from("content")
    .insert({
      user_id: user.id,
      url: video.video_url,
      title: video.video_title,
      type: "youtube",
      date_added: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (contentError) {
    console.error("[youtube-analyze] Failed to create content entry:", contentError.message)
    return AuthErrors.serverError()
  }

  // Link the video to the content entry
  const { error: linkError } = await supabase
    .from("youtube_videos")
    .update({ content_id: content.id })
    .eq("id", video.id)

  if (linkError) {
    console.error("[youtube-analyze] Failed to link video to content:", linkError.message)
  }

  // Increment the analyses counter
  await incrementUsage(supabase, user.id, "analyses_count")

  // Direct function call for processing
  try {
    await processContent({
      contentId: content.id,
      userId: user.id,
    })
  } catch (err) {
    if (err instanceof ProcessContentError) {
      console.error("[youtube-analyze] Process-content failed:", err.message)
    } else {
      console.error("[youtube-analyze] Failed to trigger process-content:", err)
    }
  }

  return NextResponse.json({
    success: true,
    content_id: content.id,
    message: "Analysis started. Check your library for results.",
  })
}

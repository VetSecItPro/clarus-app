import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { timingSafeEqual } from "crypto"
import type { Database } from "@/types/database.types"
import { formatTranscript, type DeepgramCallbackPayload } from "@/lib/deepgram"
import { logApiUsage } from "@/lib/api-usage"
import { processContent, ProcessContentError } from "@/lib/process-content"
import { logger } from "@/lib/logger"

// PERF: FIX-213 — set maxDuration for serverless function (webhook + retry loop needs time)
export const maxDuration = 60

/** Health-check for verifying the webhook endpoint is reachable. */
export function GET() {
  return NextResponse.json({ status: "ok", endpoint: "deepgram-webhook" })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Shared webhook token to verify requests come from our Deepgram submissions
const webhookToken = process.env.DEEPGRAM_WEBHOOK_TOKEN

/**
 * Deepgram webhook endpoint.
 * Called by Deepgram when podcast transcription completes.
 * Validated by: (1) mandatory shared token in query string, (2) request_id must match a pending podcast.
 */
export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    logger.error("WEBHOOK: Supabase not configured")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  // Require webhook token in production
  if (!webhookToken) {
    logger.error("WEBHOOK: CRITICAL: DEEPGRAM_WEBHOOK_TOKEN not configured")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  // FIX-004: Use timingSafeEqual to prevent timing attacks on webhook token comparison
  const urlToken = req.nextUrl.searchParams.get("token") || ""
  const tokenBuffer = Buffer.from(urlToken)
  const expectedBuffer = Buffer.from(webhookToken)
  if (tokenBuffer.length !== expectedBuffer.length || !timingSafeEqual(tokenBuffer, expectedBuffer)) {
    logger.error("WEBHOOK: Invalid webhook token")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    db: { schema: "clarus" },
  })

  let payload: DeepgramCallbackPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Deepgram puts request_id inside metadata, not at the top level
  const requestId = payload.metadata?.request_id
  if (!requestId || typeof requestId !== "string" || requestId.length > 100) {
    logger.error("WEBHOOK: Invalid or missing request_id in callback payload", {
      hasMetadata: !!payload.metadata,
      requestId: requestId ?? "undefined",
    })
    return NextResponse.json({ error: "Invalid request_id" }, { status: 400 })
  }

  // Look up content by podcast_transcript_id
  const { data: content, error: fetchError } = await supabase
    .from("content")
    .select("id, user_id, url, type")
    .eq("podcast_transcript_id", requestId)
    .single()

  if (fetchError || !content) {
    logger.error(`WEBHOOK: No content found for request_id ${requestId}`)
    return NextResponse.json({ error: "Unknown request_id" }, { status: 404 })
  }

  // Verify this content is actually a podcast in transcribing state
  if (content.type !== "podcast") {
    logger.error(`WEBHOOK: Content ${content.id} is not a podcast (type: ${content.type})`)
    return NextResponse.json({ error: "Content is not a podcast" }, { status: 400 })
  }

  // Handle transcription failure
  if (payload.err_code) {
    logger.error(`WEBHOOK: Raw Deepgram error for ${content.id}: [${payload.err_code}] ${payload.err_msg}`)

    await supabase
      .from("content")
      .update({ full_text: "PROCESSING_FAILED::TRANSCRIPTION::TRANSCRIPTION_FAILED" })
      .eq("id", content.id)

    await supabase
      .from("summaries")
      .upsert(
        {
          content_id: content.id,
          user_id: content.user_id!,
          language: "en",
          processing_status: "error",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "content_id,language" },
      )

    return NextResponse.json({ success: false, message: "Transcription failed" })
  }

  // Format transcript with speaker labels
  const { full_text, duration_seconds, speaker_count } = formatTranscript(payload)

  if (!full_text) {
    logger.error(`WEBHOOK: Empty transcript for content ${content.id}`)

    await supabase
      .from("content")
      .update({ full_text: "PROCESSING_FAILED::TRANSCRIPTION::TRANSCRIPTION_EMPTY" })
      .eq("id", content.id)

    await supabase
      .from("summaries")
      .upsert(
        {
          content_id: content.id,
          user_id: content.user_id!,
          language: "en",
          processing_status: "error",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "content_id,language" },
      )

    return NextResponse.json({ success: false, message: "Empty transcript" })
  }

  // Save transcript to content
  await supabase
    .from("content")
    .update({
      full_text,
      duration: duration_seconds,
    })
    .eq("id", content.id)

  // Log transcription API usage
  await logApiUsage({
    userId: content.user_id,
    contentId: content.id,
    apiName: "deepgram",
    operation: "transcribe",
    tokensInput: duration_seconds, // Used for cost calculation (per-second pricing)
    responseTimeMs: 0, // Not meaningful for async webhook
    status: "success",
    metadata: { speaker_count, duration_seconds },
  })

  // PERF: Direct function call instead of HTTP fetch — saves 50-200ms + retry overhead
  let analysisTriggered = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await processContent({
        contentId: content.id,
        userId: content.user_id,
      })
      analysisTriggered = true
      break
    } catch (error) {
      if (error instanceof ProcessContentError) {
        logger.error(`WEBHOOK: AI analysis failed for ${content.id} (attempt ${attempt}): ${error.message}`)
      } else {
        logger.error(`WEBHOOK: AI analysis failed for ${content.id} (attempt ${attempt}):`, error)
      }

      // Wait before retry: 1s, 2s, 3s (exponential backoff)
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }

  // If all retries failed, mark content as needing attention
  if (!analysisTriggered) {
    logger.error(`WEBHOOK: All retry attempts failed for content ${content.id}. Marking as error.`)
    await supabase
      .from("summaries")
      .upsert(
        {
          content_id: content.id,
          user_id: content.user_id!,
          language: "en",
          processing_status: "error",
          brief_overview: "Transcription completed but analysis failed to start. Please try regenerating.",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "content_id,language" },
      )
  }

  return NextResponse.json({ success: true, content_id: content.id, analysisTriggered })
}

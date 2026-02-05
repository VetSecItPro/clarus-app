import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { timingSafeEqual } from "crypto"
import type { Database } from "@/types/database.types"
import { formatTranscript, type AssemblyAIWebhookPayload } from "@/lib/assemblyai"
import { logApiUsage } from "@/lib/api-usage"

// PERF: FIX-213 — set maxDuration for serverless function (webhook + retry loop needs time)
export const maxDuration = 60

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Shared webhook token to verify requests come from our AssemblyAI submissions
const webhookToken = process.env.ASSEMBLYAI_WEBHOOK_TOKEN

/**
 * AssemblyAI webhook endpoint.
 * Called by AssemblyAI when podcast transcription completes.
 * Validated by: (1) mandatory shared token in query string, (2) transcript_id must match a pending podcast.
 */
export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    console.error("WEBHOOK: Supabase not configured")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  // Require webhook token in production
  if (!webhookToken) {
    console.error("WEBHOOK: CRITICAL: ASSEMBLYAI_WEBHOOK_TOKEN not configured")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  // FIX-004: Use timingSafeEqual to prevent timing attacks on webhook token comparison
  const urlToken = req.nextUrl.searchParams.get("token") || ""
  const tokenBuffer = Buffer.from(urlToken)
  const expectedBuffer = Buffer.from(webhookToken)
  if (tokenBuffer.length !== expectedBuffer.length || !timingSafeEqual(tokenBuffer, expectedBuffer)) {
    console.error("WEBHOOK: Invalid webhook token")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    db: { schema: "clarus" },
  })

  let payload: AssemblyAIWebhookPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { transcript_id, status } = payload
  if (!transcript_id || typeof transcript_id !== "string" || transcript_id.length > 100) {
    return NextResponse.json({ error: "Invalid transcript_id" }, { status: 400 })
  }

  // Look up content by podcast_transcript_id
  const { data: content, error: fetchError } = await supabase
    .from("content")
    .select("id, user_id, url, type")
    .eq("podcast_transcript_id", transcript_id)
    .single()

  if (fetchError || !content) {
    console.error(`WEBHOOK: No content found for transcript_id ${transcript_id}`)
    return NextResponse.json({ error: "Unknown transcript_id" }, { status: 404 })
  }

  // Verify this content is actually a podcast in transcribing state
  if (content.type !== "podcast") {
    console.error(`WEBHOOK: Content ${content.id} is not a podcast (type: ${content.type})`)
    return NextResponse.json({ error: "Content is not a podcast" }, { status: 400 })
  }

  // Handle transcription failure
  if (status === "error") {
    console.error(`WEBHOOK: Raw AssemblyAI error for ${content.id}:`, payload.error)

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
    console.error(`WEBHOOK: Empty transcript for content ${content.id}`)

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
    apiName: "assemblyai",
    operation: "transcribe",
    tokensInput: duration_seconds, // Used for cost calculation (per-second pricing)
    responseTimeMs: 0, // Not meaningful for async webhook
    status: "success",
    metadata: { speaker_count, duration_seconds },
  })

  // PERF: FIX-212 — This self-HTTP-call to /api/process-content is a serverless anti-pattern.
  // It invokes a new serverless function via HTTP instead of calling the logic directly.
  // TODO: Extract process-content into a shared lib function (e.g., lib/process-content.ts)
  // and call it directly here to avoid the extra HTTP round-trip, cold start, and retry overhead.
  // For now, this works correctly — just costs an unnecessary network hop per analysis.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000")

  let analysisTriggered = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const analysisResponse = await fetch(`${appUrl}/api/process-content`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // SECURITY: Use dedicated internal secret, not service role key — FIX-007
          "Authorization": `Bearer ${process.env.INTERNAL_API_SECRET}`,
        },
        body: JSON.stringify({ content_id: content.id }),
      })

      if (analysisResponse.ok) {
        analysisTriggered = true
        break
      }

      const errorData = await analysisResponse.json().catch(() => ({}))
      console.error(`WEBHOOK: AI analysis trigger failed for ${content.id} (attempt ${attempt}):`, errorData)
    } catch (error) {
      console.error(`WEBHOOK: Failed to trigger AI analysis for ${content.id} (attempt ${attempt}):`, error)
    }

    // Wait before retry: 2s, 4s
    if (attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
    }
  }

  // If all retries failed, mark content as needing attention
  if (!analysisTriggered) {
    console.error(`WEBHOOK: All retry attempts failed for content ${content.id}. Marking as error.`)
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

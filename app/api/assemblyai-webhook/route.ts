import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database.types"
import { formatTranscript, type AssemblyAIWebhookPayload } from "@/lib/assemblyai"
import { logApiUsage } from "@/lib/api-usage"

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * AssemblyAI webhook endpoint.
 * Called by AssemblyAI when podcast transcription completes.
 * Public route (no auth) — validated by matching transcript_id to a content row.
 */
export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    console.error("WEBHOOK: Supabase not configured")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
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
  if (!transcript_id) {
    return NextResponse.json({ error: "Missing transcript_id" }, { status: 400 })
  }

  console.log(`WEBHOOK: Received AssemblyAI callback for transcript ${transcript_id}, status: ${status}`)

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
    console.error(`WEBHOOK: Transcription failed for ${content.id}: ${payload.error}`)

    await supabase
      .from("content")
      .update({ full_text: `PROCESSING_FAILED::TRANSCRIPTION::${payload.error || "Unknown error"}` })
      .eq("id", content.id)

    await supabase
      .from("summaries")
      .upsert(
        {
          content_id: content.id,
          user_id: content.user_id!,
          processing_status: "error",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "content_id" },
      )

    return NextResponse.json({ success: false, message: "Transcription failed" })
  }

  // Format transcript with speaker labels
  const { full_text, duration_seconds, speaker_count } = formatTranscript(payload)

  if (!full_text) {
    console.error(`WEBHOOK: Empty transcript for content ${content.id}`)

    await supabase
      .from("content")
      .update({ full_text: "PROCESSING_FAILED::TRANSCRIPTION::Empty transcript" })
      .eq("id", content.id)

    await supabase
      .from("summaries")
      .upsert(
        {
          content_id: content.id,
          user_id: content.user_id!,
          processing_status: "error",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "content_id" },
      )

    return NextResponse.json({ success: false, message: "Empty transcript" })
  }

  console.log(
    `WEBHOOK: Transcript ready for ${content.id}. Duration: ${duration_seconds}s, Speakers: ${speaker_count}, Length: ${full_text.length} chars`,
  )

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

  // Trigger AI analysis by calling process-content internally
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000")

  try {
    console.log(`WEBHOOK: Triggering AI analysis for content ${content.id}`)
    const analysisResponse = await fetch(`${appUrl}/api/process-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_id: content.id }),
    })

    if (!analysisResponse.ok) {
      const errorData = await analysisResponse.json().catch(() => ({}))
      console.error(`WEBHOOK: AI analysis trigger failed for ${content.id}:`, errorData)
    } else {
      console.log(`WEBHOOK: AI analysis triggered for ${content.id}`)
    }
  } catch (error) {
    console.error(`WEBHOOK: Failed to trigger AI analysis for ${content.id}:`, error)
  }

  return NextResponse.json({ success: true, content_id: content.id })
}

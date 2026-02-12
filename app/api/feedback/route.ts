/**
 * @module api/feedback
 * @description Section-level feedback on analysis quality.
 *
 * POST — Upsert feedback (thumbs up/down) for a specific analysis section
 * GET  — Fetch all feedback for a content item by the current user
 *
 * Also supports claim-level flags on truth check issues when claim_index is provided.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth"
import { z } from "zod"

const VALID_SECTIONS = ["overview", "triage", "takeaways", "accuracy", "action_items", "detailed"] as const

const feedbackSchema = z.object({
  content_id: z.string().uuid(),
  section_type: z.enum(VALID_SECTIONS),
  is_helpful: z.boolean().nullable(),
  claim_index: z.number().int().min(0).nullable().optional(),
  flag_reason: z.string().max(500).nullable().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = feedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid feedback data", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { content_id, section_type, is_helpful, claim_index, flag_reason } = parsed.data

  // Upsert: unique on (content_id, user_id, section_type, claim_index)
  // claim_index defaults to -1 for section-level feedback (NULL doesn't work well with UNIQUE)
  const effectiveClaimIndex = claim_index ?? -1

  const { data, error } = await supabase
    .from("section_feedback")
    .upsert(
      {
        content_id,
        user_id: user.id,
        section_type,
        is_helpful,
        claim_index: effectiveClaimIndex === -1 ? null : effectiveClaimIndex,
        flag_reason: flag_reason ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "content_id,user_id,section_type,claim_index" }
    )
    .select("id, section_type, is_helpful, claim_index, flag_reason")
    .single()

  if (error) {
    console.error("[feedback] POST error:", error.message)
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 })
  }

  return NextResponse.json({ feedback: data })
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  const contentId = request.nextUrl.searchParams.get("content_id")
  if (!contentId) {
    return NextResponse.json({ error: "content_id is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("section_feedback")
    .select("id, section_type, is_helpful, claim_index, flag_reason, created_at")
    .eq("content_id", contentId)
    .eq("user_id", user.id)

  if (error) {
    console.error("[feedback] GET error:", error.message)
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 })
  }

  return NextResponse.json({ feedback: data ?? [] })
}

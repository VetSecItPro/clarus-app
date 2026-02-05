import { NextRequest, NextResponse } from "next/server"
import { authenticateAdmin, getAdminClient } from "@/lib/auth"
import { checkRateLimit } from "@/lib/validation"
import { z } from "zod"
import { parseBody } from "@/lib/schemas"

/**
 * GET /api/admin/flagged-content
 * Returns all flagged content items for admin review.
 *
 * PATCH /api/admin/flagged-content
 * Update a flagged content item (review, report, dismiss).
 */

export async function GET() {
  const auth = await authenticateAdmin()
  if (!auth.success) return auth.response

  // SECURITY: FIX-SEC-015 — Rate limit admin flagged content endpoint
  const rateCheck = checkRateLimit(`admin-flagged:${auth.user.id}`, 30, 60000)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateCheck.resetIn / 1000)) } }
    )
  }

  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from("flagged_content")
    .select("id, content_id, user_id, url, content_type, flag_source, flag_reason, flag_categories, severity, user_ip, content_hash, scraped_text_preview, status, review_notes, reviewed_by, reviewed_at, reported_to, report_reference, reported_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Failed to fetch flagged content:", error)
    return NextResponse.json({ error: "Failed to fetch flagged content" }, { status: 500 })
  }

  // Compute counts from the already-fetched data instead of a second query
  const items = data || []
  const counts = {
    total: items.length,
    pending: items.filter(f => f.status === "pending").length,
    critical: items.filter(f => f.severity === "critical").length,
    reported: items.filter(f => f.status === "reported").length,
  }

  // FIX-014: Prevent caching of sensitive admin/user-specific data
  const response = NextResponse.json({ items, counts })
  response.headers.set("Cache-Control", "no-store, private")
  return response
}

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["reviewed", "reported", "dismissed"]),
  review_notes: z.string().max(2000).optional(),
  reported_to: z.string().max(100).optional(),
  report_reference: z.string().max(200).optional(),
})

export async function PATCH(request: NextRequest) {
  const auth = await authenticateAdmin()
  if (!auth.success) return auth.response

  const validation = await parseBody(updateSchema, request)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { id, status, review_notes, reported_to, report_reference } = validation.data
  const supabase = getAdminClient()

  const updatePayload: Record<string, unknown> = {
    status,
    reviewed_by: auth.user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (review_notes !== undefined) updatePayload.review_notes = review_notes

  if (status === "reported") {
    if (reported_to) updatePayload.reported_to = reported_to
    if (report_reference) updatePayload.report_reference = report_reference
    updatePayload.reported_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from("flagged_content")
    .update(updatePayload)
    .eq("id", id)

  if (error) {
    console.error("Failed to update flagged content:", error)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }

  // SECURITY: FIX-SEC-018 — Audit log for admin actions on flagged content
  console.warn(`[ADMIN_AUDIT] action=${status} admin=${auth.user.id} content=${id}`)

  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from "next/server"
import { authenticateAdmin, getAdminClient } from "@/lib/auth"
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

  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from("flagged_content")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Failed to fetch flagged content:", error)
    return NextResponse.json({ error: "Failed to fetch flagged content" }, { status: 500 })
  }

  // Also get counts by status for the header
  const { data: allFlags } = await supabase
    .from("flagged_content")
    .select("status, severity")

  const counts = {
    total: allFlags?.length || 0,
    pending: allFlags?.filter(f => f.status === "pending").length || 0,
    critical: allFlags?.filter(f => f.severity === "critical").length || 0,
    reported: allFlags?.filter(f => f.status === "reported").length || 0,
  }

  return NextResponse.json({ items: data || [], counts })
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

  return NextResponse.json({ success: true })
}

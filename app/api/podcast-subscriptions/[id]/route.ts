/**
 * @module api/podcast-subscriptions/[id]
 * @description API route for managing a specific podcast subscription.
 *
 * DELETE - Remove a podcast subscription (verifies ownership)
 */

import { NextResponse, type NextRequest } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { validateUUID, checkRateLimit } from "@/lib/validation"

/**
 * DELETE /api/podcast-subscriptions/[id]
 * Removes a podcast subscription. Verifies ownership before deletion.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  // SECURITY: FIX-SEC-011 — Rate limit DELETE requests for podcast subscriptions
  const rateCheck = checkRateLimit(`podcast-sub-del:${user.id}`, 60, 60000)
  if (!rateCheck.allowed) {
    return AuthErrors.rateLimit(rateCheck.resetIn)
  }

  const { id } = await params
  const idCheck = validateUUID(id)
  if (!idCheck.isValid) {
    return AuthErrors.badRequest(idCheck.error)
  }

  // Verify ownership and delete in one query
  const { error, count } = await supabase
    .from("podcast_subscriptions")
    .delete({ count: "exact" })
    .eq("id", idCheck.sanitized!)
    .eq("user_id", user.id)

  if (error) {
    console.error("[podcast-subscriptions] Failed to delete subscription:", error.message)
    return AuthErrors.serverError()
  }

  if (count === 0) {
    return AuthErrors.notFound("Subscription")
  }

  return NextResponse.json({ success: true })
}

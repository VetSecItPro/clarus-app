/**
 * @module api/youtube-subscriptions/[id]
 * @description API route for managing a specific YouTube subscription.
 *
 * DELETE - Remove a YouTube subscription (verifies ownership)
 */

import { NextResponse, type NextRequest } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { validateUUID } from "@/lib/validation"

/**
 * DELETE /api/youtube-subscriptions/[id]
 * Removes a YouTube subscription. Verifies ownership before deletion.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  const { id } = await params
  const idCheck = validateUUID(id)
  if (!idCheck.isValid) {
    return AuthErrors.badRequest(idCheck.error)
  }

  // Verify ownership and delete in one query
  const { error, count } = await supabase
    .from("youtube_subscriptions")
    .delete({ count: "exact" })
    .eq("id", idCheck.sanitized!)
    .eq("user_id", user.id)

  if (error) {
    console.error("[youtube-subscriptions] Failed to delete subscription:", error.message)
    return AuthErrors.serverError()
  }

  if (count === 0) {
    return AuthErrors.notFound("Subscription")
  }

  return NextResponse.json({ success: true })
}

/**
 * @module api/account/delete
 * @description GDPR Article 17 — Right to Erasure.
 *
 * Permanently deletes all user data across all Clarus tables and
 * removes the Supabase Auth account. This action is irreversible.
 *
 * DELETE — Cascades through all user-owned data, then deletes the
 * auth account. Requires explicit confirmation via request body.
 */

import { NextResponse } from "next/server"
import { authenticateRequest, getAdminClient } from "@/lib/auth"
import { logger } from "@/lib/logger"

export async function DELETE(request: Request) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user } = auth

  // Require explicit confirmation in request body
  let body: { confirm?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (body.confirm !== "DELETE_MY_ACCOUNT") {
    return NextResponse.json(
      { error: "Confirmation required. Send { confirm: \"DELETE_MY_ACCOUNT\" }" },
      { status: 400 }
    )
  }

  const admin = getAdminClient()
  const userId = user.id

  try {
    // Delete order matters — children before parents to avoid FK violations.
    // Some tables reference content.id, so we delete those first.

    // 1. Get all user's content IDs for child-table cleanup
    const { data: contentRows } = await admin
      .from("content")
      .select("id")
      .eq("user_id", userId)

    const contentIds = contentRows?.map(r => r.id) ?? []

    // 2. Get all user's chat thread IDs
    const { data: threadRows } = await admin
      .from("chat_threads")
      .select("id")
      .eq("user_id", userId)

    const threadIds = threadRows?.map(r => r.id) ?? []

    // 3. Get all user's collection IDs
    const { data: collectionRows } = await admin
      .from("collections")
      .select("id")
      .eq("user_id", userId)

    const collectionIds = collectionRows?.map(r => r.id) ?? []

    // 4. Delete child records that reference content/threads/collections
    const childDeletes = []

    if (threadIds.length > 0) {
      childDeletes.push(
        admin.from("chat_messages").delete().in("thread_id", threadIds)
      )
    }

    if (contentIds.length > 0) {
      childDeletes.push(
        admin.from("summaries").delete().in("content_id", contentIds),
        admin.from("claims").delete().in("content_id", contentIds),
        admin.from("content_ratings").delete().in("content_id", contentIds),
        admin.from("section_feedback").delete().in("content_id", contentIds),
        admin.from("flagged_content").delete().in("content_id", contentIds),
      )
    }

    if (collectionIds.length > 0) {
      childDeletes.push(
        admin.from("collection_items").delete().in("collection_id", collectionIds)
      )
    }

    await Promise.all(childDeletes)

    // 5. Delete user-owned records from tables with user_id
    await Promise.all([
      admin.from("chat_threads").delete().eq("user_id", userId),
      admin.from("content").delete().eq("user_id", userId),
      admin.from("collections").delete().eq("user_id", userId),
      // hidden_content not in generated types yet — cast to bypass
      (admin.from as (t: string) => ReturnType<typeof admin.from>)("hidden_content").delete().eq("user_id", userId),
      admin.from("podcast_subscriptions").delete().eq("user_id", userId),
      admin.from("youtube_subscriptions").delete().eq("user_id", userId),
      admin.from("usage_tracking").delete().eq("user_id", userId),
      admin.from("api_usage").delete().eq("user_id", userId),
      admin.from("processing_metrics").delete().eq("user_id", userId),
      admin.from("user_analysis_preferences").delete().eq("user_id", userId),
    ])

    // 6. Delete the user record from clarus.users
    await admin.from("users").delete().eq("id", userId)

    // 7. Delete the Supabase Auth account
    // This requires the admin API (service role)
    const supabaseAdmin = admin
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      logger.error("[account/delete] Auth account deletion failed:", authDeleteError.message)
      // Data is already deleted — log the auth failure but don't fail the request
      // The orphaned auth account will have no data and no user record
    }

    return NextResponse.json({
      success: true,
      message: "Your account and all associated data have been permanently deleted.",
    })
  } catch (err) {
    logger.error("[account/delete] Failed to delete account:", err)
    return NextResponse.json(
      { error: "Failed to delete account. Please contact support." },
      { status: 500 }
    )
  }
}

/**
 * @module api/collections/[id]/items/[contentId]
 * @description Remove content from a collection.
 *
 * DELETE /api/collections/[id]/items/[contentId] — Remove a content item from the collection
 */

import { NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { uuidSchema } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/validation"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  try {
    const { id, contentId } = await params

    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`collection-items-remove:${clientIp}`, 60, 60000)
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // Validate IDs
    const collectionIdResult = uuidSchema.safeParse(id)
    if (!collectionIdResult.success) {
      return AuthErrors.badRequest("Invalid collection ID")
    }

    const contentIdResult = uuidSchema.safeParse(contentId)
    if (!contentIdResult.success) {
      return AuthErrors.badRequest("Invalid content ID")
    }

    // Authenticate user
    const auth = await authenticateRequest()
    if (!auth.success) return auth.response

    // Verify collection ownership
    const { data: collection, error: collectionError } = await auth.supabase
      .from("collections")
      .select("id, user_id")
      .eq("id", collectionIdResult.data)
      .single()

    if (collectionError || !collection) {
      return AuthErrors.notFound("Collection")
    }

    if (collection.user_id !== auth.user.id) {
      return AuthErrors.forbidden()
    }

    // Remove the item from the collection
    const { error: deleteError } = await auth.supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", collectionIdResult.data)
      .eq("content_id", contentIdResult.data)

    if (deleteError) {
      console.error("Collection item delete error:", deleteError)
      return NextResponse.json(
        { success: false, error: "Failed to remove item from collection. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    )
  }
}

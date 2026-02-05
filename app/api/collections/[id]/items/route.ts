/**
 * @module api/collections/[id]/items
 * @description Add content to a collection.
 *
 * POST /api/collections/[id]/items — Add a content item to the collection
 */

import { NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { uuidSchema, addToCollectionSchema, parseBody } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/validation"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`collection-items-add:${clientIp}`, 60, 60000)
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // Validate collection ID
    const idResult = uuidSchema.safeParse(id)
    if (!idResult.success) {
      return AuthErrors.badRequest("Invalid collection ID")
    }

    // Authenticate user
    const auth = await authenticateRequest()
    if (!auth.success) return auth.response

    // Validate request body
    const body = await request.json()
    const validation = parseBody(addToCollectionSchema, body)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    // Verify collection ownership
    const { data: collection, error: collectionError } = await auth.supabase
      .from("collections")
      .select("id, user_id")
      .eq("id", idResult.data)
      .single()

    if (collectionError || !collection) {
      return AuthErrors.notFound("Collection")
    }

    if (collection.user_id !== auth.user.id) {
      return AuthErrors.forbidden()
    }

    // Verify content ownership
    const { data: content, error: contentError } = await auth.supabase
      .from("content")
      .select("id, user_id")
      .eq("id", validation.data.content_id)
      .single()

    if (contentError || !content) {
      return AuthErrors.notFound("Content")
    }

    if (content.user_id !== auth.user.id) {
      return AuthErrors.forbidden()
    }

    // Add the item to the collection
    const { data: item, error: insertError } = await auth.supabase
      .from("collection_items")
      .insert({
        collection_id: idResult.data,
        content_id: validation.data.content_id,
      })
      .select("id, collection_id, content_id, added_at, sort_order")
      .single()

    if (insertError) {
      // Handle duplicate (item already in collection)
      if (insertError.code === "23505") {
        return AuthErrors.badRequest("This content is already in this collection")
      }
      console.error("Collection item insert error:", insertError)
      return NextResponse.json(
        { success: false, error: "Failed to add item to collection. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, item }, { status: 201 })
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    )
  }
}

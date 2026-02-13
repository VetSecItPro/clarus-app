/**
 * @module api/collections/[id]
 * @description Update or delete a specific collection.
 *
 * PATCH  /api/collections/[id] — Update collection metadata (name, description, color, icon)
 * DELETE /api/collections/[id] — Delete a collection (items are unlinked, not deleted)
 */

import { NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { uuidSchema, updateCollectionSchema, parseBody } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = await checkRateLimit(`collections-update:${clientIp}`, 30, 60000)
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
    const validation = parseBody(updateCollectionSchema, body)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    // Verify collection ownership
    const { data: existing, error: fetchError } = await auth.supabase
      .from("collections")
      .select("id, user_id")
      .eq("id", idResult.data)
      .single()

    if (fetchError || !existing) {
      return AuthErrors.notFound("Collection")
    }

    if (existing.user_id !== auth.user.id) {
      return AuthErrors.forbidden()
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, string | null> = {}
    if (validation.data.name !== undefined) updateData.name = validation.data.name
    if (validation.data.description !== undefined) updateData.description = validation.data.description ?? null
    if (validation.data.color !== undefined) updateData.color = validation.data.color ?? null
    if (validation.data.icon !== undefined) updateData.icon = validation.data.icon ?? null

    if (Object.keys(updateData).length === 0) {
      return AuthErrors.badRequest("No fields to update")
    }

    // Update the collection
    const { data: collection, error: updateError } = await auth.supabase
      .from("collections")
      .update(updateData)
      .eq("id", idResult.data)
      .select("id, name, description, color, icon, is_default, item_count, created_at, updated_at")
      .single()

    if (updateError) {
      // Handle unique constraint violation (duplicate name)
      if (updateError.code === "23505") {
        return AuthErrors.badRequest("A collection with this name already exists")
      }
      logger.error("Collection update error:", updateError)
      return NextResponse.json(
        { success: false, error: "Failed to update collection. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, collection })
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = await checkRateLimit(`collections-delete:${clientIp}`, 10, 60000)
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

    // Verify collection ownership
    const { data: existing, error: fetchError } = await auth.supabase
      .from("collections")
      .select("id, user_id")
      .eq("id", idResult.data)
      .single()

    if (fetchError || !existing) {
      return AuthErrors.notFound("Collection")
    }

    if (existing.user_id !== auth.user.id) {
      return AuthErrors.forbidden()
    }

    // Delete the collection (CASCADE removes collection_items, content is preserved)
    const { error: deleteError } = await auth.supabase
      .from("collections")
      .delete()
      .eq("id", idResult.data)

    if (deleteError) {
      logger.error("Collection delete error:", deleteError)
      return NextResponse.json(
        { success: false, error: "Failed to delete collection. Please try again." },
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

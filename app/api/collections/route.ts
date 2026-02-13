/**
 * @module api/collections
 * @description List and create content collections.
 *
 * GET  /api/collections — List user's collections with item counts
 * POST /api/collections — Create a new collection (validates name, checks tier limit)
 */

import { NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { createCollectionSchema, parseBody } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/rate-limit"
import { getUserTier } from "@/lib/usage"
import { TIER_LIMITS } from "@/lib/tier-limits"
import { logger } from "@/lib/logger"

export async function GET(request: Request) {
  try {
    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = await checkRateLimit(`collections-list:${clientIp}`, 30, 60000)
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // Authenticate user
    const auth = await authenticateRequest()
    if (!auth.success) return auth.response

    // Fetch user's collections ordered by creation date
    const { data: collections, error } = await auth.supabase
      .from("collections")
      .select("id, name, description, color, icon, is_default, item_count, created_at, updated_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: true })
      .limit(200)

    if (error) {
      logger.error("Collections fetch error:", error)
      return NextResponse.json(
        { success: false, error: "Failed to fetch collections. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, collections: collections ?? [] },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = await checkRateLimit(`collections-create:${clientIp}`, 10, 60000)
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // Authenticate user
    const auth = await authenticateRequest()
    if (!auth.success) return auth.response

    // Validate request body
    const body = await request.json()
    const validation = parseBody(createCollectionSchema, body)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    // PERF: Parallelize tier check and collection count instead of sequential queries
    const [tier, countResult] = await Promise.all([
      getUserTier(auth.supabase, auth.user.id),
      auth.supabase
        .from("collections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id),
    ])

    const collectionsLimit = TIER_LIMITS[tier].collections

    if (countResult.error) {
      logger.error("Collections count error:", countResult.error)
      return AuthErrors.serverError()
    }

    const count = countResult.count
    if ((count ?? 0) >= collectionsLimit) {
      return NextResponse.json(
        {
          success: false,
          error: `Collection limit reached (${collectionsLimit} on ${tier} tier). Upgrade for more.`,
          upgrade_required: true,
          tier,
        },
        { status: 403 }
      )
    }

    // Create the collection
    const { data: collection, error: insertError } = await auth.supabase
      .from("collections")
      .insert({
        user_id: auth.user.id,
        name: validation.data.name,
        description: validation.data.description ?? null,
        color: validation.data.color ?? null,
        icon: validation.data.icon ?? null,
      })
      .select("id, name, description, color, icon, is_default, item_count, created_at, updated_at")
      .single()

    if (insertError) {
      // Handle unique constraint violation (duplicate name)
      if (insertError.code === "23505") {
        return AuthErrors.badRequest("A collection with this name already exists")
      }
      logger.error("Collection insert error:", insertError)
      return NextResponse.json(
        { success: false, error: "Failed to create collection. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, collection }, { status: 201 })
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    )
  }
}

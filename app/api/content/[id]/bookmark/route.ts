import { NextResponse } from "next/server"
import { authenticateRequest, verifyContentOwnership, AuthErrors } from "@/lib/auth"
import { uuidSchema, bookmarkUpdateSchema, parseBody } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/rate-limit"
import { enforceAndIncrementUsage } from "@/lib/usage"
import { logger } from "@/lib/logger"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = await checkRateLimit(`bookmark:${clientIp}`, 30, 60000) // 30 requests per minute
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // Validate content ID
    const idResult = uuidSchema.safeParse(id)
    if (!idResult.success) {
      return AuthErrors.badRequest("Invalid content ID")
    }

    // Authenticate user
    const auth = await authenticateRequest()
    if (!auth.success) {
      return auth.response
    }

    // Verify ownership
    const ownership = await verifyContentOwnership(auth.supabase, auth.user.id, idResult.data)
    if (!ownership.owned) {
      return ownership.response
    }

    // Validate request body
    const body = await request.json()
    const validation = parseBody(bookmarkUpdateSchema, body)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    // Atomic usage check + increment only when adding a bookmark (not removing)
    if (validation.data.is_bookmarked) {
      const usageCheck = await enforceAndIncrementUsage(auth.supabase, auth.user.id, "bookmarks_count")
      if (!usageCheck.allowed) {
        return NextResponse.json(
          { success: false, error: `Monthly bookmark limit reached (${usageCheck.limit}). Upgrade for more.`, upgrade_required: true, tier: usageCheck.tier },
          { status: 403 }
        )
      }
    }

    // Update bookmark status
    const { data, error } = await auth.supabase
      .from("content")
      .update({ is_bookmarked: validation.data.is_bookmarked })
      .eq("id", idResult.data)
      .select("id, is_bookmarked")
      .single()

    if (error) {
      logger.error("Bookmark update error:", error)
      return NextResponse.json({ success: false, error: "Failed to update bookmark. Please try again." }, { status: 500 })
    }

    // Usage already incremented atomically by enforceAndIncrementUsage() above

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }
}

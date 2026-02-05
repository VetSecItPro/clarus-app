import { NextResponse } from "next/server"
import { authenticateRequest, verifyContentOwnership, AuthErrors } from "@/lib/auth"
import { uuidSchema } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/validation"

/**
 * POST /api/content/[id]/publish
 * Toggle content public/private for the discovery feed.
 * Only the content owner can toggle this.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Rate limiting
    const clientIp = _request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`publish:${clientIp}`, 20, 60000)
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
    if (!auth.success) return auth.response

    // Verify ownership
    const ownership = await verifyContentOwnership(auth.supabase, auth.user.id, idResult.data)
    if (!ownership.owned) return ownership.response

    // Get current is_public state
    const { data: currentContent, error: fetchError } = await auth.supabase
      .from("content")
      .select("is_public")
      .eq("id", idResult.data)
      .single()

    if (fetchError || !currentContent) {
      return AuthErrors.notFound("Content")
    }

    // Toggle is_public
    const newState = !(currentContent.is_public ?? false)

    const { data, error } = await auth.supabase
      .from("content")
      .update({ is_public: newState })
      .eq("id", idResult.data)
      .select("id, is_public")
      .single()

    if (error) {
      console.error("Publish toggle error:", error)
      return AuthErrors.serverError()
    }

    return NextResponse.json({
      success: true,
      is_public: data.is_public,
    })
  } catch {
    return AuthErrors.serverError()
  }
}

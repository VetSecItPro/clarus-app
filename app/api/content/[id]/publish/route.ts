import { NextResponse } from "next/server"
import { authenticateRequest, verifyContentOwnership, AuthErrors } from "@/lib/auth"
import { uuidSchema } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/validation"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`publish:${clientIp}`, 20, 60000)
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    const idResult = uuidSchema.safeParse(id)
    if (!idResult.success) {
      return AuthErrors.badRequest("Invalid content ID")
    }

    const auth = await authenticateRequest()
    if (!auth.success) {
      return auth.response
    }

    const ownership = await verifyContentOwnership(auth.supabase, auth.user.id, idResult.data)
    if (!ownership.owned) {
      return ownership.response
    }

    const body = await request.json()
    const isPublic = Boolean(body.is_public)

    const { error } = await auth.supabase
      .from("content")
      .update({ is_public: isPublic })
      .eq("id", idResult.data)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, is_public: isPublic })
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

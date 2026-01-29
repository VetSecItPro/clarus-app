import { NextResponse } from "next/server"
import { authenticateRequest, getAdminClient, AuthErrors } from "@/lib/auth"
import { updateNameSchema, parseBody } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/validation"

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`update-name:${clientIp}`, 10, 60000) // 10 requests per minute
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // Authenticate user - get userId from session, NOT from body
    const auth = await authenticateRequest()
    if (!auth.success) {
      return auth.response
    }

    const userId = auth.user.id

    // Validate request body
    const body = await request.json()
    const validation = parseBody(updateNameSchema, body)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    const validatedName = validation.data.name

    // Use admin client for cross-user uniqueness check
    const supabaseAdmin = getAdminClient()

    // Check if name is already taken by another user
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("name", validatedName)
      .neq("id", userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: false, error: "Name is already taken" }, { status: 409 })
    }

    // Update the name using admin client (to bypass RLS if needed)
    const { error } = await supabaseAdmin
      .from("users")
      .update({ name: validatedName })
      .eq("id", userId)

    if (error) {
      console.error("Update name error:", error)
      return NextResponse.json({ success: false, error: "Failed to update name. Please try again." }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }
}

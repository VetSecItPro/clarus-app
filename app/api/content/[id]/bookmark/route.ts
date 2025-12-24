import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { validateContentId, checkRateLimit } from "@/lib/validation"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`bookmark:${clientIp}`, 30, 60000) // 30 requests per minute
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    // Validate content ID
    const idValidation = validateContentId(id)
    if (!idValidation.isValid) {
      return NextResponse.json({ success: false, error: idValidation.error }, { status: 400 })
    }

    const { is_bookmarked } = await request.json()

    if (typeof is_bookmarked !== "boolean") {
      return NextResponse.json(
        { success: false, error: "is_bookmarked must be a boolean" },
        { status: 400 }
      )
    }

    // Update bookmark status
    const { data, error } = await supabaseAdmin
      .from("content")
      .update({ is_bookmarked })
      .eq("id", idValidation.sanitized)
      .select("id, is_bookmarked")
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }
}

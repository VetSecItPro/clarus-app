import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { validateUserId, validateUsername, checkRateLimit } from "@/lib/validation"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`update-name:${clientIp}`, 10, 60000) // 10 requests per minute
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    const { userId, name } = await request.json()

    // Validate userId
    const userIdValidation = validateUserId(userId)
    if (!userIdValidation.isValid) {
      return NextResponse.json({ success: false, error: userIdValidation.error }, { status: 400 })
    }

    // Validate username
    const usernameValidation = validateUsername(name)
    if (!usernameValidation.isValid) {
      return NextResponse.json({ success: false, error: usernameValidation.error }, { status: 400 })
    }

    const validatedUserId = userIdValidation.sanitized!
    const validatedName = usernameValidation.sanitized!

    // Check if name is already taken
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("name", validatedName)
      .neq("id", validatedUserId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: false, error: "Name is already taken" }, { status: 409 })
    }

    // Update the name
    const { error } = await supabaseAdmin.from("users").update({ name: validatedName }).eq("id", validatedUserId)

    if (error) {
      console.error("Update name error:", error)
      return NextResponse.json({ success: false, error: "Failed to update name. Please try again." }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }
}

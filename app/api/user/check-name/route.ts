import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { validateUsername, validateUserId, checkRateLimit } from "@/lib/validation"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: Request) {
  // Rate limiting
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rateLimit = checkRateLimit(`check-name:${clientIp}`, 60, 60000) // 60 requests per minute (frequent checks while typing)
  if (!rateLimit.allowed) {
    return NextResponse.json({ available: false, error: "Too many requests" }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const name = searchParams.get("name")
  const currentUserId = searchParams.get("userId")

  // Validate name
  const nameValidation = validateUsername(name || "")
  if (!nameValidation.isValid) {
    return NextResponse.json({ available: false, error: nameValidation.error }, { status: 400 })
  }

  // Validate userId if provided
  let validatedUserId = ""
  if (currentUserId) {
    const userIdValidation = validateUserId(currentUserId)
    if (userIdValidation.isValid) {
      validatedUserId = userIdValidation.sanitized!
    }
  }

  // Check if name is taken by another user
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("name", nameValidation.sanitized!)
    .neq("id", validatedUserId)
    .maybeSingle()

  if (error) {
    console.error("Check name error:", error)
    return NextResponse.json({ available: false, error: "Unable to check name availability. Please try again." }, { status: 500 })
  }

  return NextResponse.json({ available: !data })
}

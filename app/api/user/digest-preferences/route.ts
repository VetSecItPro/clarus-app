import { NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { digestPreferencesSchema, parseBody } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/validation"

/**
 * GET /api/user/digest-preferences
 * Get current user's digest preferences
 */
export async function GET(request: Request) {
  // Rate limiting — 30 req/min per IP
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rateLimit = checkRateLimit(`digest-prefs:${clientIp}`, 30, 60000)
  if (!rateLimit.allowed) {
    return AuthErrors.rateLimit(rateLimit.resetIn)
  }

  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  const { data, error } = await auth.supabase
    .from("users")
    .select("digest_enabled")
    .eq("id", auth.user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
  }

  const response = NextResponse.json({
    success: true,
    digest_enabled: data.digest_enabled ?? true,
  })
  response.headers.set("Cache-Control", "private, max-age=60")
  return response
}

/**
 * PATCH /api/user/digest-preferences
 * Update digest preferences
 */
export async function PATCH(request: Request) {
  // Rate limiting — 10 writes/min per IP
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rateLimit = checkRateLimit(`digest-prefs-write:${clientIp}`, 10, 60000)
  if (!rateLimit.allowed) {
    return AuthErrors.rateLimit(rateLimit.resetIn)
  }

  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  const body = await request.json()
  const validation = parseBody(digestPreferencesSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from("users")
    .update({ digest_enabled: validation.data.digest_enabled })
    .eq("id", auth.user.id)

  if (error) {
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    digest_enabled: validation.data.digest_enabled,
  })
}

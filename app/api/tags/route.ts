import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { authenticateRequest } from "@/lib/auth"
import { logger } from "@/lib/logger"

// GET all unique tags for the authenticated user's content
export async function GET(request: Request) {
  try {
    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = await checkRateLimit(`tags-list:${clientIp}`, 30, 60000) // 30 requests per minute
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    // SECURITY: Use session client with RLS, not admin client — FIX-015 (admin client bypassed RLS)
    const auth = await authenticateRequest()
    if (!auth.success) return auth.response

    // PERF: Use SQL aggregation RPC instead of fetching 500 rows and counting in JS
    const { data: tags, error: tagError } = await (auth.supabase.rpc as CallableFunction)(
      "get_user_tag_counts",
      { p_user_id: auth.user.id, p_limit: 50 }
    )

    if (tagError) {
      logger.error("Tags fetch error:", tagError)
      return NextResponse.json({ success: false, error: "Failed to fetch tags. Please try again." }, { status: 500 })
    }

    return NextResponse.json(
      { success: true, tags },
      {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      }
    )
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }
}

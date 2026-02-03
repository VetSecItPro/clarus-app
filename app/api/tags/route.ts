import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/validation"
import { authenticateRequest } from "@/lib/auth"

// GET all unique tags for the authenticated user's content
export async function GET(request: Request) {
  try {
    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`tags-list:${clientIp}`, 30, 60000) // 30 requests per minute
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    // SECURITY: Use session client with RLS, not admin client — FIX-015 (admin client bypassed RLS)
    const auth = await authenticateRequest()
    if (!auth.success) return auth.response

    // Fetch tags only from user's own content (RLS enforces ownership)
    const { data: contentData, error: contentError } = await auth.supabase
      .from("content")
      .select("tags")
      .eq("user_id", auth.user.id)
      .not("tags", "eq", "{}")
      .limit(500)

    if (contentError) {
      console.error("Tags fetch error:", contentError)
      return NextResponse.json({ success: false, error: "Failed to fetch tags. Please try again." }, { status: 500 })
    }

    const tagCounts: Record<string, number> = {}
    contentData?.forEach((item) => {
      const tags = item.tags as string[] | null
      if (tags && Array.isArray(tags)) {
        tags.forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1
        })
      }
    })

    const tags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50) // Limit to top 50 tags

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

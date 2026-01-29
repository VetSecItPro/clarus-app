import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/validation"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "clarus" } }
)

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

    // Get authenticated user
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: {
          schema: "clarus",
        },
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    // Fetch tags only from user's own content
    const { data: contentData, error: contentError } = await supabaseAdmin
      .from("content")
      .select("tags")
      .eq("user_id", user.id)
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

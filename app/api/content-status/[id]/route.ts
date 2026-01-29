import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { validateContentId, checkRateLimit } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`content-status:${clientIp}`, 60, 60000) // 60 per minute
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      )
    }

    const { id } = await params

    // Validate content ID
    const idValidation = validateContentId(id)
    if (!idValidation.isValid) {
      return NextResponse.json(
        { error: "Invalid content ID" },
        { status: 400 }
      )
    }

    const contentId = idValidation.sanitized!

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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Fetch content
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("id, title, url, type, user_id, thumbnail_url, author, duration")
      .eq("id", contentId)
      .single()

    if (contentError || !content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    // Check ownership (user can only access their own content status)
    if (content.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Fetch summary
    const { data: summary } = await supabase
      .from("summaries")
      .select(
        "processing_status, triage, brief_overview, detailed_summary, truth_check, action_items"
      )
      .eq("content_id", contentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      id: content.id,
      title: content.title,
      url: content.url,
      type: content.type,
      thumbnail_url: content.thumbnail_url,
      author: content.author,
      duration: content.duration,
      processing_status: summary?.processing_status || "pending",
      triage: summary?.triage || null,
      brief_overview: summary?.brief_overview || null,
      detailed_summary: summary?.detailed_summary || null,
      truth_check: summary?.truth_check || null,
      action_items: summary?.action_items || null,
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { validateContentId, checkRateLimit } from "@/lib/validation"
import { authenticateRequest } from "@/lib/auth"

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

    // Authenticate using centralized helper
    const auth = await authenticateRequest()
    if (!auth.success) {
      return auth.response
    }

    // Fetch summary language from query params before parallel fetch
    const { searchParams } = new URL(request.url)
    const lang = searchParams.get("language") || "en"

    // PERF: Parallelize content and summary queries instead of running sequentially
    const [contentResult, summaryResult] = await Promise.all([
      auth.supabase
        .from("content")
        .select("id, title, url, type, user_id, thumbnail_url, author, duration")
        .eq("id", contentId)
        .single(),
      auth.supabase
        .from("summaries")
        .select(
          "processing_status, triage, brief_overview, mid_length_summary, detailed_summary, truth_check, action_items, language, created_at"
        )
        .eq("content_id", contentId)
        .eq("language", lang)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    ])

    const { data: content, error: contentError } = contentResult

    if (contentError || !content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    // Check ownership (user can only access their own content status)
    if (content.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const summary = summaryResult.data

    // Calculate analysis age for staleness warning
    const analysisAgeDays = summary?.created_at
      ? Math.floor((Date.now() - new Date(summary.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : null

    const response = NextResponse.json({
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
      mid_length_summary: summary?.mid_length_summary || null,
      detailed_summary: summary?.detailed_summary || null,
      truth_check: summary?.truth_check || null,
      action_items: summary?.action_items || null,
      analysis_age_days: analysisAgeDays,
    })
    response.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=30")
    return response
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

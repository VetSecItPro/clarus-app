// SECURITY: FIX-SEC-027 — Use authenticated client instead of admin client for public reads
import { NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import type { TriageData } from "@/types/database.types"
import { checkRateLimit } from "@/lib/validation"
import { z } from "zod"
import { parseQuery } from "@/lib/schemas"

/**
 * GET /api/discover
 * Lists public content feed with pagination, sorting, and filtering.
 * Requires authentication (authenticated users only).
 */

const discoverQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  sort: z.enum(["trending", "newest", "top"]).optional().default("trending"),
  type: z.enum(["youtube", "article", "podcast", "all"]).optional().default("all"),
  topic: z.string().trim().max(100).optional(),
})

export interface DiscoverFeedItem {
  id: string
  title: string
  url: string
  type: string
  voteScore: number
  authorName: string | null
  briefOverview: string
  qualityScore: number
  createdAt: string
  shareToken: string | null
  userVote: number | null
}

export async function GET(request: Request) {
  // Authenticate
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  // Rate limit: 30/minute per user
  const rateLimit = checkRateLimit(`discover:${auth.user.id}`, 30, 60000)
  if (!rateLimit.allowed) {
    return AuthErrors.rateLimit(rateLimit.resetIn)
  }

  // Parse query params
  const { searchParams } = new URL(request.url)
  const parsed = parseQuery(discoverQuerySchema, searchParams)
  if (!parsed.success) {
    return AuthErrors.badRequest(parsed.error)
  }

  const { page, limit, sort, type, topic } = parsed.data

  try {
    const offset = (page - 1) * limit

    // Build the query for public content (uses authenticated client — RLS allows reading is_public=true)
    let query = auth.supabase
      .from("content")
      .select("id, title, url, type, vote_score, date_added, share_token, user_id")
      .eq("is_public", true)
      .not("title", "like", "Analyzing:%")

    // Filter by type
    if (type !== "all") {
      query = query.eq("type", type)
    }

    // SECURITY: FIX-SEC-003 — Escape LIKE special characters to prevent injection
    if (topic) {
      const escapedTopic = topic.replace(/[%_\\]/g, '\\$&')
      query = query.ilike("title", `%${escapedTopic}%`)
    }

    // Sorting
    if (sort === "newest") {
      query = query.order("date_added", { ascending: false })
    } else if (sort === "top") {
      query = query.order("vote_score", { ascending: false })
    } else {
      // Trending: order by vote_score desc, then date_added desc
      // The actual trending score is computed client-side for flexibility
      query = query.order("vote_score", { ascending: false }).order("date_added", { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: publicContent, error: contentError } = await query

    if (contentError) {
      console.error("Discover fetch error:", contentError)
      return AuthErrors.serverError()
    }

    if (!publicContent || publicContent.length === 0) {
      return NextResponse.json({
        items: [],
        page,
        hasMore: false,
      })
    }

    // Fetch summaries for the content
    const contentIds = publicContent.map(c => c.id)
    const { data: summaries } = await auth.supabase
      .from("summaries")
      .select("content_id, brief_overview, triage")
      .in("content_id", contentIds)
      .eq("processing_status", "complete")
      .eq("language", "en")

    // Fetch author names
    const userIds = [...new Set(publicContent.map(c => c.user_id).filter(Boolean))] as string[]
    const { data: users } = await auth.supabase
      .from("users")
      .select("id, name")
      .in("id", userIds)

    // Fetch current user's votes
    const { data: userVotes } = await auth.supabase
      .from("content_votes")
      .select("content_id, vote")
      .eq("user_id", auth.user.id)
      .in("content_id", contentIds)

    const userVoteMap = new Map(
      userVotes?.map(v => [v.content_id, v.vote]) ?? []
    )
    const userMap = new Map(
      users?.map(u => [u.id, u.name]) ?? []
    )
    const summaryMap = new Map(
      summaries?.map(s => [s.content_id, s]) ?? []
    )

    // Build response items
    let items: DiscoverFeedItem[] = publicContent
      .map(content => {
        const summary = summaryMap.get(content.id)
        if (!summary) return null

        const triage = summary.triage as unknown as TriageData | null
        const qualityScore = triage?.quality_score ?? 0

        const rawOverview = summary.brief_overview || ""
        const briefOverview = rawOverview.length > 200
          ? rawOverview.slice(0, 200).trim() + "..."
          : rawOverview

        return {
          id: content.id,
          title: content.title || "Untitled",
          url: content.url,
          type: content.type || "article",
          voteScore: content.vote_score ?? 0,
          authorName: content.user_id ? userMap.get(content.user_id) ?? null : null,
          briefOverview,
          qualityScore,
          createdAt: content.date_added || new Date().toISOString(),
          shareToken: content.share_token,
          userVote: userVoteMap.get(content.id) ?? null,
        }
      })
      .filter((item): item is DiscoverFeedItem => item !== null)

    // Apply trending sort if needed (compute score with recency factor)
    if (sort === "trending") {
      const now = Date.now()
      items = items.sort((a, b) => {
        const hoursA = (now - new Date(a.createdAt).getTime()) / (1000 * 60 * 60)
        const hoursB = (now - new Date(b.createdAt).getTime()) / (1000 * 60 * 60)
        const scoreA = a.voteScore * 0.5 + (1 / (hoursA + 1)) * 0.5
        const scoreB = b.voteScore * 0.5 + (1 / (hoursB + 1)) * 0.5
        return scoreB - scoreA
      })
    }

    return NextResponse.json({
      items,
      page,
      hasMore: publicContent.length === limit,
    })
  } catch (error) {
    console.error("Discover API error:", error)
    return AuthErrors.serverError()
  }
}

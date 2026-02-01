import { NextRequest, NextResponse } from "next/server"
import { SupabaseClient } from "@supabase/supabase-js"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { searchSchema, parseQuery, parseBody } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/validation"
import { z } from "zod"
import type { Database } from "@/types/database.types"

/** Escape special LIKE/ILIKE characters to prevent pattern injection */
function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, (char) => `\\${char}`)
}

interface SearchResult {
  id: string
  title: string | null
  url: string
  type: string | null
  thumbnail_url: string | null
  date_added: string
  is_bookmarked: boolean
  tags: string[] | null
  brief_overview: string | null
  triage: Record<string, unknown> | null
  relevance: number
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rateLimit = checkRateLimit(`search:${clientIp}`, 60, 60000) // 60 per minute
  if (!rateLimit.allowed) {
    return AuthErrors.rateLimit(rateLimit.resetIn)
  }

  // Authenticate user - get user_id from session, NOT from query params
  const auth = await authenticateRequest()
  if (!auth.success) {
    return auth.response
  }

  // Validate query parameters
  const validation = parseQuery(searchSchema, request.nextUrl.searchParams)
  if (!validation.success) {
    return AuthErrors.badRequest(validation.error)
  }

  const { q: query, content_type: contentType, limit, offset } = validation.data

  try {
    // Use the authenticated user's ID - never trust query params for user identity
    const userId = auth.user.id

    // Use the full-text search function
    // Note: Using type assertion for custom RPC functions not in database types
    const { data, error } = await (auth.supabase.rpc as CallableFunction)("search_user_content", {
      p_user_id: userId,
      p_query: query,
      p_content_type: contentType || null,
      p_limit: limit,
      p_offset: offset,
    })

    if (error) {
      // If the function doesn't exist yet (migration not applied), fall back to ILIKE search
      if (error.message.includes("function") || error.code === "42883") {
        console.warn("Full-text search function not available, using fallback ILIKE search")
        return fallbackSearch(auth.supabase, userId, query, contentType || null, limit, offset)
      }
      throw error
    }

    const results = (data || []) as SearchResult[]

    const response = NextResponse.json({
      success: true,
      results,
      query,
      count: results.length,
    })
    response.headers.set("Cache-Control", "private, max-age=0, stale-while-revalidate=60")
    return response
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: "Failed to search content" },
      { status: 500 }
    )
  }
}

// Fallback to ILIKE search when full-text search function is not available
async function fallbackSearch(
  supabase: SupabaseClient<Database>,
  userId: string,
  query: string,
  contentType: string | null,
  limit: number,
  offset: number
) {
  let dbQuery = supabase
    .from("content")
    .select(`
      id,
      title,
      url,
      type,
      thumbnail_url,
      date_added,
      is_bookmarked,
      tags,
      summaries(brief_overview, triage)
    `)
    .eq("user_id", userId)
    .or(`title.ilike.%${escapeLikePattern(query)}%,full_text.ilike.%${escapeLikePattern(query)}%`)
    .order("date_added", { ascending: false })
    .range(offset, offset + limit - 1)

  if (contentType && contentType !== "all") {
    dbQuery = dbQuery.eq("type", contentType)
  }

  const { data, error } = await dbQuery

  if (error) throw error

  // Define type for the query result
  type ContentWithSummaries = {
    id: string
    title: string | null
    url: string
    type: string | null
    thumbnail_url: string | null
    date_added: string | null
    is_bookmarked: boolean | null
    tags: string[] | null
    summaries: { brief_overview: string | null; triage: Record<string, unknown> | null } | { brief_overview: string | null; triage: Record<string, unknown> | null }[] | null
  }

  // Transform to match SearchResult interface
  const results: SearchResult[] = ((data || []) as ContentWithSummaries[]).map((item) => {
    const summaryData = Array.isArray(item.summaries) ? item.summaries[0] : item.summaries
    return {
      id: item.id,
      title: item.title,
      url: item.url,
      type: item.type,
      thumbnail_url: item.thumbnail_url,
      date_added: item.date_added || new Date().toISOString(),
      is_bookmarked: item.is_bookmarked || false,
      tags: item.tags,
      brief_overview: summaryData?.brief_overview || null,
      triage: summaryData?.triage || null,
      relevance: 1, // No relevance ranking in fallback
    }
  })

  const response = NextResponse.json({
    success: true,
    results,
    query,
    count: results.length,
    fallback: true, // Indicate that fallback search was used
  })
  response.headers.set("Cache-Control", "private, max-age=0, stale-while-revalidate=60")
  return response
}

// Autocomplete suggestions schema
const suggestionsSchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(20).optional().default(5),
})

// Autocomplete suggestions endpoint
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`search-suggest:${clientIp}`, 120, 60000) // 120 per minute
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // Authenticate user
    const auth = await authenticateRequest()
    if (!auth.success) {
      return auth.response
    }

    // Validate body
    const body = await request.json()
    const validation = parseBody(suggestionsSchema, body)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    const { query, limit } = validation.data
    const userId = auth.user.id

    // Try to use the suggestions function
    // Note: Using type assertion for custom RPC functions not in database types
    const { data, error } = await (auth.supabase.rpc as CallableFunction)("search_content_suggestions", {
      p_user_id: userId,
      p_query: query,
      p_limit: limit,
    })

    if (error) {
      // Fallback to simple title ILIKE search
      if (error.message.includes("function") || error.code === "42883") {
        const { data: fallbackData } = await auth.supabase
          .from("content")
          .select("id, title, type")
          .eq("user_id", userId)
          .ilike("title", `%${escapeLikePattern(query)}%`)
          .limit(limit)

        return NextResponse.json({ success: true, suggestions: fallbackData || [], fallback: true })
      }
      throw error
    }

    return NextResponse.json({ success: true, suggestions: data || [] })
  } catch (error) {
    console.error("Suggestions error:", error)
    return NextResponse.json({ error: "Failed to get suggestions" }, { status: 500 })
  }
}

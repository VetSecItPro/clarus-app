import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")
  const userId = searchParams.get("user_id")
  const contentType = searchParams.get("type")
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 })
  }

  if (!userId) {
    return NextResponse.json({ error: "Query parameter 'user_id' is required" }, { status: 400 })
  }

  try {
    // Use untyped client for RPC calls to custom functions not in DB types
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Use the full-text search function
    const { data, error } = await supabase.rpc("search_user_content", {
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
        return fallbackSearch(supabase, userId, query, contentType, limit, offset)
      }
      throw error
    }

    const results = (data || []) as SearchResult[]

    return NextResponse.json({
      success: true,
      results,
      query,
      count: results.length,
    })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: "Failed to search content", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// Fallback to ILIKE search when full-text search function is not available
async function fallbackSearch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
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
    .or(`title.ilike.%${query}%,full_text.ilike.%${query}%`)
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

  return NextResponse.json({
    success: true,
    results,
    query,
    count: results.length,
    fallback: true, // Indicate that fallback search was used
  })
}

// Autocomplete suggestions endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, userId, limit = 5 } = body

    if (!query || !userId) {
      return NextResponse.json({ error: "query and userId are required" }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Try to use the suggestions function
    const { data, error } = await supabase.rpc("search_content_suggestions", {
      p_user_id: userId,
      p_query: query,
      p_limit: limit,
    })

    if (error) {
      // Fallback to simple title ILIKE search
      if (error.message.includes("function") || error.code === "42883") {
        const { data: fallbackData } = await supabase
          .from("content")
          .select("id, title, type")
          .eq("user_id", userId)
          .ilike("title", `%${query}%`)
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

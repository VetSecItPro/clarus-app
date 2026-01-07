import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET all unique tags across all content - optimized with SQL aggregation
export async function GET() {
  try {
    // Use SQL to aggregate tags server-side (much faster than client-side)
    const { data, error } = await supabaseAdmin.rpc('get_tag_counts')

    if (error) {
      // Fallback to client-side aggregation if RPC doesn't exist
      const { data: contentData, error: contentError } = await supabaseAdmin
        .from("content")
        .select("tags")
        .not("tags", "eq", "{}")
        .limit(500) // Limit to prevent excessive data transfer

      if (contentError) {
        return NextResponse.json({ success: false, error: contentError.message }, { status: 500 })
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
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        }
      )
    }

    // RPC returned successfully
    return NextResponse.json(
      { success: true, tags: data || [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }
}

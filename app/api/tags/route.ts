import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET all unique tags across all content
export async function GET() {
  try {
    // Get all content with non-empty tags
    const { data, error } = await supabaseAdmin
      .from("content")
      .select("tags")
      .not("tags", "eq", "{}")

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Flatten and get unique tags with counts
    const tagCounts: Record<string, number> = {}

    data?.forEach((item) => {
      const tags = item.tags as string[] | null
      if (tags && Array.isArray(tags)) {
        tags.forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1
        })
      }
    })

    // Convert to array sorted by count (most used first)
    const tags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json(
      { success: true, tags },
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

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { TriageData } from "@/types/database.types"

/**
 * GET /api/discover
 * Public endpoint — no auth required.
 * Returns top shared content from the last 7 days, anonymized.
 * Only includes content with a share_token (publicly shared by a user).
 */

let _client: ReturnType<typeof createClient<Database, "clarus">> | null = null
function getClient() {
  if (!_client) {
    _client = createClient<Database, "clarus">(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: "clarus" } }
    )
  }
  return _client
}

export interface DiscoverItem {
  title: string
  sourceUrl: string
  type: string
  shareToken: string
  shareUrl: string
  teaser: string
  qualityScore: number
  domain: string
  dateAdded: string
}

export async function GET() {
  try {
    const supabase = getClient()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch content that has been shared publicly in the last 7 days
    const { data: sharedContent, error: contentError } = await supabase
      .from("content")
      .select("id, title, url, type, share_token, date_added")
      .not("share_token", "is", null)
      .gte("date_added", sevenDaysAgo)
      .order("date_added", { ascending: false })
      .limit(50)

    if (contentError) {
      console.error("Discover fetch error:", contentError)
      return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 })
    }

    if (!sharedContent || sharedContent.length === 0) {
      return NextResponse.json({ items: [] }, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      })
    }

    // Fetch summaries for these content items
    const contentIds = sharedContent.map(c => c.id)
    const { data: summaries } = await supabase
      .from("summaries")
      .select("content_id, brief_overview, triage")
      .in("content_id", contentIds)
      .eq("processing_status", "complete")

    // Build scored items — zero user attribution
    const items: DiscoverItem[] = sharedContent
      .map(content => {
        const summary = summaries?.find(s => s.content_id === content.id)
        if (!summary) return null

        const triage = summary.triage as unknown as TriageData | null
        const qualityScore = triage?.quality_score ?? 0

        // Extract teaser from brief_overview (first 200 chars)
        const rawOverview = summary.brief_overview || ""
        const teaser = rawOverview.length > 200
          ? rawOverview.slice(0, 200).trim() + "..."
          : rawOverview

        // Extract domain from URL
        let domain = ""
        try {
          domain = new URL(content.url).hostname.replace(/^www\./, "")
        } catch {
          domain = "unknown"
        }

        return {
          title: content.title || "Untitled",
          sourceUrl: content.url,
          type: content.type || "article",
          shareToken: content.share_token!,
          shareUrl: `https://clarusapp.io/share/${content.share_token}`,
          teaser,
          qualityScore,
          domain,
          dateAdded: content.date_added || new Date().toISOString(),
        }
      })
      .filter((item): item is DiscoverItem => item !== null)
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, 20)

    return NextResponse.json({ items }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    })
  } catch (error) {
    console.error("Discover API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

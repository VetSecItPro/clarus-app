import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/auth"
import { sendDiscoveryNewsletterEmail } from "@/lib/email"
import type { TriageData } from "@/types/database.types"

/**
 * GET /api/crons/discovery-newsletter
 * Called by Vercel Cron every Sunday at 4pm UTC (2 hours after personal digest).
 * Sends a "Trending on Clarus" email to opted-in users featuring
 * the top publicly shared analyses from the past week.
 * Zero user attribution — completely anonymous curation.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("CRON_SECRET not configured")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Step 1: Get publicly shared content from the last 7 days
  const { data: sharedContent, error: contentError } = await supabase
    .from("content")
    .select("id, title, url, type, share_token, date_added")
    .not("share_token", "is", null)
    .gte("date_added", sevenDaysAgo)
    .order("date_added", { ascending: false })
    .limit(50)

  if (contentError) {
    console.error("Failed to fetch shared content:", contentError)
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 })
  }

  if (!sharedContent || sharedContent.length === 0) {
    return NextResponse.json({
      success: true,
      sent: 0,
      skipped: 0,
      message: "No shared content this week — skipping newsletter",
    })
  }

  // Step 2: Get summaries with quality scores
  const contentIds = sharedContent.map(c => c.id)
  const { data: summaries } = await supabase
    .from("summaries")
    .select("content_id, brief_overview, triage")
    .in("content_id", contentIds)
    .eq("processing_status", "complete")

  // Step 3: Build anonymized trending items sorted by quality
  const trendingItems = sharedContent
    .map(content => {
      const summary = summaries?.find(s => s.content_id === content.id)
      if (!summary) return null

      const triage = summary.triage as unknown as TriageData | null
      const qualityScore = triage?.quality_score ?? 0

      const rawOverview = summary.brief_overview || ""
      const teaser = rawOverview.length > 150
        ? rawOverview.slice(0, 150).trim() + "..."
        : rawOverview

      let domain = ""
      try {
        domain = new URL(content.url).hostname.replace(/^www\./, "")
      } catch {
        domain = "unknown"
      }

      return {
        title: content.title || "Untitled",
        shareUrl: `https://clarusapp.io/share/${content.share_token}`,
        type: content.type || "article",
        domain,
        teaser,
        qualityScore,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 10)

  if (trendingItems.length === 0) {
    return NextResponse.json({
      success: true,
      sent: 0,
      skipped: 0,
      message: "No complete analyses to feature — skipping newsletter",
    })
  }

  // Step 4: Get opted-in users
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, name, digest_enabled")
    .eq("digest_enabled", true)
    .not("email", "is", null)

  if (usersError) {
    console.error("Failed to fetch users:", usersError)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, message: "No eligible users" })
  }

  // Step 5: Send to each user
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const weekOf = weekStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  let sent = 0
  let skipped = 0

  for (const user of users) {
    if (!user.email) {
      skipped++
      continue
    }

    try {
      const result = await sendDiscoveryNewsletterEmail(
        user.email,
        user.name ?? undefined,
        weekOf,
        trendingItems
      )

      if (result.success) {
        sent++
      } else {
        console.error(`Failed to send discovery newsletter to ${user.email}:`, result.error)
        skipped++
      }
    } catch (err) {
      console.error(`Error sending newsletter to user ${user.id}:`, err)
      skipped++
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    trendingCount: trendingItems.length,
  })
}

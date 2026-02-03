import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { getAdminClient } from "@/lib/auth"
import { sendWeeklyDigestEmail } from "@/lib/email"
import type { TriageData } from "@/types/database.types"

export const maxDuration = 120

/**
 * GET /api/crons/weekly-digest
 * Called by Vercel Cron every Sunday at 2pm UTC.
 * Sends weekly digest emails to users who have digest_enabled=true
 * and have analyses in the last 7 days.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("CRON_SECRET not configured")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  // FIX-005: Use timingSafeEqual to prevent timing attacks on cron secret comparison
  const expectedHeader = `Bearer ${cronSecret}`
  const headerBuffer = Buffer.from(authHeader || "")
  const expectedBuffer = Buffer.from(expectedHeader)
  if (headerBuffer.length !== expectedBuffer.length || !timingSafeEqual(headerBuffer, expectedBuffer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // PERF: FIX-207 — limit users query to prevent unbounded fetch
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, name, digest_enabled")
    .eq("digest_enabled", true)
    .not("email", "is", null)
    .limit(500)

  if (usersError) {
    console.error("Failed to fetch users:", usersError)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, message: "No eligible users" })
  }

  // Batch fetch all user content and summaries in parallel
  const userIds = users.filter(u => u.email).map(u => u.id)

  const [contentResult, summariesResult] = await Promise.all([
    supabase
      .from("content")
      .select("id, title, url, user_id")
      .in("user_id", userIds)
      .gte("date_added", sevenDaysAgo)
      .order("date_added", { ascending: false }),
    supabase
      .from("summaries")
      .select("content_id, triage")
      .eq("processing_status", "complete")
      .eq("language", "en")
      .gte("created_at", sevenDaysAgo),
  ])

  const allContent = contentResult.data || []
  const allSummaries = summariesResult.data || []

  // Index summaries by content_id for O(1) lookup
  const summaryMap = new Map(allSummaries.map(s => [s.content_id, s]))

  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const weekOf = weekStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  let sent = 0
  let skipped = 0

  // Process each user using pre-fetched data
  const sendPromises = users.map(async (user) => {
    if (!user.email) {
      skipped++
      return
    }

    try {
      const recentContent = allContent.filter(c => c.user_id === user.id)
      if (recentContent.length === 0) {
        skipped++
        return
      }

      const scoredItems = recentContent
        .map((content) => {
          const summary = summaryMap.get(content.id)
          const triage = summary?.triage as unknown as TriageData | null
          const qualityScore = triage?.quality_score ?? 0
          return {
            title: content.title || "Untitled",
            url: `https://clarusapp.io/item/${content.id}`,
            qualityScore: Math.round(qualityScore * 10),
          }
        })
        .filter(item => item.qualityScore > 0)
        .sort((a, b) => b.qualityScore - a.qualityScore)

      if (scoredItems.length === 0) {
        skipped++
        return
      }

      const topAnalyses = scoredItems.slice(0, 5)
      const avgScore = Math.round(scoredItems.reduce((sum, item) => sum + item.qualityScore, 0) / scoredItems.length)

      const result = await sendWeeklyDigestEmail(
        user.email,
        user.name ?? undefined,
        weekOf,
        recentContent.length,
        topAnalyses,
        avgScore
      )

      if (result.success) {
        await supabase
          .from("users")
          .update({ last_digest_at: new Date().toISOString() })
          .eq("id", user.id)
        sent++
      } else {
        console.error(`Failed to send digest to ${user.email}:`, result.error)
        skipped++
      }
    } catch (err) {
      console.error(`Error processing digest for user ${user.id}:`, err)
      skipped++
    }
  })

  await Promise.all(sendPromises)

  return NextResponse.json({ success: true, sent, skipped })
}

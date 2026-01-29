import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/auth"
import { sendWeeklyDigestEmail } from "@/lib/email"
import type { TriageData } from "@/types/database.types"

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

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Find users with digest enabled
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

  let sent = 0
  let skipped = 0

  for (const user of users) {
    if (!user.email) {
      skipped++
      continue
    }

    try {
      // Get user's analyses from the last 7 days
      const { data: recentContent, error: contentError } = await supabase
        .from("content")
        .select("id, title, url")
        .eq("user_id", user.id)
        .gte("date_added", sevenDaysAgo)
        .order("date_added", { ascending: false })

      if (contentError || !recentContent || recentContent.length === 0) {
        skipped++
        continue
      }

      // Get summaries with quality scores for these content items
      const contentIds = recentContent.map((c) => c.id)
      const { data: summaries } = await supabase
        .from("summaries")
        .select("content_id, triage")
        .in("content_id", contentIds)
        .eq("processing_status", "complete")

      if (!summaries || summaries.length === 0) {
        skipped++
        continue
      }

      // Build scored list
      const scoredItems = recentContent
        .map((content) => {
          const summary = summaries.find((s) => s.content_id === content.id)
          const triage = summary?.triage as unknown as TriageData | null
          const qualityScore = triage?.quality_score ?? 0
          return {
            title: content.title || "Untitled",
            url: `https://clarusapp.io/item/${content.id}`,
            qualityScore: Math.round(qualityScore * 10), // Convert 1-10 to percentage-like
          }
        })
        .sort((a, b) => b.qualityScore - a.qualityScore)

      const topAnalyses = scoredItems.slice(0, 5)
      const avgScore = scoredItems.length > 0
        ? Math.round(scoredItems.reduce((sum, item) => sum + item.qualityScore, 0) / scoredItems.length)
        : 0

      // Format week string
      const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const weekOf = weekStart.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })

      // Send the email
      const result = await sendWeeklyDigestEmail(
        user.email,
        user.name ?? undefined,
        weekOf,
        recentContent.length,
        topAnalyses,
        avgScore
      )

      if (result.success) {
        // Update last_digest_at
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
  }

  return NextResponse.json({ success: true, sent, skipped })
}

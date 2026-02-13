import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { getAdminClient } from "@/lib/auth"
import { sendWeeklyDigestEmail } from "@/lib/email"
import { TIER_FEATURES, normalizeTier } from "@/lib/tier-limits"
import { parseAiResponseOrThrow } from "@/lib/ai-response-parser"
import type { TriageData, TruthCheckData, WeeklyInsights, Json } from "@/types/database.types"
import { logger } from "@/lib/logger"

export const maxDuration = 120

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const AI_MODEL = "google/gemini-2.5-flash"
const AI_TIMEOUT_MS = 30_000

/**
 * GET /api/crons/weekly-digest
 * Called by Vercel Cron every Sunday at 2pm UTC.
 * Sends weekly digest emails to users who have digest_enabled=true
 * and have analyses in the last 7 days.
 * Enhanced with AI-generated personalized insights (trending topics,
 * claim contradictions, reading efficiency, recommended revisits).
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    logger.error("CRON_SECRET not configured")
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
  // Now also fetching tier + day_pass_expires_at for feature gating
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, name, digest_enabled, tier, day_pass_expires_at")
    .eq("digest_enabled", true)
    .not("email", "is", null)
    .limit(500)

  if (usersError) {
    logger.error("Failed to fetch users:", usersError)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, message: "No eligible users" })
  }

  // Filter to only users whose tier supports weekly digest
  const eligibleUsers = users.filter(u => {
    if (!u.email) return false
    const tier = normalizeTier(u.tier, u.day_pass_expires_at)
    return TIER_FEATURES[tier].weeklyDigest
  })

  if (eligibleUsers.length === 0) {
    return NextResponse.json({ success: true, sent: 0, skipped: users.length, message: "No users with digest-eligible tier" })
  }

  // Batch fetch all user content and summaries in parallel
  const userIds = eligibleUsers.map(u => u.id)

  const [contentResult, summariesResult, claimsResult] = await Promise.all([
    supabase
      .from("content")
      .select("id, title, url, user_id, full_text, duration, tags, type")
      .in("user_id", userIds)
      .gte("date_added", sevenDaysAgo)
      .order("date_added", { ascending: false }),
    supabase
      .from("summaries")
      .select("content_id, triage, truth_check, user_id")
      .eq("processing_status", "complete")
      .eq("language", "en")
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("claims")
      .select("content_id, claim_text, status, user_id")
      .in("user_id", userIds)
      .gte("created_at", sevenDaysAgo)
      .limit(2000),
  ])

  const allContent = contentResult.data || []
  const allSummaries = summariesResult.data || []
  const allClaims = claimsResult.data || []

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
  const sendPromises = eligibleUsers.map(async (user) => {
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
            id: content.id,
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

      // Generate AI insights (graceful degradation: send digest without insights if this fails)
      const insights = await generateWeeklyInsights(
        user.id,
        recentContent,
        summaryMap,
        allClaims.filter(c => c.user_id === user.id),
      )

      const result = await sendWeeklyDigestEmail(
        user.email,
        user.name ?? undefined,
        weekOf,
        recentContent.length,
        topAnalyses,
        avgScore,
        insights ?? undefined
      )

      if (result.success) {
        await supabase
          .from("users")
          .update({ last_digest_at: new Date().toISOString() })
          .eq("id", user.id)
        sent++
      } else {
        logger.error(`Failed to send digest to ${user.email}:`, result.error)
        skipped++
      }
    } catch (err) {
      logger.error(`Error processing digest for user ${user.id}:`, err)
      skipped++
    }
  })

  await Promise.all(sendPromises)

  return NextResponse.json({ success: true, sent, skipped })
}

// ---------------------------------------------------------------------------
// AI Insights Generation
// ---------------------------------------------------------------------------

interface ContentRecord {
  id: string
  title: string | null
  url: string
  user_id: string | null
  full_text: string | null
  duration: number | null
  tags: string[] | null
  type: string | null
}

interface SummaryRecord {
  content_id: string
  triage: Json | null
  truth_check: Json | null
  user_id: string | null
}

interface ClaimRecord {
  content_id: string
  claim_text: string
  status: string
  user_id: string | null
}

/**
 * Generates personalized weekly insights using OpenRouter (Gemini 2.5 Flash).
 * Returns null if the AI call fails so the digest can still be sent.
 */
async function generateWeeklyInsights(
  userId: string,
  content: ContentRecord[],
  summaryMap: Map<string, SummaryRecord>,
  claims: ClaimRecord[],
): Promise<WeeklyInsights | null> {
  if (!OPENROUTER_API_KEY) {
    logger.warn(`[weekly-digest] OpenRouter API key not configured, skipping insights for user ${userId}`)
    return null
  }

  try {
    // Build a compact summary of the user's weekly activity for the AI prompt
    const contentSummaries = content.slice(0, 20).map(c => {
      const summary = summaryMap.get(c.id)
      const triage = summary?.triage as unknown as TriageData | null
      const truthCheck = summary?.truth_check as unknown as TruthCheckData | null

      return {
        id: c.id,
        title: c.title || "Untitled",
        type: c.type || "article",
        tags: c.tags || [],
        quality_score: triage?.quality_score ?? null,
        content_category: triage?.content_category ?? null,
        target_audience: triage?.target_audience ?? [],
        truth_rating: truthCheck?.overall_rating ?? null,
        word_count: c.full_text ? Math.round(c.full_text.length / 5) : null,
        duration_seconds: c.duration ?? null,
      }
    })

    // Build claim pairs for contradiction detection
    const claimSummaries = claims.slice(0, 50).map(cl => {
      const matchingContent = content.find(c => c.id === cl.content_id)
      return {
        claim: cl.claim_text,
        status: cl.status,
        source_title: matchingContent?.title || "Unknown",
        content_id: cl.content_id,
      }
    })

    // Estimate total reading/viewing time for the original content
    const totalWordCount = content.reduce((sum, c) => {
      if (c.full_text) return sum + Math.round(c.full_text.length / 5)
      return sum
    }, 0)
    const totalDurationSeconds = content.reduce((sum, c) => sum + (c.duration ?? 0), 0)

    const systemPrompt = `You are an analytics assistant for Clarus, an AI-powered content analysis tool. Generate personalized weekly insights based on a user's content analysis activity. Be concise and insightful. Respond ONLY with valid JSON matching the exact schema provided.`

    const userPrompt = `Analyze this user's weekly content analysis activity and generate personalized insights.

CONTENT ANALYZED THIS WEEK (${content.length} items):
${JSON.stringify(contentSummaries, null, 2)}

CLAIMS EXTRACTED (${claims.length} total):
${JSON.stringify(claimSummaries, null, 2)}

ORIGINAL CONTENT STATS:
- Total estimated word count: ${totalWordCount}
- Total video/podcast duration: ${Math.round(totalDurationSeconds / 60)} minutes
- Number of items analyzed: ${content.length}

Generate a JSON response with this EXACT schema:
{
  "trending_topics": [{"topic": "string", "count": number}],
  "contradictions": [{"claim_a": "string", "source_a": "string", "claim_b": "string", "source_b": "string"}],
  "time_saved_minutes": number,
  "recommended_revisits": [{"title": "string", "content_id": "string", "reason": "string"}]
}

Rules:
1. trending_topics: Identify 3-5 topics the user focused on most this week. Count how many items relate to each topic. Base topics on content categories, tags, titles, and target audiences.
2. contradictions: Find claims that contradict each other across DIFFERENT content items. Only include genuine contradictions where two sources make opposing statements. Return empty array if none found.
3. time_saved_minutes: Estimate total reading/viewing time the user saved by using Clarus instead of consuming all ${content.length} items directly. Factor in the word count (${totalWordCount} words at ~250 words/min) and video/podcast duration (${Math.round(totalDurationSeconds / 60)} min). Subtract roughly 2 minutes per item for reading the Clarus analysis. Round to nearest whole number. Minimum 0.
4. recommended_revisits: Pick 1-2 analyses worth revisiting. Choose items with surprising truth check results, high quality scores, or that connect to the user's trending topics. Use actual content_id values from the data above.`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clarusapp.io",
        "X-Title": "Clarus",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error(`[weekly-digest] OpenRouter API error (${response.status}): ${errorBody}`)
      return null
    }

    const result = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const rawContent = result.choices?.[0]?.message?.content

    if (!rawContent) {
      logger.error("[weekly-digest] OpenRouter response missing message content")
      return null
    }

    const insights = parseAiResponseOrThrow<WeeklyInsights>(rawContent, "weekly_insights")

    // Validate the structure minimally
    if (!Array.isArray(insights.trending_topics)) insights.trending_topics = []
    if (!Array.isArray(insights.contradictions)) insights.contradictions = []
    if (typeof insights.time_saved_minutes !== "number") insights.time_saved_minutes = 0
    if (!Array.isArray(insights.recommended_revisits)) insights.recommended_revisits = []

    // Ensure time_saved is non-negative
    insights.time_saved_minutes = Math.max(0, Math.round(insights.time_saved_minutes))

    return insights
  } catch (err) {
    logger.error(`[weekly-digest] Failed to generate AI insights for user ${userId}:`, err)
    return null
  }
}

/**
 * @module api/compare
 * @description Comparative analysis API route.
 *
 * Accepts 2-3 content IDs, fetches their summaries, and generates an
 * AI-powered comparison showing where sources agree, disagree, and
 * what unique insights each provides.
 *
 * Gated to Pro and Day Pass tiers only.
 *
 * @see {@link lib/tier-limits.ts} TIER_FEATURES.comparativeAnalysis
 */

import { NextResponse, type NextRequest } from "next/server"
import { authenticateRequest, getAdminClient } from "@/lib/auth"
import { checkRateLimit, validateContentId } from "@/lib/validation"
import { TIER_FEATURES, normalizeTier } from "@/lib/tier-limits"
import { parseAiResponseOrThrow } from "@/lib/ai-response-parser"
import { logApiUsage, createTimer } from "@/lib/api-usage"
import type { UserTier } from "@/types/database.types"

export const maxDuration = 120

const openRouterApiKey = process.env.OPENROUTER_API_KEY

/** Structured comparison result returned to the client. */
interface ComparisonResult {
  agreements: Array<{ topic: string; detail: string }>
  disagreements: Array<{
    topic: string
    sources: Array<{ title: string; position: string }>
  }>
  unique_insights: Array<{ source_title: string; insights: string[] }>
  reliability_assessment: string
  key_takeaways: string[]
  generated_at: string
}

/** Shape of the content + summary data fetched from the database. */
interface ContentWithSummary {
  id: string
  title: string | null
  url: string
  type: string | null
  summary: {
    brief_overview: string | null
    truth_check: unknown
    triage: unknown
  } | null
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest()
    if (!auth.success) return auth.response

    const { user, supabase } = auth

    // 2. Rate limit: 10 per minute
    const rateLimit = checkRateLimit(`compare:${user.id}`, 10, 60_000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) } }
      )
    }

    // 3. Parse and validate request body
    let body: { contentIds?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    }

    const { contentIds } = body

    if (!Array.isArray(contentIds)) {
      return NextResponse.json(
        { error: "contentIds must be an array" },
        { status: 400 }
      )
    }

    if (contentIds.length < 2 || contentIds.length > 3) {
      return NextResponse.json(
        { error: "Please select 2 or 3 content items to compare" },
        { status: 400 }
      )
    }

    // Validate each ID is a valid UUID
    for (const id of contentIds) {
      if (typeof id !== "string") {
        return NextResponse.json(
          { error: "Each content ID must be a string" },
          { status: 400 }
        )
      }
      const validation = validateContentId(id)
      if (!validation.isValid) {
        return NextResponse.json(
          { error: validation.error ?? "Invalid content ID" },
          { status: 400 }
        )
      }
    }

    // 4. Tier check: Pro and Day Pass only
    const adminClient = getAdminClient()
    const { data: userData, error: userError } = await adminClient
      .from("users")
      .select("tier, day_pass_expires_at")
      .eq("id", user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    const userTier: UserTier = normalizeTier(userData.tier, userData.day_pass_expires_at)
    if (!TIER_FEATURES[userTier].comparativeAnalysis) {
      return NextResponse.json(
        { error: "Comparative analysis is available on Pro and Day Pass plans" },
        { status: 403 }
      )
    }

    // PERF: Batch-fetch all content and summaries with IN clauses instead of N+1 sequential queries
    const validContentIds = contentIds as string[]

    const [contentResult, summaryResult] = await Promise.all([
      supabase
        .from("content")
        .select("id, title, url, type")
        .in("id", validContentIds)
        .eq("user_id", user.id),
      supabase
        .from("summaries")
        .select("content_id, brief_overview, truth_check, triage")
        .in("content_id", validContentIds)
        .eq("user_id", user.id),
    ])

    if (contentResult.error || !contentResult.data) {
      return NextResponse.json(
        { error: "Failed to fetch content" },
        { status: 500 }
      )
    }

    // Verify all requested items were found (user owns them all)
    const foundContentMap = new Map(contentResult.data.map(c => [c.id, c]))
    for (const contentId of validContentIds) {
      if (!foundContentMap.has(contentId)) {
        return NextResponse.json(
          { error: `Content not found: ${contentId}` },
          { status: 404 }
        )
      }
    }

    // Build summary lookup
    const summaryMap = new Map(
      (summaryResult.data ?? []).map(s => [s.content_id, s])
    )

    const contentItems: ContentWithSummary[] = validContentIds.map(id => {
      const content = foundContentMap.get(id)!
      const summary = summaryMap.get(id)
      return {
        id: content.id,
        title: content.title,
        url: content.url,
        type: content.type,
        summary: summary ? {
          brief_overview: summary.brief_overview,
          truth_check: summary.truth_check,
          triage: summary.triage,
        } : null,
      }
    })

    // Verify all items have summaries
    const missingAnalysis = contentItems.find((item) => !item.summary?.brief_overview)
    if (missingAnalysis) {
      return NextResponse.json(
        { error: `"${missingAnalysis.title ?? "Untitled"}" has not been analyzed yet. Please analyze all content before comparing.` },
        { status: 400 }
      )
    }

    // 6. Check OpenRouter API key
    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      )
    }

    // 7. Build the AI prompt
    const sourceSections = contentItems.map((item, i) => {
      const truthCheck = item.summary?.truth_check
      const triage = item.summary?.triage
      const truthCheckStr = truthCheck ? JSON.stringify(truthCheck) : "Not available"
      const triageStr = triage ? JSON.stringify(triage) : "Not available"

      return `
### Source ${i + 1}: "${item.title ?? "Untitled"}"
- URL: ${item.url}
- Type: ${item.type ?? "unknown"}

**Brief Overview:**
${item.summary?.brief_overview ?? "Not available"}

**Truth Check Analysis:**
${truthCheckStr}

**Quality Triage:**
${triageStr}
`
    }).join("\n---\n")

    const systemPrompt = `You are an expert comparative analyst. Your job is to compare multiple content sources and provide a structured, objective comparison. Focus on factual differences, areas of agreement, unique contributions from each source, and an overall reliability assessment.

You MUST respond with valid JSON matching this exact structure:
{
  "agreements": [{"topic": "string", "detail": "string"}],
  "disagreements": [{"topic": "string", "sources": [{"title": "string", "position": "string"}]}],
  "unique_insights": [{"source_title": "string", "insights": ["string"]}],
  "reliability_assessment": "string",
  "key_takeaways": ["string"]
}

Guidelines:
- Be specific and cite source titles when noting positions
- Identify both explicit contradictions and subtle differences in emphasis or framing
- Note when sources use different data, timeframes, or methodologies
- Assess reliability based on evidence quality, source credibility indicators, and analytical rigor
- Provide 3-5 actionable key takeaways that synthesize the best information from all sources
- Keep each agreement/disagreement topic concise (under 10 words)
- Keep details informative but brief (1-3 sentences each)`

    const userPrompt = `Compare the following ${contentItems.length} content sources and provide a structured comparative analysis:

${sourceSections}

Analyze these sources and provide a comprehensive comparison in the required JSON format.`

    // 8. Call OpenRouter (Gemini 2.5 Flash)
    const timer = createTimer()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90_000) // 90s timeout

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clarusapp.io",
        "X-Title": "Clarus",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text().catch(() => "Unknown error")
      console.error(`API: [compare] OpenRouter HTTP ${aiResponse.status}: ${errorText}`)

      logApiUsage({
        userId: user.id,
        apiName: "openrouter",
        operation: "comparative_analysis",
        modelName: "google/gemini-2.5-flash",
        responseTimeMs: timer.elapsed(),
        status: "error",
        errorMessage: `HTTP ${aiResponse.status}`,
      })

      return NextResponse.json(
        { error: "AI analysis service is temporarily unavailable. Please try again." },
        { status: 502 }
      )
    }

    const aiData = await aiResponse.json()
    const rawContent = aiData.choices?.[0]?.message?.content
    const usage = aiData.usage ?? {}

    if (!rawContent) {
      return NextResponse.json(
        { error: "AI returned an empty response. Please try again." },
        { status: 502 }
      )
    }

    // Log successful API usage
    logApiUsage({
      userId: user.id,
      apiName: "openrouter",
      operation: "comparative_analysis",
      tokensInput: usage.prompt_tokens ?? 0,
      tokensOutput: usage.completion_tokens ?? 0,
      modelName: "google/gemini-2.5-flash",
      responseTimeMs: timer.elapsed(),
      status: "success",
      metadata: { contentCount: contentItems.length },
    })

    // 9. Parse AI response
    const parsed = parseAiResponseOrThrow<ComparisonResult>(rawContent, "comparative_analysis")

    // Validate the parsed structure has required fields
    const result: ComparisonResult = {
      agreements: Array.isArray(parsed.agreements) ? parsed.agreements : [],
      disagreements: Array.isArray(parsed.disagreements) ? parsed.disagreements : [],
      unique_insights: Array.isArray(parsed.unique_insights) ? parsed.unique_insights : [],
      reliability_assessment: typeof parsed.reliability_assessment === "string"
        ? parsed.reliability_assessment
        : "Unable to assess reliability.",
      key_takeaways: Array.isArray(parsed.key_takeaways) ? parsed.key_takeaways : [],
      generated_at: new Date().toISOString(),
    }

    // 10. Return structured comparison
    return NextResponse.json({
      success: true,
      comparison: result,
      sources: contentItems.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        type: item.type,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    // Handle abort errors from timeout
    if (message.includes("aborted") || message.includes("AbortError")) {
      return NextResponse.json(
        { error: "Comparison took too long. Please try again." },
        { status: 504 }
      )
    }

    console.error("API: [compare] Unhandled error:", message)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}

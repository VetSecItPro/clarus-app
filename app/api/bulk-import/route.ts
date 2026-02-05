import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { validateUrl, checkRateLimit } from "@/lib/validation"
import { getUserTier, getUsageCounts } from "@/lib/usage"
import { TIER_LIMITS, getCurrentPeriod, getLimitForField } from "@/lib/tier-limits"
import { getYouTubeVideoId, isXUrl, isPodcastUrl } from "@/lib/utils"
import { processContent } from "@/lib/process-content"

/** Maximum URLs allowed in a single request (hard cap regardless of tier) */
const ABSOLUTE_MAX_URLS = 15

/**
 * POST /api/bulk-import
 * Validates an array of URLs, checks tier limits, creates content entries,
 * and triggers background processing for each.
 */
export async function POST(request: NextRequest) {
  // Rate limiting — bulk imports are expensive, cap at 5/min per IP
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rateLimit = checkRateLimit(`bulk-import:${clientIp}`, 5, 60000)
  if (!rateLimit.allowed) {
    return AuthErrors.rateLimit(rateLimit.resetIn)
  }

  // Authenticate
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  // Parse request body
  let body: { urls?: unknown; language?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { urls, language } = body

  // Validate urls is an array of strings
  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "urls must be a non-empty array" },
      { status: 400 }
    )
  }

  if (urls.length > ABSOLUTE_MAX_URLS) {
    return NextResponse.json(
      { error: `Maximum ${ABSOLUTE_MAX_URLS} URLs per request` },
      { status: 400 }
    )
  }

  // Validate every element is a string
  if (!urls.every((u): u is string => typeof u === "string")) {
    return NextResponse.json(
      { error: "Every URL must be a string" },
      { status: 400 }
    )
  }

  // Validate language if provided
  const analysisLanguage = typeof language === "string" ? language : "en"

  const userId = auth.user.id

  // Get user tier and usage
  const [tier, usageCounts] = await Promise.all([
    getUserTier(auth.supabase, userId),
    getUsageCounts(auth.supabase, userId),
  ])

  const batchLimit = TIER_LIMITS[tier].bulkImportBatchSize
  const monthlyAnalysisLimit = getLimitForField(tier, "analyses_count")
  const currentAnalysisCount = usageCounts.analyses_count

  // Check batch size against tier limit
  if (urls.length > batchLimit) {
    return NextResponse.json(
      {
        error: `Your plan allows ${batchLimit} URLs per batch. Upgrade for more.`,
        batch_limit: batchLimit,
        tier,
        upgrade_required: true,
      },
      { status: 403 }
    )
  }

  // Check remaining monthly analyses
  const remainingAnalyses = monthlyAnalysisLimit - currentAnalysisCount
  if (remainingAnalyses <= 0) {
    return NextResponse.json(
      {
        error: "Monthly analysis limit reached. Upgrade your plan for more.",
        limit: monthlyAnalysisLimit,
        current: currentAnalysisCount,
        tier,
        upgrade_required: true,
      },
      { status: 403 }
    )
  }

  // Validate each URL and detect content type
  interface ValidatedUrl {
    url: string
    type: "youtube" | "article" | "x_post" | "podcast"
  }

  interface UrlValidationResult {
    index: number
    url: string
    valid: boolean
    error?: string
    type?: "youtube" | "article" | "x_post" | "podcast"
  }

  const validationResults: UrlValidationResult[] = urls.map((rawUrl, index) => {
    const trimmed = rawUrl.trim()
    if (!trimmed) {
      return { index, url: rawUrl, valid: false, error: "Empty URL" }
    }

    const validation = validateUrl(trimmed)
    if (!validation.isValid || !validation.sanitized) {
      return { index, url: rawUrl, valid: false, error: validation.error || "Invalid URL" }
    }

    // Detect content type
    const validUrl = validation.sanitized
    let type: "youtube" | "article" | "x_post" | "podcast" = "article"
    if (getYouTubeVideoId(validUrl)) {
      type = "youtube"
    } else if (isXUrl(validUrl)) {
      type = "x_post"
    } else if (isPodcastUrl(validUrl)) {
      type = "podcast"
    }

    return { index, url: validUrl, valid: true, type }
  })

  const validUrls = validationResults.filter(
    (r): r is UrlValidationResult & { valid: true; type: "youtube" | "article" | "x_post" | "podcast" } => r.valid
  )
  const invalidUrls = validationResults.filter((r) => !r.valid)

  if (validUrls.length === 0) {
    return NextResponse.json(
      {
        error: "No valid URLs provided",
        invalid: invalidUrls.map((r) => ({ url: r.url, error: r.error })),
      },
      { status: 400 }
    )
  }

  // Cap valid URLs to remaining monthly limit
  const urlsToProcess: ValidatedUrl[] = validUrls
    .slice(0, remainingAnalyses)
    .map((r) => ({ url: r.url, type: r.type }))

  const skippedDueToLimit = validUrls.length - urlsToProcess.length

  // Deduplicate URLs within this batch
  const seen = new Set<string>()
  const deduplicatedUrls: ValidatedUrl[] = []
  for (const item of urlsToProcess) {
    if (!seen.has(item.url)) {
      seen.add(item.url)
      deduplicatedUrls.push(item)
    }
  }

  // Create content records for each URL
  const results: Array<{
    url: string
    contentId: string | null
    type: string
    error?: string
  }> = []

  const period = getCurrentPeriod()

  for (const { url, type } of deduplicatedUrls) {
    try {
      // Check if user already has this URL
      const { data: existing } = await auth.supabase
        .from("content")
        .select("id")
        .eq("url", url)
        .eq("user_id", userId)
        .order("date_added", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        // Content already exists — include it in results so user can track it
        results.push({ url, contentId: existing.id, type })
        continue
      }

      // Create placeholder title
      const title = `Analyzing: ${url.substring(0, 60)}${url.length > 60 ? "..." : ""}`

      // Insert new content record
      const { data: newContent, error: insertError } = await auth.supabase
        .from("content")
        .insert({
          url,
          type,
          user_id: userId,
          title,
          full_text: null,
          analysis_language: analysisLanguage,
        })
        .select("id")
        .single()

      if (insertError || !newContent) {
        results.push({ url, contentId: null, type, error: "Failed to create content entry" })
        continue
      }

      // Increment analysis usage
      await auth.supabase.rpc("increment_usage", {
        p_user_id: userId,
        p_period: period,
        p_field: "analyses_count",
      })

      results.push({ url, contentId: newContent.id, type })

      // Trigger background processing (fire-and-forget)
      // PERF: Direct function call instead of HTTP fetch — saves 50-200ms per item
      processContent({
        contentId: newContent.id,
        userId: userId,
        language: analysisLanguage as "en" | "ar" | "es" | "fr" | "de" | "pt" | "ja" | "ko" | "zh" | "it" | "nl",
      }).catch((err) => {
        console.warn(`Bulk import: Background processing failed for ${newContent.id}:`, err)
      })
    } catch {
      results.push({ url, contentId: null, type, error: "Unexpected error" })
    }
  }

  return NextResponse.json({
    results,
    invalid: invalidUrls.map((r) => ({ url: r.url, error: r.error })),
    skipped_due_to_limit: skippedDueToLimit,
    batch_limit: batchLimit,
    tier,
  })
}

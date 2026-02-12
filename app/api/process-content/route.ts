/**
 * @module api/process-content
 * @description HTTP wrapper for the content processing pipeline.
 *
 * This route provides the HTTP interface for content analysis:
 * - Rate limiting by IP
 * - Authentication (browser session or internal API secret)
 * - Request validation
 * - Delegates to lib/process-content.ts for actual processing
 *
 * For internal calls from other routes, prefer importing processContent
 * directly from lib/process-content.ts to avoid HTTP overhead.
 *
 * @see {@link lib/process-content.ts} for the core processing logic
 */

import { NextResponse, type NextRequest } from "next/server"
import { timingSafeEqual } from "crypto"
import { checkRateLimit } from "@/lib/validation"
import { authenticateRequest } from "@/lib/auth"
import { isValidLanguage, type AnalysisLanguage } from "@/lib/languages"
import { processContent, ProcessContentError } from "@/lib/process-content"
import { processContentSchema, parseBody } from "@/lib/schemas"

// Extend Vercel function timeout to 5 minutes (requires Pro plan)
// This is critical for processing long videos that require multiple AI calls
export const maxDuration = 300

export async function POST(req: NextRequest) {
  // Rate limiting by IP
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown"
  const rateLimit = checkRateLimit(`process:${clientIp}`, 30, 60000) // 30 requests per minute
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) } }
    )
  }

  // SECURITY: Use dedicated internal API secret, not service role key
  // FIX-006: Use timingSafeEqual to prevent timing attacks
  const internalSecret = process.env.INTERNAL_API_SECRET
  const authHeader = req.headers.get("authorization") || ""
  let isInternalCall = false
  if (internalSecret) {
    const expectedHeader = `Bearer ${internalSecret}`
    const headerBuffer = Buffer.from(authHeader)
    const expectedBuffer = Buffer.from(expectedHeader)
    isInternalCall = headerBuffer.length === expectedBuffer.length && timingSafeEqual(headerBuffer, expectedBuffer)
  }

  let userId: string | null = null

  if (!isInternalCall) {
    // Browser call — require session auth
    const auth = await authenticateRequest()
    if (!auth.success) return auth.response
    userId = auth.user.id
  }

  // Parse and validate request body
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const parsed = parseBody(processContentSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const contentId = parsed.data.content_id
  const forceRegenerate = parsed.data.force_regenerate
  const skipScraping = parsed.data.skipScraping

  // Validate language parameter beyond Zod (check against supported list)
  let language: AnalysisLanguage = "en"
  if (parsed.data.language && parsed.data.language !== "en") {
    if (!isValidLanguage(parsed.data.language)) {
      return NextResponse.json({ error: "Invalid language code" }, { status: 400 })
    }
    language = parsed.data.language
  }

  // Call core processing function
  try {
    const result = await processContent({
      contentId,
      userId,
      language,
      forceRegenerate,
      skipScraping,
    })

    return NextResponse.json({
      success: result.success,
      cached: result.cached,
      message: result.message,
      content_id: result.contentId,
      sections_generated: result.sectionsGenerated,
      language: result.language,
      transcript_id: result.transcriptId,
      paywall_warning: result.paywallWarning,
    })
  } catch (error) {
    if (error instanceof ProcessContentError) {
      return NextResponse.json(
        {
          error: error.message,
          success: false,
          content_id: contentId,
          upgrade_required: error.upgradeRequired,
          tier: error.tier,
          // For 200 status errors (partial success), include these fields
          ...(error.statusCode === 200 && { content_blocked: true }),
        },
        { status: error.statusCode }
      )
    }
    console.error("API: Unexpected error in process-content:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

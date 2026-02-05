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
import { validateContentId, checkRateLimit } from "@/lib/validation"
import { authenticateRequest } from "@/lib/auth"
import { isValidLanguage, type AnalysisLanguage } from "@/lib/languages"
import { processContent, ProcessContentError } from "@/lib/process-content"

// Extend Vercel function timeout to 5 minutes (requires Pro plan)
// This is critical for processing long videos that require multiple AI calls
export const maxDuration = 300

interface ProcessContentRequestBody {
  content_id: string
  force_regenerate?: boolean
  language?: string
  skipScraping?: boolean
}

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
  let contentId: string
  let language: AnalysisLanguage = "en"
  let forceRegenerate = false
  let skipScraping = false

  try {
    const body: ProcessContentRequestBody = await req.json()
    forceRegenerate = body.force_regenerate || false
    skipScraping = body.skipScraping || false

    // Validate content_id
    const contentIdValidation = validateContentId(body.content_id)
    if (!contentIdValidation.isValid) {
      return NextResponse.json({ error: contentIdValidation.error || "Invalid content_id" }, { status: 400 })
    }
    contentId = contentIdValidation.sanitized!

    // Validate language parameter
    if (body.language) {
      if (!isValidLanguage(body.language)) {
        return NextResponse.json({ error: "Invalid language code" }, { status: 400 })
      }
      language = body.language
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
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

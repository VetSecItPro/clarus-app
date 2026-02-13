import { NextResponse } from "next/server"
import { authenticateRequest, verifyContentOwnership, AuthErrors } from "@/lib/auth"
import { shareContentSchema, parseBody } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/rate-limit"
import { sendShareAnalysisEmail } from "@/lib/email"
import { z } from "zod"
import { logger } from "@/lib/logger"

// Extended schema with content_id for ownership verification
const shareRequestSchema = shareContentSchema.extend({
  content_id: z.string().uuid().optional(), // Optional for backwards compatibility
})

export async function POST(request: Request) {
  try {
    // Rate limiting - 10 emails per hour per IP
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = await checkRateLimit(`share:${clientIp}`, 10, 3600000) // 10 per hour
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // Authenticate user
    const auth = await authenticateRequest()
    if (!auth.success) {
      return auth.response
    }

    if (!process.env.RESEND_API_KEY) {
      logger.error("RESEND_API_KEY is not configured")
      return NextResponse.json({ error: "Email service is not configured" }, { status: 500 })
    }

    // Validate request body
    const body = await request.json()
    const validation = parseBody(shareRequestSchema, body)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    const { to, contentTitle, contentUrl, personalMessage, content_id } = validation.data

    // If content_id provided, verify ownership
    if (content_id) {
      const ownership = await verifyContentOwnership(auth.supabase, auth.user.id, content_id)
      if (!ownership.owned) {
        return ownership.response
      }
    }

    // Get sender info
    const senderName = auth.user.user_metadata?.display_name || auth.user.email?.split("@")[0] || "A Clarus user"
    const senderEmail = auth.user.email || "unknown"

    // Build analysis URL - need at least content_id or contentUrl
    if (!content_id && !contentUrl) {
      return AuthErrors.badRequest("Either content_id or contentUrl is required")
    }

    const analysisUrl = content_id
      ? `https://clarusapp.io/item/${content_id}`
      : contentUrl!

    const finalContentUrl = contentUrl || analysisUrl

    // Send email using our template
    const result = await sendShareAnalysisEmail(
      to,
      senderName,
      senderEmail,
      undefined, // recipientName - we don't know it
      contentTitle || "Content Analysis",
      finalContentUrl,
      analysisUrl,
      personalMessage || undefined
    )

    if (!result.success) {
      logger.error("Share email error:", result.error)
      return NextResponse.json({ error: "Failed to send email. Please try again later." }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: result.messageId })
  } catch (err: unknown) {
    logger.error("Share API error:", err)
    return NextResponse.json({ error: "Failed to send email. Please try again later." }, { status: 500 })
  }
}

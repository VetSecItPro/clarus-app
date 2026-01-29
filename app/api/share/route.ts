import { NextResponse } from "next/server"
import { Resend } from "resend"
import { authenticateRequest, verifyContentOwnership, AuthErrors } from "@/lib/auth"
import { shareContentSchema, parseBody } from "@/lib/schemas"
import { checkRateLimit, sanitizeForDisplay } from "@/lib/validation"
import { z } from "zod"

// Extended schema with content_id for ownership verification
const shareRequestSchema = shareContentSchema.extend({
  content_id: z.string().uuid().optional(), // Optional for backwards compatibility
})

export async function POST(request: Request) {
  try {
    // Rate limiting - 10 emails per hour per IP
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`share:${clientIp}`, 10, 3600000) // 10 per hour
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // Authenticate user
    const auth = await authenticateRequest()
    if (!auth.success) {
      return auth.response
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured")
      return NextResponse.json({ error: "Email service is not configured" }, { status: 500 })
    }

    // Validate request body
    const body = await request.json()
    const validation = parseBody(shareRequestSchema, body)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    const { to, subject, contentTitle, contentUrl, briefOverview, personalMessage, content_id } = validation.data

    // If content_id provided, verify ownership
    if (content_id) {
      const ownership = await verifyContentOwnership(auth.supabase, auth.user.id, content_id)
      if (!ownership.owned) {
        return ownership.response
      }
    }

    // Sanitize all user-provided content for HTML display
    const safePersonalMessage = personalMessage ? sanitizeForDisplay(personalMessage) : null
    const safeContentTitle = contentTitle ? sanitizeForDisplay(contentTitle) : "Content Analysis"
    const safeBriefOverview = briefOverview ? sanitizeForDisplay(briefOverview) : null
    const safeSubject = subject ? sanitizeForDisplay(subject) : `Check out this analysis: ${safeContentTitle}`

    const resend = new Resend(process.env.RESEND_API_KEY)

    // Build email HTML with sanitized content
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${safeSubject}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #1d9bf0, #1a8cd8); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                </div>
                <span style="color: white; font-size: 20px; font-weight: 600;">Clarus</span>
              </div>
            </div>

            <!-- Main Card -->
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; overflow: hidden;">
              <!-- Personal Message (if provided) -->
              ${safePersonalMessage ? `
              <div style="padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <p style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.6; margin: 0; font-style: italic;">
                  "${safePersonalMessage}"
                </p>
              </div>
              ` : ''}

              <!-- Content Title -->
              <div style="padding: 24px;">
                <h2 style="color: white; font-size: 18px; font-weight: 600; margin: 0 0 12px 0; line-height: 1.4;">
                  ${safeContentTitle}
                </h2>

                ${safeBriefOverview ? `
                <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                  ${safeBriefOverview}
                </p>
                ` : ''}

                <!-- CTA Button -->
                ${contentUrl ? `
                <a href="${contentUrl}"
                   style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #1d9bf0, #1a8cd8); color: white; text-decoration: none; border-radius: 100px; font-size: 14px; font-weight: 500;">
                  View Full Analysis
                </a>
                ` : ''}
              </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 32px;">
              <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0;">
                Sent via <a href="https://clarusapp.io" style="color: #1d9bf0; text-decoration: none;">Clarus</a>
              </p>
              <p style="color: rgba(255,255,255,0.3); font-size: 11px; margin: 8px 0 0 0;">
                AI-powered content analysis for clarity
              </p>
            </div>
          </div>
        </body>
      </html>
    `

    const { data, error } = await resend.emails.send({
      from: "Clarus <noreply@clarusapp.io>",
      to: [to],
      subject: safeSubject,
      html,
    })

    if (error) {
      console.error("Resend error:", error)
      return NextResponse.json({ error: "Failed to send email. Please try again later." }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err: unknown) {
    console.error("Share API error:", err)
    return NextResponse.json({ error: "Failed to send email. Please try again later." }, { status: 500 })
  }
}

import { Resend } from "resend"
import { render } from "@react-email/components"

// Email templates (only those actively used)
import { SubscriptionStartedEmail } from "@/emails/subscription-started"
import { PaymentFailedEmail } from "@/emails/payment-failed"
import { SubscriptionCancelledEmail } from "@/emails/subscription-cancelled"
import { WeeklyDigestEmail } from "@/emails/weekly-digest"
import { ShareAnalysisEmail } from "@/emails/share-analysis"
import { DiscoveryNewsletterEmail } from "@/emails/discovery-newsletter"

// Lazy initialization to avoid build errors when API key is missing
let resendClient: Resend | null = null
function getResend(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured")
    }
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

const FROM_EMAIL = "Clarus <noreply@clarusapp.io>"

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  replyTo?: string
): Promise<SendEmailResult> {
  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    })

    if (error) {
      console.error("Failed to send email:", error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    console.error("Email send error:", err)
    return { success: false, error: String(err) }
  }
}

// ==================== Subscription Emails ====================

export async function sendSubscriptionStartedEmail(
  to: string,
  userName: string | undefined,
  planName: string,
  billingCycle: string,
  amount: string,
  nextBillingDate: string
) {
  const html = await render(
    SubscriptionStartedEmail({ userName, planName, billingCycle, amount, nextBillingDate })
  )
  return sendEmail(to, "Clarus - Welcome to Pro", html)
}

export async function sendPaymentFailedEmail(
  to: string,
  userName: string | undefined,
  amount: string,
  planName: string,
  failureReason: string,
  retryDate: string,
  updatePaymentUrl: string
) {
  const html = await render(
    PaymentFailedEmail({ userName, amount, planName, failureReason, retryDate, updatePaymentUrl })
  )
  return sendEmail(to, "Clarus - Payment Failed", html)
}

export async function sendSubscriptionCancelledEmail(
  to: string,
  userName: string | undefined,
  planName: string,
  accessUntil: string,
  resubscribeUrl: string
) {
  const html = await render(
    SubscriptionCancelledEmail({ userName, planName, accessUntil, resubscribeUrl })
  )
  return sendEmail(to, "Clarus - Subscription Cancelled", html)
}

// ==================== Engagement Emails ====================

export async function sendWeeklyDigestEmail(
  to: string,
  userName: string | undefined,
  weekOf: string,
  totalAnalyses: number,
  topAnalyses: Array<{ title: string; url: string; qualityScore: number }>,
  avgQualityScore: number
) {
  const html = await render(
    WeeklyDigestEmail({ userName, weekOf, totalAnalyses, topAnalyses, avgQualityScore })
  )
  return sendEmail(to, "Clarus - Your Weekly Digest", html)
}

// ==================== Discovery Newsletter ====================

export async function sendDiscoveryNewsletterEmail(
  to: string,
  userName: string | undefined,
  weekOf: string,
  trendingItems: Array<{
    title: string
    shareUrl: string
    type: string
    domain: string
    teaser: string
    qualityScore: number
  }>
) {
  const html = await render(
    DiscoveryNewsletterEmail({ userName, weekOf, trendingItems })
  )
  return sendEmail(to, "Clarus - Trending This Week", html)
}

// ==================== Sharing Emails ====================

export async function sendShareAnalysisEmail(
  to: string,
  senderName: string,
  senderEmail: string,
  recipientName: string | undefined,
  contentTitle: string,
  contentUrl: string,
  analysisUrl: string,
  personalMessage?: string
) {
  const html = await render(
    ShareAnalysisEmail({
      senderName,
      senderEmail,
      recipientName,
      contentTitle,
      contentUrl,
      analysisUrl,
      personalMessage,
    })
  )
  return sendEmail(to, "Clarus - Someone Shared an Analysis With You", html)
}

// ==================== Contact Form ====================

export async function sendContactFormEmail(
  senderName: string,
  senderEmail: string,
  subject: string,
  message: string
): Promise<SendEmailResult> {
  const CONTACT_RECIPIENT = "contact@steelmotionllc.com"

  const escapedName = escapeHtml(senderName)
  const escapedEmail = escapeHtml(senderEmail)
  const escapedSubject = escapeHtml(subject)
  const escapedMessage = escapeHtml(message)

  const html = `
    <div style="font-family: sans-serif; max-width: 600px;">
      <h2 style="color: #1d9bf0;">New Contact Form Submission</h2>
      <p><strong>From:</strong> ${escapedName} (${escapedEmail})</p>
      <p><strong>Subject:</strong> ${escapedSubject}</p>
      <hr style="border: 1px solid #eee;" />
      <div style="white-space: pre-wrap; line-height: 1.6;">${escapedMessage}</div>
      <hr style="border: 1px solid #eee;" />
      <p style="color: #999; font-size: 12px;">
        Sent via Clarus contact form. Reply directly to ${escapedEmail}.
      </p>
    </div>
  `

  return sendEmail(CONTACT_RECIPIENT, `[Clarus Contact] ${subject}`, html, senderEmail)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

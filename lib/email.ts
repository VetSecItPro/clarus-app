/**
 * @module email
 * @description Transactional email sending via Resend.
 *
 * Provides type-safe wrappers for each email template used by Clarus:
 *   - **Subscription lifecycle** -- welcome, payment failed, cancellation
 *   - **Engagement** -- weekly digest, discovery newsletter
 *   - **Sharing** -- share analysis with another user
 *   - **Contact** -- contact form forwarding to admin inbox
 *
 * All emails are rendered server-side using React Email components and
 * sent through the Resend API. The Resend client is lazily initialized
 * to avoid build failures when the API key is not configured (e.g., in CI).
 *
 * HTML output from user input is escaped via {@link escapeHtml} to prevent
 * XSS in email clients.
 *
 * @see {@link emails/} directory for React Email template components
 */

import { Resend } from "resend"
import { render } from "@react-email/components"

// Email templates (only those actively used)
import { SubscriptionStartedEmail } from "@/emails/subscription-started"
import { PaymentFailedEmail } from "@/emails/payment-failed"
import { SubscriptionCancelledEmail } from "@/emails/subscription-cancelled"
import { WeeklyDigestEmail } from "@/emails/weekly-digest"
import type { WeeklyInsights } from "@/types/database.types"
import { ShareAnalysisEmail } from "@/emails/share-analysis"
import { DiscoveryNewsletterEmail } from "@/emails/discovery-newsletter"
import { NewEpisodeEmail } from "@/emails/new-episode"

// Lazy initialization to avoid build errors when API key is missing
let resendClient: Resend | null = null

/**
 * Returns the singleton Resend client, creating it on first call.
 * @throws Error if `RESEND_API_KEY` is not configured
 */
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

/** Result of an email send attempt. Check `success` before accessing other fields. */
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

/** Sends a welcome email when a user starts a paid subscription. */
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

/** Sends a payment failure notification with retry date and payment update link. */
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

/** Sends a cancellation confirmation with access-until date and re-subscribe link. */
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

/** Sends the weekly digest summarizing the user's analysis activity, optionally with AI insights. */
export async function sendWeeklyDigestEmail(
  to: string,
  userName: string | undefined,
  weekOf: string,
  totalAnalyses: number,
  topAnalyses: Array<{ title: string; url: string; qualityScore: number }>,
  avgQualityScore: number,
  insights?: WeeklyInsights
) {
  const html = await render(
    WeeklyDigestEmail({ userName, weekOf, totalAnalyses, topAnalyses, avgQualityScore, insights })
  )
  return sendEmail(to, "Clarus - Your Weekly Digest", html)
}

// ==================== Discovery Newsletter ====================

/** Sends the discovery newsletter featuring trending shared analyses. */
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

/** Sends an email notifying a recipient that someone shared an analysis with them. */
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

// ==================== Podcast Episode Notifications ====================

/** Sends a notification email when new podcast episodes are detected. */
export async function sendNewEpisodeEmail(
  to: string,
  userName: string | undefined,
  episodes: Array<{
    title: string
    podcastName: string
    date: string | null
    duration: string | null
  }>,
  podcastCount: number
) {
  const html = await render(
    NewEpisodeEmail({ userName, episodes, podcastCount })
  )
  const episodeWord = episodes.length === 1 ? "Episode" : "Episodes"
  return sendEmail(to, `Clarus - ${episodes.length} New Podcast ${episodeWord}`, html)
}

// ==================== YouTube Video Notifications ====================

/** Sends a notification email when new YouTube videos are detected. */
export async function sendNewVideoEmail(
  to: string,
  userName: string | undefined,
  videos: Array<{
    title: string
    channelName: string
    date: string | null
  }>,
  channelCount: number
) {
  // Reuse the podcast episode email template with adapted labels
  const episodes = videos.map((v) => ({
    title: v.title,
    podcastName: v.channelName,
    date: v.date,
    duration: null,
  }))
  const html = await render(
    NewEpisodeEmail({ userName, episodes, podcastCount: channelCount })
  )
  const videoWord = videos.length === 1 ? "Video" : "Videos"
  return sendEmail(to, `Clarus - ${videos.length} New YouTube ${videoWord}`, html)
}

// ==================== Contact Form ====================

/**
 * Forwards a contact form submission to the admin inbox.
 * All user input is HTML-escaped before rendering to prevent XSS.
 */
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

import { Resend } from "resend"
import { render } from "@react-email/components"

// Email templates
import { WelcomeEmail } from "@/emails/welcome"
import { EmailVerificationEmail } from "@/emails/email-verification"
import { MagicLinkEmail } from "@/emails/magic-link"
import { PasswordResetEmail } from "@/emails/password-reset"
import { PasswordChangedEmail } from "@/emails/password-changed"
import { EmailChangedEmail } from "@/emails/email-changed"
import { AccountDeletedEmail } from "@/emails/account-deleted"
import { NewDeviceLoginEmail } from "@/emails/new-device-login"
import { AccountLockedEmail } from "@/emails/account-locked"
import { SubscriptionStartedEmail } from "@/emails/subscription-started"
import { PaymentReceiptEmail } from "@/emails/payment-receipt"
import { PaymentFailedEmail } from "@/emails/payment-failed"
import { SubscriptionRenewedEmail } from "@/emails/subscription-renewed"
import { SubscriptionCancelledEmail } from "@/emails/subscription-cancelled"
import { SubscriptionExpiringEmail } from "@/emails/subscription-expiring"
import { TrialEndingEmail } from "@/emails/trial-ending"
import { PlanUpgradedEmail } from "@/emails/plan-upgraded"
import { PlanDowngradedEmail } from "@/emails/plan-downgraded"
import { RefundProcessedEmail } from "@/emails/refund-processed"
import { FirstAnalysisCompleteEmail } from "@/emails/first-analysis-complete"
import { WeeklyDigestEmail } from "@/emails/weekly-digest"
import { InactivityReminderEmail } from "@/emails/inactivity-reminder"
import { FeatureAnnouncementEmail } from "@/emails/feature-announcement"
import { ContactFormReceiptEmail } from "@/emails/contact-form-receipt"
import { ShareAnalysisEmail } from "@/emails/share-analysis"

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = "Clarus <noreply@clarusapp.io>"

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<SendEmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
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

// ==================== User Management Emails ====================

export async function sendWelcomeEmail(to: string, userName?: string) {
  const html = await render(WelcomeEmail({ userName }))
  return sendEmail(to, "Clarus - Welcome to Clarus", html)
}

export async function sendEmailVerificationEmail(
  to: string,
  userName: string | undefined,
  verificationUrl: string
) {
  const html = await render(EmailVerificationEmail({ userName, verificationUrl }))
  return sendEmail(to, "Clarus - Verify Your Email", html)
}

export async function sendMagicLinkEmail(to: string, magicLinkUrl: string) {
  const html = await render(MagicLinkEmail({ magicLinkUrl }))
  return sendEmail(to, "Clarus - Your Sign-In Link", html)
}

export async function sendPasswordResetEmail(
  to: string,
  userName: string | undefined,
  resetUrl: string
) {
  const html = await render(PasswordResetEmail({ userName, resetUrl }))
  return sendEmail(to, "Clarus - Reset Your Password", html)
}

export async function sendPasswordChangedEmail(
  to: string,
  userName: string | undefined,
  changedAt: string,
  ipAddress?: string,
  location?: string
) {
  const html = await render(
    PasswordChangedEmail({ userName, changedAt, ipAddress, location })
  )
  return sendEmail(to, "Clarus - Password Changed", html)
}

export async function sendEmailChangedEmail(
  to: string,
  userName: string | undefined,
  oldEmail: string,
  newEmail: string,
  changedAt: string
) {
  const html = await render(
    EmailChangedEmail({ userName, oldEmail, newEmail, changedAt })
  )
  return sendEmail(to, "Clarus - Email Address Changed", html)
}

export async function sendAccountDeletedEmail(
  to: string,
  userName: string | undefined,
  deletedAt: string
) {
  const html = await render(AccountDeletedEmail({ userName, deletedAt }))
  return sendEmail(to, "Clarus - Account Deleted", html)
}

export async function sendNewDeviceLoginEmail(
  to: string,
  userName: string | undefined,
  device: string,
  browser: string,
  location: string,
  ipAddress: string,
  loginTime: string
) {
  const html = await render(
    NewDeviceLoginEmail({ userName, device, browser, location, ipAddress, loginTime })
  )
  return sendEmail(to, "Clarus - New Sign-In Detected", html)
}

export async function sendAccountLockedEmail(
  to: string,
  userName: string | undefined,
  lockedAt: string,
  unlockUrl: string
) {
  const html = await render(AccountLockedEmail({ userName, lockedAt, unlockUrl }))
  return sendEmail(to, "Clarus - Account Temporarily Locked", html)
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

export async function sendPaymentReceiptEmail(
  to: string,
  userName: string | undefined,
  invoiceNumber: string,
  amount: string,
  planName: string,
  billingPeriod: string,
  paymentDate: string,
  paymentMethod: string,
  invoiceUrl?: string
) {
  const html = await render(
    PaymentReceiptEmail({
      userName,
      invoiceNumber,
      amount,
      planName,
      billingPeriod,
      paymentDate,
      paymentMethod,
      invoiceUrl,
    })
  )
  return sendEmail(to, "Clarus - Payment Receipt", html)
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

export async function sendSubscriptionRenewedEmail(
  to: string,
  userName: string | undefined,
  planName: string,
  amount: string,
  renewalDate: string,
  nextBillingDate: string
) {
  const html = await render(
    SubscriptionRenewedEmail({ userName, planName, amount, renewalDate, nextBillingDate })
  )
  return sendEmail(to, "Clarus - Subscription Renewed", html)
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

export async function sendSubscriptionExpiringEmail(
  to: string,
  userName: string | undefined,
  planName: string,
  expirationDate: string,
  renewUrl: string
) {
  const html = await render(
    SubscriptionExpiringEmail({ userName, planName, expirationDate, renewUrl })
  )
  return sendEmail(to, "Clarus - Subscription Expiring Soon", html)
}

export async function sendTrialEndingEmail(
  to: string,
  userName: string | undefined,
  trialEndDate: string,
  daysRemaining: number,
  upgradeUrl: string
) {
  const html = await render(
    TrialEndingEmail({ userName, trialEndDate, daysRemaining, upgradeUrl })
  )
  return sendEmail(to, "Clarus - Trial Ending Soon", html)
}

export async function sendPlanUpgradedEmail(
  to: string,
  userName: string | undefined,
  previousPlan: string,
  newPlan: string,
  amount: string,
  effectiveDate: string
) {
  const html = await render(
    PlanUpgradedEmail({ userName, previousPlan, newPlan, amount, effectiveDate })
  )
  return sendEmail(to, "Clarus - Plan Upgraded", html)
}

export async function sendPlanDowngradedEmail(
  to: string,
  userName: string | undefined,
  previousPlan: string,
  newPlan: string,
  effectiveDate: string,
  featuresLosing: string[]
) {
  const html = await render(
    PlanDowngradedEmail({ userName, previousPlan, newPlan, effectiveDate, featuresLosing })
  )
  return sendEmail(to, "Clarus - Plan Changed", html)
}

export async function sendRefundProcessedEmail(
  to: string,
  userName: string | undefined,
  refundAmount: string,
  originalAmount: string,
  refundReason: string,
  refundDate: string,
  refundId: string
) {
  const html = await render(
    RefundProcessedEmail({
      userName,
      refundAmount,
      originalAmount,
      refundReason,
      refundDate,
      refundId,
    })
  )
  return sendEmail(to, "Clarus - Refund Processed", html)
}

// ==================== Engagement Emails ====================

export async function sendFirstAnalysisCompleteEmail(
  to: string,
  userName: string | undefined,
  contentTitle: string,
  contentUrl: string,
  analysisUrl: string
) {
  const html = await render(
    FirstAnalysisCompleteEmail({ userName, contentTitle, contentUrl, analysisUrl })
  )
  return sendEmail(to, "Clarus - Your First Analysis is Ready", html)
}

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

export async function sendInactivityReminderEmail(
  to: string,
  userName: string | undefined,
  daysSinceLastVisit: number,
  lastAnalysisTitle?: string
) {
  const html = await render(
    InactivityReminderEmail({ userName, daysSinceLastVisit, lastAnalysisTitle })
  )
  return sendEmail(to, "Clarus - We Miss You", html)
}

export async function sendFeatureAnnouncementEmail(
  to: string,
  userName: string | undefined,
  featureName: string,
  featureDescription: string,
  featureHighlights: string[],
  learnMoreUrl: string
) {
  const html = await render(
    FeatureAnnouncementEmail({
      userName,
      featureName,
      featureDescription,
      featureHighlights,
      learnMoreUrl,
    })
  )
  return sendEmail(to, "Clarus - New Feature Announcement", html)
}

// ==================== Support Emails ====================

export async function sendContactFormReceiptEmail(
  to: string,
  userName: string | undefined,
  ticketId: string,
  subject: string,
  message: string,
  submittedAt: string
) {
  const html = await render(
    ContactFormReceiptEmail({ userName, ticketId, subject, message, submittedAt })
  )
  return sendEmail(to, "Clarus - We Received Your Message", html)
}

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

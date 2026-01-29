// Base template
export { BaseEmail, baseStyles } from "./base-email"

// User Management Emails
export { WelcomeEmail } from "./welcome"
export { EmailVerificationEmail } from "./email-verification"
export { MagicLinkEmail } from "./magic-link"
export { PasswordResetEmail } from "./password-reset"
export { PasswordChangedEmail } from "./password-changed"
export { EmailChangedEmail } from "./email-changed"
export { AccountDeletedEmail } from "./account-deleted"
export { NewDeviceLoginEmail } from "./new-device-login"
export { AccountLockedEmail } from "./account-locked"

// Subscription/Transaction Emails
export { SubscriptionStartedEmail } from "./subscription-started"
export { PaymentReceiptEmail } from "./payment-receipt"
export { PaymentFailedEmail } from "./payment-failed"
export { SubscriptionRenewedEmail } from "./subscription-renewed"
export { SubscriptionCancelledEmail } from "./subscription-cancelled"
export { SubscriptionExpiringEmail } from "./subscription-expiring"
export { TrialEndingEmail } from "./trial-ending"
export { PlanUpgradedEmail } from "./plan-upgraded"
export { PlanDowngradedEmail } from "./plan-downgraded"
export { RefundProcessedEmail } from "./refund-processed"

// Engagement/Product Emails
export { FirstAnalysisCompleteEmail } from "./first-analysis-complete"
export { WeeklyDigestEmail } from "./weekly-digest"
export { InactivityReminderEmail } from "./inactivity-reminder"
export { FeatureAnnouncementEmail } from "./feature-announcement"

// Support Emails
export { ContactFormReceiptEmail } from "./contact-form-receipt"
export { ShareAnalysisEmail } from "./share-analysis"

// Email subjects for reference
export const emailSubjects = {
  welcome: "Clarus - Welcome to Clarus",
  emailVerification: "Clarus - Verify Your Email",
  magicLink: "Clarus - Your Sign-In Link",
  passwordReset: "Clarus - Reset Your Password",
  passwordChanged: "Clarus - Password Changed",
  emailChanged: "Clarus - Email Address Changed",
  accountDeleted: "Clarus - Account Deleted",
  newDeviceLogin: "Clarus - New Sign-In Detected",
  accountLocked: "Clarus - Account Temporarily Locked",
  subscriptionStarted: "Clarus - Welcome to Pro",
  paymentReceipt: "Clarus - Payment Receipt",
  paymentFailed: "Clarus - Payment Failed",
  subscriptionRenewed: "Clarus - Subscription Renewed",
  subscriptionCancelled: "Clarus - Subscription Cancelled",
  subscriptionExpiring: "Clarus - Subscription Expiring Soon",
  trialEnding: "Clarus - Trial Ending Soon",
  planUpgraded: "Clarus - Plan Upgraded",
  planDowngraded: "Clarus - Plan Changed",
  refundProcessed: "Clarus - Refund Processed",
  firstAnalysisComplete: "Clarus - Your First Analysis is Ready",
  weeklyDigest: "Clarus - Your Weekly Digest",
  inactivityReminder: "Clarus - We Miss You",
  featureAnnouncement: "Clarus - New Feature Announcement",
  contactFormReceipt: "Clarus - We Received Your Message",
  shareAnalysis: "Clarus - Someone Shared an Analysis With You",
}

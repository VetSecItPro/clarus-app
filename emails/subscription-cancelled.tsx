import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface SubscriptionCancelledEmailProps {
  userName?: string
  planName: string
  accessUntil: string
  resubscribeUrl: string
}

export const SubscriptionCancelledEmail = ({
  userName = "there",
  planName,
  accessUntil,
  resubscribeUrl,
}: SubscriptionCancelledEmailProps) => {
  return (
    <BaseEmail previewText="Your Clarus subscription has been cancelled">
      <Text style={baseStyles.heading}>Subscription cancelled</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        We're sorry to see you go. Your {planName} subscription has been cancelled
        as requested.
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.text, margin: "0" }}>
          <strong style={{ color: "#ffffff" }}>Good news:</strong> You'll continue
          to have access to all premium features until{" "}
          <strong style={{ color: "#ffffff" }}>{accessUntil}</strong>.
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        After your access period ends, you'll be switched to our free plan with
        limited features.
      </Text>

      <Text style={baseStyles.text}>
        Changed your mind? You can resubscribe anytime to regain full access.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href={resubscribeUrl} style={baseStyles.button}>
          Resubscribe to Pro
        </Link>
      </Section>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        We'd love to know why you cancelled. If you have a moment, reply to this
        email with your feedback — it helps us improve Clarus for everyone.
      </Text>

      <Text style={baseStyles.text}>
        Thank you for being a Clarus Pro member. We hope to see you again soon.
      </Text>

      <Text style={baseStyles.text}>
        Best regards,<br />
        The Clarus Team
      </Text>
    </BaseEmail>
  )
}

SubscriptionCancelledEmail.subject = "Clarus - Subscription Cancelled"

export default SubscriptionCancelledEmail

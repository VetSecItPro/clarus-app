import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface SubscriptionStartedEmailProps {
  userName?: string
  planName: string
  billingCycle: string
  amount: string
  nextBillingDate: string
}

export const SubscriptionStartedEmail = ({
  userName = "there",
  planName,
  billingCycle,
  amount,
  nextBillingDate,
}: SubscriptionStartedEmailProps) => {
  return (
    <BaseEmail previewText="Welcome to Clarus Pro - Your subscription is active">
      <Text style={baseStyles.heading}>Welcome to {planName}!</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Thank you for subscribing to Clarus! Your subscription is now active and
        you have full access to all premium features.
      </Text>

      <Section style={baseStyles.successBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 8px 0", color: "rgba(34, 197, 94, 0.9)" }}>
          <strong>Subscription Details</strong>
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Plan:</strong> {planName}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Billing:</strong> {billingCycle}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Amount:</strong> {amount}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0" }}>
          <strong style={{ color: "#ffffff" }}>Next billing date:</strong> {nextBillingDate}
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        Here's what you now have access to:
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          ✓ Unlimited content analysis
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          ✓ Advanced AI chat features
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          ✓ Priority processing
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0" }}>
          ✓ Export to PDF and Markdown
        </Text>
      </Section>

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io" style={baseStyles.button}>
          Start Analyzing
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        You can manage your subscription anytime in your{" "}
        <Link href="https://clarusapp.io/manage" style={baseStyles.link}>
          account settings
        </Link>
        .
      </Text>
    </BaseEmail>
  )
}

SubscriptionStartedEmail.subject = "Clarus - Welcome to Pro"

export default SubscriptionStartedEmail

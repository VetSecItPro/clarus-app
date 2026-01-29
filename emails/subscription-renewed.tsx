import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface SubscriptionRenewedEmailProps {
  userName?: string
  planName: string
  amount: string
  renewalDate: string
  nextBillingDate: string
}

export const SubscriptionRenewedEmail = ({
  userName = "there",
  planName,
  amount,
  renewalDate,
  nextBillingDate,
}: SubscriptionRenewedEmailProps) => {
  return (
    <BaseEmail previewText="Your Clarus subscription has been renewed">
      <Text style={baseStyles.heading}>Subscription renewed</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Great news! Your {planName} subscription has been successfully renewed.
        You'll continue to have access to all premium features.
      </Text>

      <Section style={baseStyles.successBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Plan:</strong> {planName}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Amount charged:</strong> {amount}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Renewal date:</strong> {renewalDate}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0" }}>
          <strong style={{ color: "#ffffff" }}>Next billing date:</strong> {nextBillingDate}
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        Thank you for continuing to trust Clarus for your content analysis needs.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io" style={baseStyles.button}>
          Continue Analyzing
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        Need to make changes?{" "}
        <Link href="https://clarusapp.io/manage" style={baseStyles.link}>
          Manage your subscription
        </Link>
      </Text>
    </BaseEmail>
  )
}

SubscriptionRenewedEmail.subject = "Clarus - Subscription Renewed"

export default SubscriptionRenewedEmail

import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface SubscriptionExpiringEmailProps {
  userName?: string
  planName: string
  expirationDate: string
  renewUrl: string
}

export const SubscriptionExpiringEmail = ({
  userName = "there",
  planName,
  expirationDate,
  renewUrl,
}: SubscriptionExpiringEmailProps) => {
  return (
    <BaseEmail previewText="Your Clarus subscription expires soon">
      <Text style={baseStyles.heading}>Your subscription expires soon</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Just a friendly reminder that your {planName} subscription will expire on{" "}
        <strong style={{ color: "#ffffff" }}>{expirationDate}</strong>.
      </Text>

      <Section style={baseStyles.warningBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0", color: "rgba(245, 158, 11, 0.9)" }}>
          After expiration, you'll lose access to:
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "8px 0 0 0", color: "rgba(245, 158, 11, 0.8)" }}>
          • Unlimited content analysis<br />
          • Advanced AI chat features<br />
          • Priority processing<br />
          • Export capabilities
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        Renew now to ensure uninterrupted access to all your premium features and
        your content library.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href={renewUrl} style={baseStyles.button}>
          Renew Subscription
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        If you have any questions or need assistance, our{" "}
        <Link href="https://clarusapp.io/support" style={baseStyles.link}>
          support team
        </Link>{" "}
        is here to help.
      </Text>
    </BaseEmail>
  )
}

SubscriptionExpiringEmail.subject = "Clarus - Subscription Expiring Soon"

export default SubscriptionExpiringEmail

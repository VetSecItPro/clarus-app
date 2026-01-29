import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface AccountDeletedEmailProps {
  userName?: string
  deletedAt: string
}

export const AccountDeletedEmail = ({
  userName = "there",
  deletedAt,
}: AccountDeletedEmailProps) => {
  return (
    <BaseEmail previewText="Your Clarus account has been deleted">
      <Text style={baseStyles.heading}>Account deleted</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Your Clarus account has been successfully deleted as requested. We're sorry
        to see you go.
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 8px 0" }}>
          <strong style={{ color: "#ffffff" }}>What happens next:</strong>
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          • Your account data has been permanently removed
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          • Your content library and analysis history have been deleted
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          • Any active subscription has been cancelled
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0" }}>
          • Deletion completed on: {deletedAt}
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        If you ever decide to come back, we'd be happy to have you. You can create
        a new account at any time.
      </Text>

      <Text style={baseStyles.textMuted}>
        We'd love to know why you left. If you have a moment, reply to this email
        with your feedback — it helps us improve Clarus for everyone.
      </Text>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.text}>
        Thank you for trying Clarus. We wish you all the best.
      </Text>

      <Text style={baseStyles.text}>
        Take care,<br />
        The Clarus Team
      </Text>
    </BaseEmail>
  )
}

AccountDeletedEmail.subject = "Clarus - Account Deleted"

export default AccountDeletedEmail

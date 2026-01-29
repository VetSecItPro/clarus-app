import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface EmailChangedEmailProps {
  userName?: string
  oldEmail: string
  newEmail: string
  changedAt: string
}

export const EmailChangedEmail = ({
  userName = "there",
  oldEmail,
  newEmail,
  changedAt,
}: EmailChangedEmailProps) => {
  return (
    <BaseEmail previewText="Your Clarus email address has been changed">
      <Text style={baseStyles.heading}>Email address updated</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        The email address associated with your Clarus account has been changed.
        Here are the details of this change:
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Previous email:</strong> {oldEmail}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>New email:</strong> {newEmail}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0" }}>
          <strong style={{ color: "#ffffff" }}>Changed at:</strong> {changedAt}
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        If you made this change, no further action is required. All future
        communications will be sent to your new email address.
      </Text>

      <Section style={baseStyles.warningBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0", color: "rgba(245, 158, 11, 0.9)" }}>
          <strong>Didn't make this change?</strong> Please contact our support team
          immediately to secure your account.
        </Text>
      </Section>

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io/support" style={baseStyles.buttonSecondary}>
          Contact Support
        </Link>
      </Section>
    </BaseEmail>
  )
}

EmailChangedEmail.subject = "Clarus - Email Address Changed"

export default EmailChangedEmail

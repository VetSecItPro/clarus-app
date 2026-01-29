import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface PasswordChangedEmailProps {
  userName?: string
  changedAt: string
  ipAddress?: string
  location?: string
}

export const PasswordChangedEmail = ({
  userName = "there",
  changedAt,
  ipAddress,
  location,
}: PasswordChangedEmailProps) => {
  return (
    <BaseEmail previewText="Your Clarus password has been changed">
      <Text style={baseStyles.heading}>Password successfully changed</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Your Clarus account password was successfully changed. If you made this
        change, no further action is required.
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Changed at:</strong> {changedAt}
        </Text>
        {ipAddress && (
          <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
            <strong style={{ color: "#ffffff" }}>IP Address:</strong> {ipAddress}
          </Text>
        )}
        {location && (
          <Text style={{ ...baseStyles.textMuted, margin: "0" }}>
            <strong style={{ color: "#ffffff" }}>Location:</strong> {location}
          </Text>
        )}
      </Section>

      <Section style={baseStyles.warningBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0", color: "rgba(245, 158, 11, 0.9)" }}>
          <strong>Didn't make this change?</strong> Your account may be compromised.
          Please reset your password immediately and contact our support team.
        </Text>
      </Section>

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io/forgot-password" style={baseStyles.buttonDanger}>
          Reset Password Now
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        If you have any questions or concerns, please don't hesitate to{" "}
        <Link href="https://clarusapp.io/support" style={baseStyles.link}>
          contact our support team
        </Link>
        .
      </Text>
    </BaseEmail>
  )
}

PasswordChangedEmail.subject = "Clarus - Password Changed"

export default PasswordChangedEmail

import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface PasswordResetEmailProps {
  userName?: string
  resetUrl: string
}

export const PasswordResetEmail = ({
  userName = "there",
  resetUrl,
}: PasswordResetEmailProps) => {
  return (
    <BaseEmail previewText="Reset your Clarus password">
      <Text style={baseStyles.heading}>Reset your password</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        We received a request to reset the password for your Clarus account. Click
        the button below to create a new password.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href={resetUrl} style={baseStyles.button}>
          Reset Password
        </Link>
      </Section>

      <Section style={baseStyles.warningBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0", color: "rgba(245, 158, 11, 0.9)" }}>
          This link will expire in 1 hour. If you didn't request a password reset,
          please ignore this email or{" "}
          <Link href="https://clarusapp.io/support" style={{ color: "rgba(245, 158, 11, 0.9)" }}>
            contact support
          </Link>{" "}
          if you're concerned about your account security.
        </Text>
      </Section>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        If the button doesn't work, copy and paste this link into your browser:
      </Text>
      <Text style={{ ...baseStyles.textMuted, wordBreak: "break-all" }}>
        <Link href={resetUrl} style={baseStyles.link}>
          {resetUrl}
        </Link>
      </Text>
    </BaseEmail>
  )
}

PasswordResetEmail.subject = "Clarus - Reset Your Password"

export default PasswordResetEmail

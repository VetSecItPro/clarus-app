import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface EmailVerificationProps {
  userName?: string
  verificationUrl: string
}

export const EmailVerificationEmail = ({
  userName = "there",
  verificationUrl,
}: EmailVerificationProps) => {
  return (
    <BaseEmail previewText="Verify your email address to get started">
      <Text style={baseStyles.heading}>Verify your email address</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Thank you for signing up for Clarus. To complete your registration and
        start analyzing content, please verify your email address by clicking the
        button below.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href={verificationUrl} style={baseStyles.button}>
          Verify Email Address
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        This link will expire in 24 hours. If you didn't create an account with
        Clarus, you can safely ignore this email.
      </Text>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        If the button doesn't work, copy and paste this link into your browser:
      </Text>
      <Text style={{ ...baseStyles.textMuted, wordBreak: "break-all" }}>
        <Link href={verificationUrl} style={baseStyles.link}>
          {verificationUrl}
        </Link>
      </Text>
    </BaseEmail>
  )
}

EmailVerificationEmail.subject = "Clarus - Verify Your Email"

export default EmailVerificationEmail

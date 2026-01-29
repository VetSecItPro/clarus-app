import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface MagicLinkEmailProps {
  magicLinkUrl: string
}

export const MagicLinkEmail = ({ magicLinkUrl }: MagicLinkEmailProps) => {
  return (
    <BaseEmail previewText="Your secure sign-in link for Clarus">
      <Text style={baseStyles.heading}>Sign in to Clarus</Text>

      <Text style={baseStyles.text}>
        You requested a magic link to sign in to your Clarus account. Click the
        button below to securely access your account — no password needed.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href={magicLinkUrl} style={baseStyles.button}>
          Sign In to Clarus
        </Link>
      </Section>

      <Section style={baseStyles.warningBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0", color: "rgba(245, 158, 11, 0.9)" }}>
          <strong>Security Notice:</strong> This link expires in 15 minutes and can
          only be used once. If you didn't request this link, please ignore this
          email — your account is secure.
        </Text>
      </Section>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        If the button doesn't work, copy and paste this link into your browser:
      </Text>
      <Text style={{ ...baseStyles.textMuted, wordBreak: "break-all" }}>
        <Link href={magicLinkUrl} style={baseStyles.link}>
          {magicLinkUrl}
        </Link>
      </Text>
    </BaseEmail>
  )
}

MagicLinkEmail.subject = "Clarus - Your Sign-In Link"

export default MagicLinkEmail

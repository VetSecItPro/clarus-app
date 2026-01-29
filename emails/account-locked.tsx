import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface AccountLockedEmailProps {
  userName?: string
  lockedAt: string
  unlockUrl: string
}

export const AccountLockedEmail = ({
  userName = "there",
  lockedAt,
  unlockUrl,
}: AccountLockedEmailProps) => {
  return (
    <BaseEmail previewText="Your Clarus account has been temporarily locked">
      <Text style={baseStyles.heading}>Account temporarily locked</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Your Clarus account has been temporarily locked due to multiple failed
        sign-in attempts. This is a security measure to protect your account.
      </Text>

      <Section style={baseStyles.warningBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0", color: "rgba(245, 158, 11, 0.9)" }}>
          <strong>Locked at:</strong> {lockedAt}
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        If this was you trying to sign in, you can unlock your account by clicking
        the button below and verifying your identity.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href={unlockUrl} style={baseStyles.button}>
          Unlock My Account
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        If you didn't attempt to sign in, someone may be trying to access your
        account. We recommend changing your password after unlocking your account.
      </Text>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        Need help? Contact our{" "}
        <Link href="https://clarusapp.io/support" style={baseStyles.link}>
          support team
        </Link>
        .
      </Text>
    </BaseEmail>
  )
}

AccountLockedEmail.subject = "Clarus - Account Temporarily Locked"

export default AccountLockedEmail

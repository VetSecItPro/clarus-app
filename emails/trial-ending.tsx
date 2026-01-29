import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface TrialEndingEmailProps {
  userName?: string
  trialEndDate: string
  daysRemaining: number
  upgradeUrl: string
}

export const TrialEndingEmail = ({
  userName = "there",
  trialEndDate,
  daysRemaining,
  upgradeUrl,
}: TrialEndingEmailProps) => {
  return (
    <BaseEmail previewText={`Your Clarus trial ends in ${daysRemaining} days`}>
      <Text style={baseStyles.heading}>
        Your trial ends in {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
      </Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        We hope you've been enjoying your Clarus Pro trial! Just a heads up that
        your trial period ends on <strong style={{ color: "#ffffff" }}>{trialEndDate}</strong>.
      </Text>

      <Text style={baseStyles.text}>
        During your trial, you've had access to all our premium features. To
        continue using them without interruption, upgrade to a paid plan today.
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          <strong style={{ color: "#ffffff" }}>What you'll keep with Pro:</strong>
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0 0 4px 0" }}>
          ✓ Unlimited content analysis
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0 0 4px 0" }}>
          ✓ Advanced AI chat features
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0 0 4px 0" }}>
          ✓ Your entire content library
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0" }}>
          ✓ Priority support
        </Text>
      </Section>

      <Section style={baseStyles.buttonSection}>
        <Link href={upgradeUrl} style={baseStyles.button}>
          Upgrade to Pro
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        Not ready to upgrade? No problem. You can continue using Clarus with our
        free plan, though some features will be limited.
      </Text>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        Have questions?{" "}
        <Link href="https://clarusapp.io/support" style={baseStyles.link}>
          Contact us
        </Link>
        .
      </Text>
    </BaseEmail>
  )
}

TrialEndingEmail.subject = "Clarus - Trial Ending Soon"

export default TrialEndingEmail

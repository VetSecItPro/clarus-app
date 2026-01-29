import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface PlanUpgradedEmailProps {
  userName?: string
  previousPlan: string
  newPlan: string
  amount: string
  effectiveDate: string
}

export const PlanUpgradedEmail = ({
  userName = "there",
  previousPlan,
  newPlan,
  amount,
  effectiveDate,
}: PlanUpgradedEmailProps) => {
  return (
    <BaseEmail previewText={`You've upgraded to ${newPlan}`}>
      <Text style={baseStyles.heading}>Plan upgraded successfully!</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Great choice! Your plan has been upgraded and you now have access to
        additional features.
      </Text>

      <Section style={baseStyles.successBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Previous plan:</strong> {previousPlan}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>New plan:</strong> {newPlan}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>New rate:</strong> {amount}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0" }}>
          <strong style={{ color: "#ffffff" }}>Effective:</strong> {effectiveDate}
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        Your new features are already active. Here's what you can now do:
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          ✓ Increased analysis limits
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          ✓ Advanced export options
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          ✓ Priority processing queue
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0" }}>
          ✓ Premium support
        </Text>
      </Section>

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io" style={baseStyles.button}>
          Explore New Features
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        Any prorated charges or credits will appear on your next invoice. You can
        view your billing details in your{" "}
        <Link href="https://clarusapp.io/manage" style={baseStyles.link}>
          account settings
        </Link>
        .
      </Text>
    </BaseEmail>
  )
}

PlanUpgradedEmail.subject = "Clarus - Plan Upgraded"

export default PlanUpgradedEmail

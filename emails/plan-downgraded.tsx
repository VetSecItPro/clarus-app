import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface PlanDowngradedEmailProps {
  userName?: string
  previousPlan: string
  newPlan: string
  effectiveDate: string
  featuresLosing: string[]
}

export const PlanDowngradedEmail = ({
  userName = "there",
  previousPlan,
  newPlan,
  effectiveDate,
  featuresLosing,
}: PlanDowngradedEmailProps) => {
  return (
    <BaseEmail previewText="Your Clarus plan has been changed">
      <Text style={baseStyles.heading}>Plan change confirmed</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Your plan change has been processed. Here are the details of your updated
        subscription.
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Previous plan:</strong> {previousPlan}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>New plan:</strong> {newPlan}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0" }}>
          <strong style={{ color: "#ffffff" }}>Effective date:</strong> {effectiveDate}
        </Text>
      </Section>

      <Section style={baseStyles.warningBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 8px 0", color: "rgba(245, 158, 11, 0.9)" }}>
          <strong>Features you'll no longer have access to:</strong>
        </Text>
        {featuresLosing.map((feature, index) => (
          <Text key={index} style={{ ...baseStyles.textMuted, margin: "0 0 4px 0", color: "rgba(245, 158, 11, 0.8)" }}>
            • {feature}
          </Text>
        ))}
      </Section>

      <Text style={baseStyles.text}>
        You'll continue to have access to your current features until {effectiveDate}.
        After that, your new plan will take effect.
      </Text>

      <Text style={baseStyles.text}>
        Changed your mind? You can upgrade again anytime.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io/pricing" style={baseStyles.buttonSecondary}>
          View Plans
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        If you have any questions about your plan change,{" "}
        <Link href="https://clarusapp.io/support" style={baseStyles.link}>
          contact our support team
        </Link>
        .
      </Text>
    </BaseEmail>
  )
}

PlanDowngradedEmail.subject = "Clarus - Plan Changed"

export default PlanDowngradedEmail

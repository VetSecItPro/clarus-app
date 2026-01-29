import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface FeatureAnnouncementEmailProps {
  userName?: string
  featureName: string
  featureDescription: string
  featureHighlights: string[]
  learnMoreUrl: string
}

export const FeatureAnnouncementEmail = ({
  userName = "there",
  featureName,
  featureDescription,
  featureHighlights,
  learnMoreUrl,
}: FeatureAnnouncementEmailProps) => {
  return (
    <BaseEmail previewText={`New feature: ${featureName}`}>
      <Text style={baseStyles.heading}>Introducing: {featureName}</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        We're excited to announce a new feature that we think you'll love!
      </Text>

      <Section style={baseStyles.successBox}>
        <Text style={{ ...baseStyles.text, margin: "0", color: "rgba(34, 197, 94, 0.9)" }}>
          {featureDescription}
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        <strong style={{ color: "#ffffff" }}>What's new:</strong>
      </Text>

      <Section style={baseStyles.infoBox}>
        {featureHighlights.map((highlight, index) => (
          <Text key={index} style={{ ...baseStyles.text, margin: index === featureHighlights.length - 1 ? "0" : "0 0 8px 0" }}>
            ✓ {highlight}
          </Text>
        ))}
      </Section>

      <Text style={baseStyles.text}>
        This feature is available now for all users. Give it a try and let us know
        what you think!
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href={learnMoreUrl} style={baseStyles.button}>
          Try It Now
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        Have feedback or suggestions for future features? We'd love to hear from
        you — just reply to this email.
      </Text>

      <Text style={baseStyles.text}>
        Happy analyzing,<br />
        The Clarus Team
      </Text>
    </BaseEmail>
  )
}

FeatureAnnouncementEmail.subject = "Clarus - New Feature Announcement"

export default FeatureAnnouncementEmail

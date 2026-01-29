import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface InactivityReminderEmailProps {
  userName?: string
  daysSinceLastVisit: number
  lastAnalysisTitle?: string
}

export const InactivityReminderEmail = ({
  userName = "there",
  daysSinceLastVisit,
  lastAnalysisTitle,
}: InactivityReminderEmailProps) => {
  return (
    <BaseEmail previewText="We miss you at Clarus!">
      <Text style={baseStyles.heading}>We miss you!</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        It's been {daysSinceLastVisit} days since your last visit to Clarus. We
        wanted to check in and remind you that your content analysis companion is
        always here when you need it.
      </Text>

      {lastAnalysisTitle && (
        <Section style={baseStyles.infoBox}>
          <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
            <strong style={{ color: "#ffffff" }}>Your last analysis:</strong>
          </Text>
          <Text style={{ ...baseStyles.text, margin: "0" }}>
            {lastAnalysisTitle}
          </Text>
        </Section>
      )}

      <Text style={baseStyles.text}>
        Here are some things you might want to catch up on:
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          📰 <strong style={{ color: "#ffffff" }}>Analyze trending articles</strong> —
          Stay informed on the topics that matter to you.
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          🎥 <strong style={{ color: "#ffffff" }}>Summarize long videos</strong> —
          Get the key points without watching the full thing.
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0" }}>
          💬 <strong style={{ color: "#ffffff" }}>Review your library</strong> —
          Revisit past analyses and continue conversations.
        </Text>
      </Section>

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io" style={baseStyles.button}>
          Return to Clarus
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        Have feedback or suggestions? We'd love to hear from you — just reply to
        this email.
      </Text>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        Don't want to receive these reminders?{" "}
        <Link href="https://clarusapp.io/settings" style={baseStyles.link}>
          Update your preferences
        </Link>
      </Text>
    </BaseEmail>
  )
}

InactivityReminderEmail.subject = "Clarus - We Miss You"

export default InactivityReminderEmail

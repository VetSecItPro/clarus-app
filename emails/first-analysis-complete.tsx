import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface FirstAnalysisCompleteEmailProps {
  userName?: string
  contentTitle: string
  contentUrl: string
  analysisUrl: string
}

export const FirstAnalysisCompleteEmail = ({
  userName = "there",
  contentTitle,
  contentUrl,
  analysisUrl,
}: FirstAnalysisCompleteEmailProps) => {
  return (
    <BaseEmail previewText="Your first analysis is ready!">
      <Text style={baseStyles.heading}>Your first analysis is ready!</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Congratulations on completing your first content analysis with Clarus!
        You're now part of a community that values clarity and understanding.
      </Text>

      <Section style={baseStyles.successBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>You analyzed:</strong>
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0" }}>
          {contentTitle}
        </Text>
      </Section>

      <Section style={baseStyles.buttonSection}>
        <Link href={analysisUrl} style={baseStyles.button}>
          View Your Analysis
        </Link>
      </Section>

      <Text style={baseStyles.text}>
        Here's what else you can do with Clarus:
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          <strong style={{ color: "#ffffff" }}>Chat with your content</strong> — Ask
          follow-up questions and dive deeper into any topic.
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          <strong style={{ color: "#ffffff" }}>Build your library</strong> — Save and
          organize all your analyzed content for easy reference.
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0" }}>
          <strong style={{ color: "#ffffff" }}>Share insights</strong> — Export or
          share your analysis with colleagues.
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        Ready to analyze more? Just paste any URL into Clarus and let the AI do
        the heavy lifting.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io" style={baseStyles.buttonSecondary}>
          Analyze More Content
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        Happy analyzing!<br />
        The Clarus Team
      </Text>
    </BaseEmail>
  )
}

FirstAnalysisCompleteEmail.subject = "Clarus - Your First Analysis is Ready"

export default FirstAnalysisCompleteEmail

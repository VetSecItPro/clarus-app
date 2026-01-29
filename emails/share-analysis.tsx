import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface ShareAnalysisEmailProps {
  senderName: string
  senderEmail: string
  recipientName?: string
  contentTitle: string
  contentUrl: string
  analysisUrl: string
  personalMessage?: string
}

export const ShareAnalysisEmail = ({
  senderName,
  senderEmail,
  recipientName = "there",
  contentTitle,
  contentUrl,
  analysisUrl,
  personalMessage,
}: ShareAnalysisEmailProps) => {
  return (
    <BaseEmail previewText={`${senderName} shared an analysis with you`}>
      <Text style={baseStyles.heading}>{senderName} shared an analysis with you</Text>

      <Text style={baseStyles.text}>Hi {recipientName},</Text>

      <Text style={baseStyles.text}>
        {senderName} ({senderEmail}) thought you might find this content analysis
        interesting and wanted to share it with you.
      </Text>

      {personalMessage && (
        <Section style={baseStyles.infoBox}>
          <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
            <strong style={{ color: "#ffffff" }}>Personal message:</strong>
          </Text>
          <Text style={{ ...baseStyles.text, margin: "0", fontStyle: "italic" }}>
            "{personalMessage}"
          </Text>
        </Section>
      )}

      <Section style={{ ...baseStyles.infoBox, backgroundColor: "rgba(255, 255, 255, 0.03)", borderColor: "rgba(255, 255, 255, 0.08)" }}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 8px 0" }}>
          <strong style={{ color: "#ffffff" }}>Shared content:</strong>
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0 0 4px 0", fontWeight: "500" }}>
          {contentTitle}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0", wordBreak: "break-all" }}>
          <Link href={contentUrl} style={baseStyles.link}>
            {contentUrl}
          </Link>
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        Click below to view the full analysis, including key insights, summary,
        and quality assessment.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href={analysisUrl} style={baseStyles.button}>
          View Analysis
        </Link>
      </Section>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        <strong style={{ color: "#ffffff" }}>What is Clarus?</strong>
      </Text>

      <Text style={baseStyles.textMuted}>
        Clarus is an AI-powered content analysis tool that helps you understand
        articles, videos, and web content with clarity and depth. Want to analyze
        your own content?
      </Text>

      <Section style={{ ...baseStyles.buttonSection, marginTop: "16px" }}>
        <Link href="https://clarusapp.io/signup" style={baseStyles.buttonSecondary}>
          Try Clarus Free
        </Link>
      </Section>
    </BaseEmail>
  )
}

ShareAnalysisEmail.subject = "Clarus - Someone Shared an Analysis With You"

export default ShareAnalysisEmail

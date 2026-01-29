import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface AnalysisSummary {
  title: string
  url: string
  qualityScore: number
}

interface WeeklyDigestEmailProps {
  userName?: string
  weekOf: string
  totalAnalyses: number
  topAnalyses: AnalysisSummary[]
  avgQualityScore: number
}

export const WeeklyDigestEmail = ({
  userName = "there",
  weekOf,
  totalAnalyses,
  topAnalyses,
  avgQualityScore,
}: WeeklyDigestEmailProps) => {
  return (
    <BaseEmail previewText={`Your Clarus weekly digest - ${totalAnalyses} analyses`}>
      <Text style={baseStyles.heading}>Your weekly digest</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Here's a summary of your Clarus activity for the week of {weekOf}.
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0", textAlign: "center" as const }}>
          <span style={{ fontSize: "32px", fontWeight: "700", color: "#1d9bf0" }}>
            {totalAnalyses}
          </span>
          <br />
          <span style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "14px" }}>
            content pieces analyzed
          </span>
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0", textAlign: "center" as const }}>
          <span style={{ fontSize: "24px", fontWeight: "600", color: "#22c55e" }}>
            {avgQualityScore}%
          </span>
          <br />
          <span style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "14px" }}>
            average content quality
          </span>
        </Text>
      </Section>

      {topAnalyses.length > 0 && (
        <>
          <Text style={baseStyles.text}>
            <strong style={{ color: "#ffffff" }}>Your top analyses this week:</strong>
          </Text>

          {topAnalyses.map((analysis, index) => (
            <Section
              key={index}
              style={{
                ...baseStyles.infoBox,
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <Text style={{ ...baseStyles.text, margin: "0 0 4px 0" }}>
                <Link href={analysis.url} style={{ ...baseStyles.link, fontWeight: "500" }}>
                  {analysis.title}
                </Link>
              </Text>
              <Text style={{ ...baseStyles.textMuted, margin: "0" }}>
                Quality Score: {analysis.qualityScore}%
              </Text>
            </Section>
          ))}
        </>
      )}

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io/library" style={baseStyles.button}>
          View Your Library
        </Link>
      </Section>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        Keep up the great work! Every analysis helps you stay informed and think
        more clearly.
      </Text>

      <Text style={baseStyles.textMuted}>
        Don't want weekly digests?{" "}
        <Link href="https://clarusapp.io/settings" style={baseStyles.link}>
          Update your preferences
        </Link>
      </Text>
    </BaseEmail>
  )
}

WeeklyDigestEmail.subject = "Clarus - Your Weekly Digest"

export default WeeklyDigestEmail

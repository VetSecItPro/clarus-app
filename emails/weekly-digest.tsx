import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"
import type { WeeklyInsights } from "@/types/database.types"

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
  insights?: WeeklyInsights
}

// Topic pill colors — cycles through a curated palette
const TOPIC_COLORS = [
  { bg: "rgba(29, 155, 240, 0.15)", border: "rgba(29, 155, 240, 0.3)", text: "#1d9bf0" },
  { bg: "rgba(139, 92, 246, 0.15)", border: "rgba(139, 92, 246, 0.3)", text: "#8b5cf6" },
  { bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.3)", text: "#22c55e" },
  { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)", text: "#f59e0b" },
  { bg: "rgba(236, 72, 153, 0.15)", border: "rgba(236, 72, 153, 0.3)", text: "#ec4899" },
]

export const WeeklyDigestEmail = ({
  userName = "there",
  weekOf,
  totalAnalyses,
  topAnalyses,
  avgQualityScore,
  insights,
}: WeeklyDigestEmailProps) => {
  const hasInsights = insights && (
    insights.trending_topics.length > 0 ||
    insights.contradictions.length > 0 ||
    insights.time_saved_minutes > 0 ||
    insights.recommended_revisits.length > 0
  )

  return (
    <BaseEmail previewText={`Your Clarus weekly digest - ${totalAnalyses} analyses`}>
      <Text style={baseStyles.heading}>Your weekly digest</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Here's a summary of your Clarus activity for the week of {weekOf}.
      </Text>

      {/* Hero stats row */}
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
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0", textAlign: "center" as const }}>
          <span style={{ fontSize: "24px", fontWeight: "600", color: "#22c55e" }}>
            {avgQualityScore}%
          </span>
          <br />
          <span style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "14px" }}>
            average content quality
          </span>
        </Text>
        {/* Time saved hero stat */}
        {insights && insights.time_saved_minutes > 0 && (
          <Text style={{ ...baseStyles.text, margin: "0", textAlign: "center" as const }}>
            <span style={{ fontSize: "24px", fontWeight: "600", color: "#f59e0b" }}>
              ~{insights.time_saved_minutes} min
            </span>
            <br />
            <span style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "14px" }}>
              reading time saved this week
            </span>
          </Text>
        )}
      </Section>

      {/* Trending Topics */}
      {hasInsights && insights.trending_topics.length > 0 && (
        <>
          <Text style={{ ...baseStyles.text, marginTop: "24px" }}>
            <strong style={{ color: "#ffffff" }}>Trending in your analyses:</strong>
          </Text>
          <Section style={{ margin: "0 0 16px 0" }}>
            <Text style={{ ...baseStyles.text, margin: "0", lineHeight: "2.4" }}>
              {insights.trending_topics.map((topic, i) => {
                const color = TOPIC_COLORS[i % TOPIC_COLORS.length]
                return (
                  <span key={i}>
                    <span
                      style={{
                        backgroundColor: color.bg,
                        border: `1px solid ${color.border}`,
                        borderRadius: "9999px",
                        padding: "4px 12px",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: color.text,
                        display: "inline-block",
                        marginRight: "8px",
                        marginBottom: "4px",
                      }}
                    >
                      {topic.topic} ({topic.count})
                    </span>
                  </span>
                )
              })}
            </Text>
          </Section>
        </>
      )}

      {/* Claim Contradictions */}
      {hasInsights && insights.contradictions.length > 0 && (
        <>
          <Text style={{ ...baseStyles.text, marginTop: "24px" }}>
            <strong style={{ color: "#ffffff" }}>Contradictions found across your sources:</strong>
          </Text>
          {insights.contradictions.map((contradiction, i) => (
            <Section
              key={i}
              style={{
                ...baseStyles.warningBox,
                marginBottom: "8px",
              }}
            >
              <Text style={{ ...baseStyles.text, margin: "0 0 8px 0", fontSize: "14px" }}>
                <span style={{ color: "#f59e0b", fontWeight: "600" }}>Source A:</span>{" "}
                <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>{contradiction.source_a}</span>
              </Text>
              <Text style={{ ...baseStyles.text, margin: "0 0 12px 0", fontSize: "14px", fontStyle: "italic" }}>
                &ldquo;{contradiction.claim_a}&rdquo;
              </Text>
              <Text style={{ ...baseStyles.text, margin: "0 0 8px 0", fontSize: "14px" }}>
                <span style={{ color: "#f59e0b", fontWeight: "600" }}>Source B:</span>{" "}
                <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>{contradiction.source_b}</span>
              </Text>
              <Text style={{ ...baseStyles.text, margin: "0", fontSize: "14px", fontStyle: "italic" }}>
                &ldquo;{contradiction.claim_b}&rdquo;
              </Text>
            </Section>
          ))}
        </>
      )}

      {/* Top Analyses */}
      {topAnalyses.length > 0 && (
        <>
          <Text style={{ ...baseStyles.text, marginTop: "24px" }}>
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

      {/* Worth Revisiting */}
      {hasInsights && insights.recommended_revisits.length > 0 && (
        <>
          <Text style={{ ...baseStyles.text, marginTop: "24px" }}>
            <strong style={{ color: "#ffffff" }}>Worth revisiting:</strong>
          </Text>
          {insights.recommended_revisits.map((item, i) => (
            <Section
              key={i}
              style={{
                ...baseStyles.successBox,
                marginBottom: "8px",
              }}
            >
              <Text style={{ ...baseStyles.text, margin: "0 0 4px 0" }}>
                <Link
                  href={`https://clarusapp.io/item/${item.content_id}`}
                  style={{ ...baseStyles.link, fontWeight: "500", color: "#22c55e" }}
                >
                  {item.title}
                </Link>
              </Text>
              <Text style={{ ...baseStyles.textMuted, margin: "0", fontSize: "13px" }}>
                {item.reason}
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

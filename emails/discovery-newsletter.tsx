import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface TrendingItem {
  title: string
  shareUrl: string
  type: string
  domain: string
  teaser: string
  qualityScore: number
}

interface DiscoveryNewsletterEmailProps {
  userName?: string
  weekOf: string
  trendingItems: TrendingItem[]
}

const typeLabels: Record<string, string> = {
  youtube: "YouTube",
  article: "Article",
  x_post: "X Post",
  pdf: "PDF",
}

export const DiscoveryNewsletterEmail = ({
  userName = "there",
  weekOf,
  trendingItems,
}: DiscoveryNewsletterEmailProps) => {
  return (
    <BaseEmail previewText={`Trending on Clarus - Week of ${weekOf}`}>
      <Text style={baseStyles.heading}>Trending on Clarus</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Here are the most interesting analyses shared on Clarus this week. Discover
        content vetted by AI for accuracy, depth, and actionable insights.
      </Text>

      {trendingItems.map((item, index) => (
        <Section
          key={index}
          style={{
            ...baseStyles.infoBox,
            backgroundColor: index < 3 ? "rgba(29, 155, 240, 0.08)" : "rgba(255, 255, 255, 0.03)",
            borderColor: index < 3 ? "rgba(29, 155, 240, 0.15)" : "rgba(255, 255, 255, 0.08)",
          }}
        >
          <Text style={{ margin: "0 0 6px 0", fontSize: "11px", color: "rgba(255, 255, 255, 0.4)" }}>
            {typeLabels[item.type] || "Article"} &middot; {item.domain} &middot; {item.qualityScore.toFixed(1)}/10
          </Text>
          <Text style={{ ...baseStyles.text, margin: "0 0 6px 0" }}>
            <Link href={item.shareUrl} style={{ ...baseStyles.link, fontWeight: "600", fontSize: "15px" }}>
              {item.title}
            </Link>
          </Text>
          {item.teaser && (
            <Text style={{ ...baseStyles.textMuted, margin: "0" }}>
              {item.teaser}
            </Text>
          )}
        </Section>
      ))}

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io/discover" style={baseStyles.button}>
          See All Trending
        </Link>
      </Section>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        These analyses were shared publicly by Clarus users. No personal information
        is included — just great content and AI-powered insights.
      </Text>

      <Text style={baseStyles.textMuted}>
        Don&apos;t want discovery emails?{" "}
        <Link href="https://clarusapp.io/settings" style={baseStyles.link}>
          Update your preferences
        </Link>
      </Text>
    </BaseEmail>
  )
}

DiscoveryNewsletterEmail.subject = "Clarus - Trending This Week"

export default DiscoveryNewsletterEmail

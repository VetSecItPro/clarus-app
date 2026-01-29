import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface WelcomeEmailProps {
  userName?: string
}

export const WelcomeEmail = ({ userName = "there" }: WelcomeEmailProps) => {
  return (
    <BaseEmail previewText="Welcome to Clarus - Let's get you started">
      <Text style={baseStyles.heading}>Welcome to Clarus, {userName}!</Text>

      <Text style={baseStyles.text}>
        We're thrilled to have you join us. Clarus is your AI-powered companion for
        understanding content with clarity and depth.
      </Text>

      <Text style={baseStyles.text}>
        Here's what you can do with Clarus:
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          <strong style={{ color: "#ffffff" }}>Analyze any content</strong> — Paste a URL and get instant,
          comprehensive analysis of articles, videos, and more.
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0 0 8px 0" }}>
          <strong style={{ color: "#ffffff" }}>Chat with your content</strong> — Ask questions,
          dive deeper, and extract exactly what you need.
        </Text>
        <Text style={{ ...baseStyles.text, margin: "0" }}>
          <strong style={{ color: "#ffffff" }}>Build your library</strong> — Save and organize
          everything you've analyzed for easy reference.
        </Text>
      </Section>

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io" style={baseStyles.button}>
          Start Analyzing Content
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        If you have any questions or feedback, simply reply to this email — we'd love to hear from you.
      </Text>

      <Text style={baseStyles.text}>
        Welcome aboard,<br />
        The Clarus Team
      </Text>
    </BaseEmail>
  )
}

WelcomeEmail.subject = "Clarus - Welcome to Clarus"

export default WelcomeEmail

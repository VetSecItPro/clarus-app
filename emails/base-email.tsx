import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"

interface BaseEmailProps {
  previewText: string
  children: React.ReactNode
}

export const baseStyles = {
  main: {
    backgroundColor: "#000000",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  container: {
    margin: "0 auto",
    padding: "40px 20px",
    maxWidth: "640px",
  },
  header: {
    marginBottom: "32px",
  },
  headerRow: {
    width: "100%",
  },
  logoColumn: {
    width: "140px",
    verticalAlign: "top",
    paddingRight: "24px",
  },
  contentColumn: {
    verticalAlign: "middle",
  },
  logo: {
    width: "120px",
    height: "auto",
  },
  headerText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: "14px",
    lineHeight: "1.5",
    margin: "0",
  },
  content: {
    backgroundColor: "#111111",
    borderRadius: "16px",
    padding: "40px 32px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  heading: {
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "600",
    lineHeight: "1.3",
    margin: "0 0 16px 0",
  },
  text: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 16px 0",
  },
  textMuted: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: "14px",
    lineHeight: "1.6",
    margin: "0 0 16px 0",
  },
  button: {
    backgroundColor: "#1d9bf0",
    borderRadius: "9999px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "600",
    lineHeight: "1",
    padding: "14px 28px",
    textAlign: "center" as const,
    textDecoration: "none",
  },
  buttonSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: "9999px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "600",
    lineHeight: "1",
    padding: "14px 28px",
    textAlign: "center" as const,
    textDecoration: "none",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  },
  buttonDanger: {
    backgroundColor: "#ef4444",
    borderRadius: "9999px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "600",
    lineHeight: "1",
    padding: "14px 28px",
    textAlign: "center" as const,
    textDecoration: "none",
  },
  buttonSection: {
    textAlign: "center" as const,
    margin: "32px 0",
  },
  divider: {
    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    margin: "24px 0",
  },
  infoBox: {
    backgroundColor: "rgba(29, 155, 240, 0.1)",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid rgba(29, 155, 240, 0.2)",
    margin: "16px 0",
  },
  warningBox: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid rgba(245, 158, 11, 0.2)",
    margin: "16px 0",
  },
  successBox: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid rgba(34, 197, 94, 0.2)",
    margin: "16px 0",
  },
  footer: {
    textAlign: "center" as const,
    marginTop: "32px",
  },
  footerText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: "12px",
    lineHeight: "1.5",
    margin: "0",
  },
  footerLink: {
    color: "rgba(255, 255, 255, 0.5)",
    textDecoration: "underline",
  },
  link: {
    color: "#1d9bf0",
    textDecoration: "none",
  },
  code: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: "6px",
    color: "#ffffff",
    fontFamily: "monospace",
    fontSize: "14px",
    padding: "2px 6px",
  },
}

export function BaseEmail({ previewText, children }: BaseEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={baseStyles.main}>
        <Container style={baseStyles.container}>
          {/* Header with logo on left */}
          <Section style={baseStyles.header}>
            <Row style={baseStyles.headerRow}>
              <Column style={baseStyles.logoColumn}>
                <Img
                  src="https://clarusapp.io/clarus-email-logo-optimized.png"
                  width="120"
                  height="auto"
                  alt="Clarus"
                  style={baseStyles.logo}
                />
              </Column>
              <Column style={baseStyles.contentColumn}>
                <Text style={baseStyles.headerText}>
                  AI-powered content analysis for clarity and understanding
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Main content */}
          <Section style={baseStyles.content}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={baseStyles.footer}>
            <Text style={baseStyles.footerText}>
              <Link href="https://clarusapp.io/privacy" style={baseStyles.footerLink}>
                Privacy Policy
              </Link>
              {" · "}
              <Link href="https://clarusapp.io/terms" style={baseStyles.footerLink}>
                Terms of Service
              </Link>
              {" · "}
              <Link href="https://clarusapp.io/unsubscribe" style={baseStyles.footerLink}>
                Unsubscribe
              </Link>
            </Text>
            <Text style={baseStyles.footerText}>
              © {new Date().getFullYear()} Clarus. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default BaseEmail

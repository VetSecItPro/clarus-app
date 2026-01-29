import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface ContactFormReceiptEmailProps {
  userName?: string
  ticketId: string
  subject: string
  message: string
  submittedAt: string
}

export const ContactFormReceiptEmail = ({
  userName = "there",
  ticketId,
  subject,
  message,
  submittedAt,
}: ContactFormReceiptEmailProps) => {
  return (
    <BaseEmail previewText="We received your message">
      <Text style={baseStyles.heading}>We received your message</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Thank you for reaching out. We've received your support request and will
        get back to you as soon as possible.
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 8px 0" }}>
          <strong style={{ color: "#ffffff" }}>Ticket ID:</strong> {ticketId}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 8px 0" }}>
          <strong style={{ color: "#ffffff" }}>Subject:</strong> {subject}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 8px 0" }}>
          <strong style={{ color: "#ffffff" }}>Submitted:</strong> {submittedAt}
        </Text>
        <Section style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", marginTop: "12px", paddingTop: "12px" }}>
          <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
            <strong style={{ color: "#ffffff" }}>Your message:</strong>
          </Text>
          <Text style={{ ...baseStyles.textMuted, margin: "0", fontStyle: "italic" }}>
            "{message}"
          </Text>
        </Section>
      </Section>

      <Text style={baseStyles.text}>
        <strong style={{ color: "#ffffff" }}>What happens next?</strong>
      </Text>

      <Text style={baseStyles.text}>
        Our support team typically responds within 24-48 hours during business
        days. For Pro subscribers, responses are prioritized and usually faster.
      </Text>

      <Text style={baseStyles.textMuted}>
        Need to add more details? Simply reply to this email and your message will
        be added to your existing ticket.
      </Text>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        While you wait, you might find answers in our{" "}
        <Link href="https://clarusapp.io/help" style={baseStyles.link}>
          help center
        </Link>
        .
      </Text>

      <Text style={baseStyles.text}>
        Thank you for your patience,<br />
        The Clarus Support Team
      </Text>
    </BaseEmail>
  )
}

ContactFormReceiptEmail.subject = "Clarus - We Received Your Message"

export default ContactFormReceiptEmail

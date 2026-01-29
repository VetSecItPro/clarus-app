import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface RefundProcessedEmailProps {
  userName?: string
  refundAmount: string
  originalAmount: string
  refundReason: string
  refundDate: string
  refundId: string
}

export const RefundProcessedEmail = ({
  userName = "there",
  refundAmount,
  originalAmount,
  refundReason,
  refundDate,
  refundId,
}: RefundProcessedEmailProps) => {
  return (
    <BaseEmail previewText={`Refund of ${refundAmount} processed`}>
      <Text style={baseStyles.heading}>Refund processed</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        We've processed your refund request. Here are the details:
      </Text>

      <Section style={baseStyles.successBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Refund ID:</strong> {refundId}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Refund amount:</strong> {refundAmount}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Original charge:</strong> {originalAmount}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Reason:</strong> {refundReason}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0" }}>
          <strong style={{ color: "#ffffff" }}>Processed on:</strong> {refundDate}
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        The refund will be credited to your original payment method within 5-10
        business days, depending on your bank or card issuer.
      </Text>

      <Text style={baseStyles.textMuted}>
        Please note that while the refund is processed immediately on our end, it
        may take additional time to appear on your statement.
      </Text>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.text}>
        We're sorry things didn't work out this time. If you ever want to give
        Clarus another try, we'd be happy to have you back.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io" style={baseStyles.buttonSecondary}>
          Visit Clarus
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        If you have any questions about this refund, please{" "}
        <Link href="https://clarusapp.io/support" style={baseStyles.link}>
          contact our support team
        </Link>
        .
      </Text>
    </BaseEmail>
  )
}

RefundProcessedEmail.subject = "Clarus - Refund Processed"

export default RefundProcessedEmail

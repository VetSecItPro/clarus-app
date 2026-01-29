import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface PaymentFailedEmailProps {
  userName?: string
  amount: string
  planName: string
  failureReason: string
  retryDate: string
  updatePaymentUrl: string
}

export const PaymentFailedEmail = ({
  userName = "there",
  amount,
  planName,
  failureReason,
  retryDate,
  updatePaymentUrl,
}: PaymentFailedEmailProps) => {
  return (
    <BaseEmail previewText="Action required: Payment failed for your Clarus subscription">
      <Text style={baseStyles.heading}>Payment failed</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        We were unable to process your payment of {amount} for your {planName}
        subscription. Don't worry — your access is still active, but we need you
        to update your payment method to avoid interruption.
      </Text>

      <Section style={baseStyles.warningBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0", color: "rgba(245, 158, 11, 0.9)" }}>
          <strong>Reason:</strong> {failureReason}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0", color: "rgba(245, 158, 11, 0.9)" }}>
          <strong>Next retry:</strong> {retryDate}
        </Text>
      </Section>

      <Text style={baseStyles.text}>
        Please update your payment information to ensure uninterrupted access to
        Clarus Pro features.
      </Text>

      <Section style={baseStyles.buttonSection}>
        <Link href={updatePaymentUrl} style={baseStyles.button}>
          Update Payment Method
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        Common reasons for payment failure:
      </Text>
      <Text style={baseStyles.textMuted}>
        • Insufficient funds<br />
        • Expired card<br />
        • Bank declined the transaction<br />
        • Incorrect billing information
      </Text>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        If you believe this is an error or need assistance, please{" "}
        <Link href="https://clarusapp.io/support" style={baseStyles.link}>
          contact our support team
        </Link>
        .
      </Text>
    </BaseEmail>
  )
}

PaymentFailedEmail.subject = "Clarus - Payment Failed"

export default PaymentFailedEmail

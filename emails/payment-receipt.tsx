import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface PaymentReceiptEmailProps {
  userName?: string
  invoiceNumber: string
  amount: string
  planName: string
  billingPeriod: string
  paymentDate: string
  paymentMethod: string
  invoiceUrl?: string
}

export const PaymentReceiptEmail = ({
  userName = "there",
  invoiceNumber,
  amount,
  planName,
  billingPeriod,
  paymentDate,
  paymentMethod,
  invoiceUrl,
}: PaymentReceiptEmailProps) => {
  return (
    <BaseEmail previewText={`Payment receipt for ${amount} - Clarus`}>
      <Text style={baseStyles.heading}>Payment received</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        Thank you for your payment. Here's your receipt for your records.
      </Text>

      <Section style={{ ...baseStyles.infoBox, backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.1)" }}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 16px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "12px" }}>
          <strong style={{ color: "#ffffff", fontSize: "18px" }}>Receipt</strong>
        </Text>

        <Text style={{ ...baseStyles.textMuted, margin: "0 0 8px 0" }}>
          <strong style={{ color: "rgba(255, 255, 255, 0.6)" }}>Invoice Number</strong><br />
          <span style={{ color: "#ffffff" }}>{invoiceNumber}</span>
        </Text>

        <Text style={{ ...baseStyles.textMuted, margin: "0 0 8px 0" }}>
          <strong style={{ color: "rgba(255, 255, 255, 0.6)" }}>Date</strong><br />
          <span style={{ color: "#ffffff" }}>{paymentDate}</span>
        </Text>

        <Text style={{ ...baseStyles.textMuted, margin: "0 0 8px 0" }}>
          <strong style={{ color: "rgba(255, 255, 255, 0.6)" }}>Description</strong><br />
          <span style={{ color: "#ffffff" }}>{planName} - {billingPeriod}</span>
        </Text>

        <Text style={{ ...baseStyles.textMuted, margin: "0 0 8px 0" }}>
          <strong style={{ color: "rgba(255, 255, 255, 0.6)" }}>Payment Method</strong><br />
          <span style={{ color: "#ffffff" }}>{paymentMethod}</span>
        </Text>

        <Section style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", marginTop: "16px", paddingTop: "12px" }}>
          <Text style={{ ...baseStyles.text, margin: "0", fontSize: "18px" }}>
            <strong style={{ color: "rgba(255, 255, 255, 0.6)" }}>Total Paid: </strong>
            <strong style={{ color: "#ffffff" }}>{amount}</strong>
          </Text>
        </Section>
      </Section>

      {invoiceUrl && (
        <Section style={baseStyles.buttonSection}>
          <Link href={invoiceUrl} style={baseStyles.buttonSecondary}>
            Download Invoice
          </Link>
        </Section>
      )}

      <Text style={baseStyles.textMuted}>
        If you have any questions about this charge, please{" "}
        <Link href="https://clarusapp.io/support" style={baseStyles.link}>
          contact our support team
        </Link>
        .
      </Text>
    </BaseEmail>
  )
}

PaymentReceiptEmail.subject = "Clarus - Payment Receipt"

export default PaymentReceiptEmail

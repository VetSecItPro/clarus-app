import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface NewDeviceLoginEmailProps {
  userName?: string
  device: string
  browser: string
  location: string
  ipAddress: string
  loginTime: string
}

export const NewDeviceLoginEmail = ({
  userName = "there",
  device,
  browser,
  location,
  ipAddress,
  loginTime,
}: NewDeviceLoginEmailProps) => {
  return (
    <BaseEmail previewText="New sign-in to your Clarus account">
      <Text style={baseStyles.heading}>New sign-in detected</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        We noticed a new sign-in to your Clarus account from a device or location
        we don't recognize. If this was you, you can safely ignore this email.
      </Text>

      <Section style={baseStyles.infoBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Device:</strong> {device}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Browser:</strong> {browser}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>Location:</strong> {location}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0" }}>
          <strong style={{ color: "#ffffff" }}>IP Address:</strong> {ipAddress}
        </Text>
        <Text style={{ ...baseStyles.textMuted, margin: "0" }}>
          <strong style={{ color: "#ffffff" }}>Time:</strong> {loginTime}
        </Text>
      </Section>

      <Section style={baseStyles.warningBox}>
        <Text style={{ ...baseStyles.textMuted, margin: "0", color: "rgba(245, 158, 11, 0.9)" }}>
          <strong>Wasn't you?</strong> Someone may have access to your account.
          Please secure your account immediately by changing your password.
        </Text>
      </Section>

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io/forgot-password" style={baseStyles.buttonDanger}>
          Secure My Account
        </Link>
      </Section>

      <Text style={baseStyles.textMuted}>
        For added security, we recommend enabling two-factor authentication in your{" "}
        <Link href="https://clarusapp.io/settings" style={baseStyles.link}>
          account settings
        </Link>
        .
      </Text>
    </BaseEmail>
  )
}

NewDeviceLoginEmail.subject = "Clarus - New Sign-In Detected"

export default NewDeviceLoginEmail

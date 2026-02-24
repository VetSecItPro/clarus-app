import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reset Password | Clarus",
  description:
    "Reset your Clarus password. Enter your email to receive a password reset link.",
}

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

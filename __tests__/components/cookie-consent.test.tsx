// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import CookieConsent from "@/components/cookie-consent"

// ── Mocks ─────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// ── Tests ─────────────────────────────────────────

describe("CookieConsent", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("shows banner when no consent has been stored", () => {
    render(<CookieConsent />)

    expect(screen.getByRole("region", { name: /cookie consent/i })).toBeInTheDocument()
    expect(screen.getByText(/essential cookies only/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument()
  })

  it("does not show banner when consent was previously given", () => {
    localStorage.setItem("cookie-consent", JSON.stringify({ essential: true, timestamp: Date.now() }))

    render(<CookieConsent />)

    expect(screen.queryByRole("region", { name: /cookie consent/i })).not.toBeInTheDocument()
  })

  it("hides banner and stores consent on OK click", () => {
    render(<CookieConsent />)

    const okButton = screen.getByRole("button", { name: "OK" })
    fireEvent.click(okButton)

    // Banner should disappear
    expect(screen.queryByRole("region", { name: /cookie consent/i })).not.toBeInTheDocument()

    // Consent should be stored
    const stored = JSON.parse(localStorage.getItem("cookie-consent")!)
    expect(stored.essential).toBe(true)
    expect(stored.timestamp).toBeGreaterThan(0)
  })

  it("contains a link to the privacy policy", () => {
    render(<CookieConsent />)

    const privacyLink = screen.getByRole("link", { name: /privacy/i })
    expect(privacyLink).toBeInTheDocument()
    expect(privacyLink).toHaveAttribute("href", "/privacy")
  })
})

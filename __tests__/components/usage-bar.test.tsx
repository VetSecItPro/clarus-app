// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { UsageBar } from "@/components/ui/usage-bar"

afterEach(() => {
  cleanup()
})

describe("UsageBar", () => {
  // ── Full variant (default) ──────────────────────────

  describe("Full variant", () => {
    it("renders label and usage count", () => {
      render(<UsageBar label="Analyses" used={5} limit={50} />)

      expect(screen.getByText("Analyses")).toBeInTheDocument()
      expect(screen.getByText("5")).toBeInTheDocument()
      expect(screen.getByText(/\/ 50/)).toBeInTheDocument()
    })

    it("renders progress bar with correct width", () => {
      const { container } = render(<UsageBar label="Analyses" used={25} limit={50} />)

      // 25/50 = 50%
      const bar = container.querySelector('[style*="width"]')
      expect(bar).not.toBeNull()
      expect(bar!.getAttribute("style")).toContain("50%")
    })

    it("uses blue (brand) color below 80% usage", () => {
      const { container } = render(<UsageBar label="Analyses" used={10} limit={50} />)

      const bar = container.querySelector('[style*="width"]')
      expect(bar!.className).toContain("bg-brand")
      expect(bar!.className).not.toContain("bg-amber")
      expect(bar!.className).not.toContain("bg-red")
    })

    it("uses amber color at 80-94% usage", () => {
      const { container } = render(<UsageBar label="Analyses" used={42} limit={50} />)

      // 42/50 = 84%
      const bar = container.querySelector('[style*="width"]')
      expect(bar!.className).toContain("bg-amber-500")
    })

    it("uses red color at 95%+ usage", () => {
      const { container } = render(<UsageBar label="Analyses" used={48} limit={50} />)

      // 48/50 = 96%
      const bar = container.querySelector('[style*="width"]')
      expect(bar!.className).toContain("bg-red-500")
    })

    it("caps progress at 100% when over limit", () => {
      const { container } = render(<UsageBar label="Analyses" used={60} limit={50} />)

      const bar = container.querySelector('[style*="width"]')
      expect(bar!.getAttribute("style")).toContain("100%")
    })

    it("handles zero limit without crashing", () => {
      const { container } = render(<UsageBar label="Analyses" used={0} limit={0} />)

      const bar = container.querySelector('[style*="width"]')
      expect(bar!.getAttribute("style")).toContain("0%")
    })

    it("renders icon when provided", () => {
      const MockIcon = ({ className }: { className?: string }) => (
        <svg data-testid="mock-icon" className={className} />
      )

      render(<UsageBar label="Analyses" used={5} limit={50} icon={MockIcon} />)
      expect(screen.getByTestId("mock-icon")).toBeInTheDocument()
    })
  })

  // ── Compact variant ──────────────────────────────────

  describe("Compact variant", () => {
    it("renders in compact layout", () => {
      render(<UsageBar label="Analyses" used={5} limit={50} compact />)

      expect(screen.getByText("Analyses")).toBeInTheDocument()
      expect(screen.getByText("5/50")).toBeInTheDocument()
    })

    it("uses appropriate text color based on usage", () => {
      const { container } = render(<UsageBar label="Analyses" used={48} limit={50} compact />)

      // 96% should use red text
      const countElement = container.querySelector(".text-red-400")
      expect(countElement).not.toBeNull()
      expect(countElement!.textContent).toBe("48/50")
    })

    it("uses amber text color at 80-94%", () => {
      const { container } = render(<UsageBar label="Chat" used={42} limit={50} compact />)

      const countElement = container.querySelector(".text-amber-400")
      expect(countElement).not.toBeNull()
    })
  })
})

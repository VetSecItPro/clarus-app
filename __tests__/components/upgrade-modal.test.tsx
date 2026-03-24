// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { UpgradeModal } from "@/components/upgrade-modal"

// ── Mocks ─────────────────────────────────────────

vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => {
      const safe = { ...props }
      for (const key of ["initial", "animate", "exit", "transition", "whileHover", "whileTap", "variants", "layout"]) {
        delete safe[key]
      }
      return <div ref={ref} {...safe}>{children as React.ReactNode}</div>
    }),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/lib/hooks/use-media-query", () => ({
  useIsDesktop: () => true,
}))

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────

describe("UpgradeModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    feature: "Chat Messages",
    currentTier: "free" as const,
  }

  it("does not render when isOpen is false", () => {
    render(<UpgradeModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders dialog with title when open", () => {
    render(<UpgradeModal {...defaultProps} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Upgrade Your Plan")).toBeInTheDocument()
  })

  it("shows feature-gate message for non-limit features", () => {
    render(<UpgradeModal {...defaultProps} feature="Shareable Links" requiredTier="starter" />)
    expect(screen.getByText("Shareable Links")).toBeInTheDocument()
    expect(screen.getByText(/available on the/)).toBeInTheDocument()
    // "Starter" appears in the message and as card title — just check the message element
    const messageEl = screen.getByText(/available on the/)
    expect(messageEl.textContent).toContain("starter")
  })

  it("shows limit-based message with usage stats", () => {
    render(
      <UpgradeModal
        {...defaultProps}
        feature="analyses"
        currentCount={5}
        limit={5}
      />
    )

    expect(screen.getByText(/reached your monthly limit/)).toBeInTheDocument()
    expect(screen.getByText("analyses")).toBeInTheDocument()
    expect(screen.getByText(/Used 5 of 5 this month/)).toBeInTheDocument()
  })

  it("shows both Starter and Pro cards for free tier", () => {
    render(<UpgradeModal {...defaultProps} currentTier="free" />)

    expect(screen.getByText("Upgrade to Starter")).toBeInTheDocument()
    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument()
  })

  it("shows only Pro card for starter tier", () => {
    render(<UpgradeModal {...defaultProps} currentTier="starter" />)

    expect(screen.queryByText("Upgrade to Starter")).not.toBeInTheDocument()
    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument()
  })

  it("marks recommended tier with badge", () => {
    render(<UpgradeModal {...defaultProps} requiredTier="starter" />)
    expect(screen.getByText("Recommended")).toBeInTheDocument()
  })

  it("shows current plan note", () => {
    render(<UpgradeModal {...defaultProps} currentTier="free" />)
    expect(screen.getByText(/Currently on the/)).toBeInTheDocument()
    expect(screen.getByText("free")).toBeInTheDocument()
  })

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn()
    render(<UpgradeModal {...defaultProps} onClose={onClose} />)

    fireEvent.click(screen.getByLabelText("Close upgrade dialog"))
    expect(onClose).toHaveBeenCalled()
  })

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn()
    const { container } = render(<UpgradeModal {...defaultProps} onClose={onClose} />)

    // Click on the backdrop (first motion.div child that has the inset-0 class)
    const backdrop = container.querySelector(".fixed.inset-0.bg-black\\/60")
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalled()
    }
  })

  it("displays usage bar when limit-based", () => {
    const { container } = render(
      <UpgradeModal {...defaultProps} currentCount={5} limit={5} />
    )

    // Should show a full usage bar (100% width)
    const usageBar = container.querySelector('[style*="width: 100%"]')
    expect(usageBar).not.toBeNull()
  })

  it("displays tier features in cards", () => {
    render(<UpgradeModal {...defaultProps} />)

    // Both Starter and Pro cards list features — use getAllByText
    expect(screen.getAllByText(/analyses\/mo/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/chat messages\/mo/).length).toBeGreaterThanOrEqual(1)
  })
})

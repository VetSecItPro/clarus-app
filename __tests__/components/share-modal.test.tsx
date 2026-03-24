// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ShareModal } from "@/components/share-modal"

// ── Mocks ─────────────────────────────────────────

const { mockToast } = vi.hoisted(() => ({
  mockToast: { error: vi.fn(), success: vi.fn() },
}))

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

vi.mock("sonner", () => ({ toast: mockToast }))

vi.mock("@/lib/hooks/use-media-query", () => ({
  useIsDesktop: () => true,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: Record<string, unknown>) => (
    <button {...props}>{children as React.ReactNode}</button>
  ),
}))

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────

describe("ShareModal", () => {
  const defaultProps = {
    isOpen: true,
    onOpenChange: vi.fn(),
    contentTitle: "Test Article",
    contentUrl: "https://example.com/article",
    briefOverview: "A brief overview",
    contentId: "content-123",
  }

  it("does not render when closed", () => {
    render(<ShareModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders dialog with title when open", () => {
    render(<ShareModal {...defaultProps} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Share Analysis")).toBeInTheDocument()
  })

  it("shows content preview", () => {
    render(<ShareModal {...defaultProps} />)
    expect(screen.getByText("Test Article")).toBeInTheDocument()
    expect(screen.getByText("https://example.com/article")).toBeInTheDocument()
  })

  it("shows Link and Email tabs when contentId provided", () => {
    render(<ShareModal {...defaultProps} />)
    expect(screen.getByRole("tab", { name: /link/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /email/i })).toBeInTheDocument()
  })

  it("defaults to Link tab when contentId provided", () => {
    render(<ShareModal {...defaultProps} />)
    const linkTab = screen.getByRole("tab", { name: /link/i })
    expect(linkTab).toHaveAttribute("aria-selected", "true")
  })

  it("switches to email tab on click", () => {
    render(<ShareModal {...defaultProps} />)
    const emailTab = screen.getByRole("tab", { name: /email/i })
    fireEvent.click(emailTab)

    expect(emailTab).toHaveAttribute("aria-selected", "true")
    expect(screen.getByLabelText("Recipient Email")).toBeInTheDocument()
  })

  it("shows email form without tabs when no contentId", () => {
    render(<ShareModal {...defaultProps} contentId={undefined} />)

    // No tabs should be shown
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()

    // Email form should be visible
    expect(screen.getByLabelText("Recipient Email")).toBeInTheDocument()
    expect(screen.getByLabelText(/Personal Message/)).toBeInTheDocument()
  })

  it("shows generate link button on link tab", () => {
    render(<ShareModal {...defaultProps} />)
    expect(screen.getByText("Generate shareable link")).toBeInTheDocument()
  })

  it("calls onOpenChange when close button clicked", () => {
    const onOpenChange = vi.fn()
    render(<ShareModal {...defaultProps} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByLabelText("Close share dialog"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows Send Email button disabled when email is empty", () => {
    render(<ShareModal {...defaultProps} />)

    // Switch to email tab
    fireEvent.click(screen.getByRole("tab", { name: /email/i }))

    const sendButton = screen.getByText("Send Email").closest("button")!
    expect(sendButton).toBeDisabled()
  })

  it("validates email format on send", async () => {
    render(<ShareModal {...defaultProps} />)

    // Switch to email tab
    fireEvent.click(screen.getByRole("tab", { name: /email/i }))

    // Type invalid email
    const emailInput = screen.getByLabelText("Recipient Email")
    await userEvent.type(emailInput, "not-an-email")

    // Click send
    fireEvent.click(screen.getByText("Send Email"))

    expect(mockToast.error).toHaveBeenCalledWith("Please enter a valid email address")
  })

  it("generates share link on button click", async () => {
    const mockShareUrl = "https://clarus.app/share/abc123"
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ share_url: mockShareUrl }),
    })

    render(<ShareModal {...defaultProps} />)

    fireEvent.click(screen.getByText("Generate shareable link"))

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockShareUrl)).toBeInTheDocument()
    })
  })

  it("shows error toast when link generation fails", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Rate limit exceeded" }),
    })

    render(<ShareModal {...defaultProps} />)

    fireEvent.click(screen.getByText("Generate shareable link"))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Rate limit exceeded")
    })
  })

  it("has Cancel button in email tab that closes modal", () => {
    render(<ShareModal {...defaultProps} />)

    // Switch to email tab
    fireEvent.click(screen.getByRole("tab", { name: /email/i }))

    const cancelButton = screen.getByText("Cancel")
    fireEvent.click(cancelButton)

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })
})

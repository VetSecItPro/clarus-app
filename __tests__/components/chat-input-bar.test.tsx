// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ChatInputBar } from "@/components/chat/chat-input-bar"

// ── Mocks ─────────────────────────────────────────

const { mockToast } = vi.hoisted(() => ({
  mockToast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const safe = { ...props }
      for (const key of ["initial", "animate", "exit", "transition", "whileHover", "whileTap", "variants", "layout"]) {
        delete safe[key]
      }
      return <div {...safe}>{children as React.ReactNode}</div>
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("sonner", () => ({ toast: mockToast }))

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => {
    const safe = { ...props }
    for (const key of ["fill", "sizes", "priority", "loading", "placeholder", "blurDataURL", "unoptimized"]) {
      delete safe[key]
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...safe} />
  },
}))

vi.mock("@/lib/hooks/use-speech", () => ({
  useSpeechToText: () => ({
    isListening: false,
    isSupported: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    transcript: "",
  }),
}))

vi.mock("@/components/ui/language-selector", () => ({
  LanguageSelector: () => null,
}))

vi.mock("@/components/ui/tooltip", () => ({
  InstantTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

// ── Tests ─────────────────────────────────────────

describe("ChatInputBar", () => {
  const defaultProps = {
    onSubmitUrl: vi.fn(),
    onSubmitMessage: vi.fn(),
  }

  it("renders input with default placeholder", () => {
    render(<ChatInputBar {...defaultProps} />)

    const input = screen.getByLabelText("Enter a URL, upload a file, or type a message")
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute("placeholder", "Paste a URL or ask a question...")
  })

  it("renders with custom placeholder", () => {
    render(<ChatInputBar {...defaultProps} placeholder="Type something..." />)

    const input = screen.getByLabelText("Enter a URL, upload a file, or type a message")
    expect(input).toHaveAttribute("placeholder", "Type something...")
  })

  it("disables input when disabled", () => {
    render(<ChatInputBar {...defaultProps} disabled />)

    const input = screen.getByLabelText("Enter a URL, upload a file, or type a message")
    expect(input).toBeDisabled()
  })

  it("disables input when processing", () => {
    render(<ChatInputBar {...defaultProps} isProcessing />)

    const input = screen.getByLabelText("Enter a URL, upload a file, or type a message")
    expect(input).toBeDisabled()
  })

  it("submits message on Enter key", async () => {
    vi.useRealTimers()
    const onSubmitMessage = vi.fn()
    render(<ChatInputBar {...defaultProps} onSubmitMessage={onSubmitMessage} mode="chat-only" />)

    const input = screen.getByLabelText("Enter a URL, upload a file, or type a message")
    await userEvent.type(input, "Hello world")
    fireEvent.keyDown(input, { key: "Enter" })

    expect(onSubmitMessage).toHaveBeenCalledWith("Hello world")
  })

  it("does not submit on Shift+Enter", async () => {
    vi.useRealTimers()
    const onSubmitMessage = vi.fn()
    render(<ChatInputBar {...defaultProps} onSubmitMessage={onSubmitMessage} mode="chat-only" />)

    const input = screen.getByLabelText("Enter a URL, upload a file, or type a message")
    await userEvent.type(input, "Hello")
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true })

    expect(onSubmitMessage).not.toHaveBeenCalled()
  })

  it("clears input after successful submission", async () => {
    vi.useRealTimers()
    render(<ChatInputBar {...defaultProps} mode="chat-only" />)

    const input = screen.getByLabelText("Enter a URL, upload a file, or type a message") as HTMLInputElement
    await userEvent.type(input, "Hello world")
    fireEvent.keyDown(input, { key: "Enter" })

    expect(input.value).toBe("")
  })

  it("does not submit empty input", () => {
    render(<ChatInputBar {...defaultProps} />)

    const input = screen.getByLabelText("Enter a URL, upload a file, or type a message")
    fireEvent.keyDown(input, { key: "Enter" })

    expect(defaultProps.onSubmitMessage).not.toHaveBeenCalled()
    expect(defaultProps.onSubmitUrl).not.toHaveBeenCalled()
  })

  it("shows clear button when input has text", async () => {
    vi.useRealTimers()
    render(<ChatInputBar {...defaultProps} />)

    const input = screen.getByLabelText("Enter a URL, upload a file, or type a message")
    await userEvent.type(input, "Some text")

    const clearButton = screen.getByLabelText("Clear input")
    expect(clearButton).toBeInTheDocument()
  })

  it("clears input on clear button click", async () => {
    vi.useRealTimers()
    render(<ChatInputBar {...defaultProps} />)

    const input = screen.getByLabelText("Enter a URL, upload a file, or type a message") as HTMLInputElement
    await userEvent.type(input, "Some text")

    fireEvent.click(screen.getByLabelText("Clear input"))

    expect(input.value).toBe("")
  })

  it("shows helper text about supported formats", () => {
    render(<ChatInputBar {...defaultProps} />)

    expect(screen.getByText(/Supports PDF, Word, Excel/)).toBeInTheDocument()
  })

  it("shows file upload button when enabled", () => {
    render(
      <ChatInputBar
        {...defaultProps}
        showFileUpload={true}
        onSubmitFile={vi.fn()}
      />
    )

    expect(screen.getAllByLabelText("Upload file").length).toBeGreaterThan(0)
  })

  it("shows send button", () => {
    render(<ChatInputBar {...defaultProps} />)

    expect(screen.getByLabelText(/send message/i)).toBeInTheDocument()
  })

  it("send button is disabled when input is empty", () => {
    render(<ChatInputBar {...defaultProps} />)

    const sendButton = screen.getByLabelText(/send message/i)
    expect(sendButton).toBeDisabled()
  })

  it("shows character count when near limit", async () => {
    vi.useRealTimers()
    render(<ChatInputBar {...defaultProps} />)

    const input = screen.getByLabelText("Enter a URL, upload a file, or type a message")
    // Type a long string near the 10,000 char limit (90%+ = 9000+)
    const longText = "a".repeat(9001)
    // Use fireEvent for performance - userEvent.type is too slow for 9k chars
    fireEvent.change(input, { target: { value: longText } })

    expect(screen.getByText(/9,001\/10,000/)).toBeInTheDocument()
  })
})

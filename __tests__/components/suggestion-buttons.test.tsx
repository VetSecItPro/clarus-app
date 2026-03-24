// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { SuggestionButtons, SuggestionChips } from "@/components/chat/suggestion-buttons"

// ── Mocks ─────────────────────────────────────────

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const safe = { ...props }
      for (const key of ["initial", "animate", "exit", "transition", "whileHover", "whileTap", "variants", "layout"]) {
        delete safe[key]
      }
      return <div {...safe}>{children as React.ReactNode}</div>
    },
    button: ({ children, ...props }: Record<string, unknown>) => {
      const safe = { ...props }
      for (const key of ["initial", "animate", "exit", "transition", "whileHover", "whileTap", "variants", "layout"]) {
        delete safe[key]
      }
      return <button {...safe}>{children as React.ReactNode}</button>
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

afterEach(() => {
  cleanup()
})

// ── SuggestionButtons ─────────────────────────────

describe("SuggestionButtons", () => {
  it("renders all 3 core actions by default", () => {
    render(<SuggestionButtons onSelect={vi.fn()} />)

    expect(screen.getByText("Summary")).toBeInTheDocument()
    expect(screen.getByText("Accuracy")).toBeInTheDocument()
    expect(screen.getByText("Deep Dive")).toBeInTheDocument()
  })

  it("calls onSelect with correct action when clicked", () => {
    const onSelect = vi.fn()
    render(<SuggestionButtons onSelect={onSelect} />)

    fireEvent.click(screen.getByText("Summary"))
    expect(onSelect).toHaveBeenCalledWith("executive_summary")

    fireEvent.click(screen.getByText("Deep Dive"))
    expect(onSelect).toHaveBeenCalledWith("full_analysis")
  })

  it("hides Accuracy button for music content", () => {
    render(<SuggestionButtons onSelect={vi.fn()} contentCategory="music" />)

    expect(screen.getByText("Summary")).toBeInTheDocument()
    expect(screen.queryByText("Accuracy")).not.toBeInTheDocument()
    expect(screen.getByText("Deep Dive")).toBeInTheDocument()
  })

  it("hides Accuracy button for entertainment content", () => {
    render(<SuggestionButtons onSelect={vi.fn()} contentCategory="entertainment" />)

    expect(screen.queryByText("Accuracy")).not.toBeInTheDocument()
  })

  it("shows Accuracy button for news content", () => {
    render(<SuggestionButtons onSelect={vi.fn()} contentCategory="news" />)

    expect(screen.getByText("Accuracy")).toBeInTheDocument()
  })

  it("renders contextual prompts for news category", () => {
    const onCustomPrompt = vi.fn()
    render(
      <SuggestionButtons
        onSelect={vi.fn()}
        onCustomPrompt={onCustomPrompt}
        contentCategory="news"
      />
    )

    expect(screen.getByText("Source check")).toBeInTheDocument()
    expect(screen.getByText("Context")).toBeInTheDocument()
    expect(screen.getByText("Both sides")).toBeInTheDocument()
    expect(screen.getByText("What's next")).toBeInTheDocument()
  })

  it("renders contextual prompts for podcast category", () => {
    render(
      <SuggestionButtons
        onSelect={vi.fn()}
        onCustomPrompt={vi.fn()}
        contentCategory="podcast"
      />
    )

    expect(screen.getByText("Key takeaways")).toBeInTheDocument()
    expect(screen.getByText("Guest info")).toBeInTheDocument()
    expect(screen.getByText("Timestamps")).toBeInTheDocument()
  })

  it("calls onCustomPrompt with the prompt text when contextual chip clicked", () => {
    const onCustomPrompt = vi.fn()
    render(
      <SuggestionButtons
        onSelect={vi.fn()}
        onCustomPrompt={onCustomPrompt}
        contentCategory="news"
      />
    )

    fireEvent.click(screen.getByText("Source check"))
    expect(onCustomPrompt).toHaveBeenCalledWith(
      "How reliable are the sources cited in this article?"
    )
  })

  it("does not render contextual prompts without onCustomPrompt", () => {
    render(<SuggestionButtons onSelect={vi.fn()} contentCategory="news" />)

    // Core actions should be there, but contextual prompts should not
    expect(screen.getByText("Summary")).toBeInTheDocument()
    expect(screen.queryByText("Source check")).not.toBeInTheDocument()
  })

  it("renders default prompts when no category specified", () => {
    render(
      <SuggestionButtons
        onSelect={vi.fn()}
        onCustomPrompt={vi.fn()}
      />
    )

    expect(screen.getByText("Key takeaways")).toBeInTheDocument()
    expect(screen.getByText("Accuracy check")).toBeInTheDocument()
    expect(screen.getByText("Action items")).toBeInTheDocument()
  })

  it("disables all buttons when disabled prop is true", () => {
    render(
      <SuggestionButtons
        onSelect={vi.fn()}
        onCustomPrompt={vi.fn()}
        contentCategory="news"
        disabled
      />
    )

    const buttons = screen.getAllByRole("button")
    for (const button of buttons) {
      expect(button).toBeDisabled()
    }
  })

  it("limits contextual prompts to 4", () => {
    render(
      <SuggestionButtons
        onSelect={vi.fn()}
        onCustomPrompt={vi.fn()}
        contentCategory="podcast"
      />
    )

    // Podcast has 4 prompts — all should show
    expect(screen.getByText("Key takeaways")).toBeInTheDocument()
    expect(screen.getByText("Guest info")).toBeInTheDocument()
    expect(screen.getByText("Timestamps")).toBeInTheDocument()
    expect(screen.getByText("Action items")).toBeInTheDocument()
  })
})

// ── SuggestionChips ───────────────────────────────

describe("SuggestionChips", () => {
  it("renders all suggestion chips", () => {
    render(<SuggestionChips onSelect={vi.fn()} suggestions={["Chip 1", "Chip 2", "Chip 3"]} />)

    expect(screen.getByText("Chip 1")).toBeInTheDocument()
    expect(screen.getByText("Chip 2")).toBeInTheDocument()
    expect(screen.getByText("Chip 3")).toBeInTheDocument()
  })

  it("calls onSelect with the chip text on click", () => {
    const onSelect = vi.fn()
    render(<SuggestionChips onSelect={onSelect} suggestions={["Ask more", "Clarify"]} />)

    fireEvent.click(screen.getByText("Ask more"))
    expect(onSelect).toHaveBeenCalledWith("Ask more")
  })

  it("disables chips when disabled", () => {
    render(<SuggestionChips onSelect={vi.fn()} suggestions={["Chip"]} disabled />)

    expect(screen.getByText("Chip")).toBeDisabled()
  })
})

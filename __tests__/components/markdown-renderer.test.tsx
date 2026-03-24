// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { MarkdownRenderer } from "@/components/markdown-renderer"

afterEach(() => {
  cleanup()
})

describe("MarkdownRenderer", () => {
  // ── Basic rendering ─────────────────────────────

  it("returns null for null/undefined children", () => {
    const { container } = render(<MarkdownRenderer>{null}</MarkdownRenderer>)
    expect(container.innerHTML).toBe("")
  })

  it("returns null for undefined children", () => {
    const { container } = render(<MarkdownRenderer>{undefined}</MarkdownRenderer>)
    expect(container.innerHTML).toBe("")
  })

  it("renders plain text as paragraph", () => {
    render(<MarkdownRenderer>Hello world</MarkdownRenderer>)
    expect(screen.getByText("Hello world")).toBeInTheDocument()
  })

  it("renders bold text", () => {
    render(<MarkdownRenderer>This is **bold** text</MarkdownRenderer>)
    const strong = document.querySelector("strong")
    expect(strong).not.toBeNull()
    expect(strong!.textContent).toBe("bold")
  })

  it("renders headers", () => {
    render(<MarkdownRenderer>{"# Main Title\n\nSome content"}</MarkdownRenderer>)
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading.textContent).toBe("Main Title")
  })

  it("renders unordered lists", () => {
    render(<MarkdownRenderer>{"- Item 1\n- Item 2\n- Item 3"}</MarkdownRenderer>)
    const items = screen.getAllByRole("listitem")
    expect(items.length).toBe(3)
  })

  it("renders ordered lists", () => {
    render(<MarkdownRenderer>{"1. First\n2. Second\n3. Third"}</MarkdownRenderer>)
    const list = document.querySelector("ol")
    expect(list).not.toBeNull()
    const items = screen.getAllByRole("listitem")
    expect(items.length).toBe(3)
  })

  it("renders blockquotes", () => {
    render(<MarkdownRenderer>{"> This is a quote"}</MarkdownRenderer>)
    const blockquote = document.querySelector("blockquote")
    expect(blockquote).not.toBeNull()
    expect(blockquote!.textContent).toContain("This is a quote")
  })

  it("renders inline code", () => {
    render(<MarkdownRenderer>{"Use `console.log()` for debugging"}</MarkdownRenderer>)
    const code = document.querySelector("code")
    expect(code).not.toBeNull()
    expect(code!.textContent).toBe("console.log()")
  })

  // ── External links ──────────────────────────────

  it("opens external links in new tab", () => {
    render(<MarkdownRenderer>{"Visit [Google](https://google.com)"}</MarkdownRenderer>)
    const link = screen.getByRole("link", { name: "Google" })
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("does not open internal links in new tab", () => {
    render(<MarkdownRenderer>{"Go to [home](/home)"}</MarkdownRenderer>)
    const link = screen.getByRole("link", { name: "home" })
    expect(link).not.toHaveAttribute("target")
  })

  // ── Timestamps ──────────────────────────────────

  it("converts timestamps to clickable elements when onTimestampClick provided", () => {
    const onTimestampClick = vi.fn()
    render(
      <MarkdownRenderer onTimestampClick={onTimestampClick}>
        {"Check at [1:30] for details"}
      </MarkdownRenderer>
    )

    const timestamp = screen.getByRole("button", { name: /1:30/i })
    expect(timestamp).toBeInTheDocument()
  })

  it("calls onTimestampClick with correct seconds on click", () => {
    const onTimestampClick = vi.fn()
    render(
      <MarkdownRenderer onTimestampClick={onTimestampClick}>
        {"Check at [1:30] for details"}
      </MarkdownRenderer>
    )

    const timestamp = screen.getByRole("button", { name: /1:30/i })
    fireEvent.click(timestamp)

    expect(onTimestampClick).toHaveBeenCalledWith(90) // 1:30 = 90 seconds
  })

  it("handles HH:MM:SS timestamp format", () => {
    const onTimestampClick = vi.fn()
    render(
      <MarkdownRenderer onTimestampClick={onTimestampClick}>
        {"Start at [1:30:45] mark"}
      </MarkdownRenderer>
    )

    const timestamp = screen.getByRole("button", { name: /1:30:45/i })
    fireEvent.click(timestamp)

    expect(onTimestampClick).toHaveBeenCalledWith(5445) // 1*3600 + 30*60 + 45
  })

  it("handles keyboard activation of timestamps", () => {
    const onTimestampClick = vi.fn()
    render(
      <MarkdownRenderer onTimestampClick={onTimestampClick}>
        {"At [2:00] something happens"}
      </MarkdownRenderer>
    )

    const timestamp = screen.getByRole("button", { name: /2:00/i })
    fireEvent.keyDown(timestamp, { key: "Enter" })

    expect(onTimestampClick).toHaveBeenCalledWith(120)
  })

  it("does not convert timestamps without onTimestampClick", () => {
    render(<MarkdownRenderer>{"Check at [1:30] for details"}</MarkdownRenderer>)

    // Without onTimestampClick, timestamps should not be clickable buttons
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  // ── Preprocessing ───────────────────────────────

  it("collapses consecutive horizontal rules", () => {
    const { container } = render(
      <MarkdownRenderer>{"---\n---\n---\n\nContent after"}</MarkdownRenderer>
    )
    const hrs = container.querySelectorAll("hr")
    expect(hrs.length).toBe(1)
  })

  // ── Custom className ────────────────────────────

  it("applies custom className", () => {
    const { container } = render(
      <MarkdownRenderer className="my-custom-class">{"Hello"}</MarkdownRenderer>
    )
    expect(container.firstElementChild!.className).toContain("my-custom-class")
  })

  // ── GFM support ─────────────────────────────────

  it("renders GFM tables", () => {
    render(
      <MarkdownRenderer>
        {"| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |"}
      </MarkdownRenderer>
    )
    const table = document.querySelector("table")
    expect(table).not.toBeNull()
  })

  it("renders strikethrough text", () => {
    render(<MarkdownRenderer>{"This is ~~deleted~~ text"}</MarkdownRenderer>)
    const del = document.querySelector("del")
    expect(del).not.toBeNull()
    expect(del!.textContent).toBe("deleted")
  })
})

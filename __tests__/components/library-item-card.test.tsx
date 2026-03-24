// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { LibraryItemCard } from "@/components/library-item-card"
import type { LibraryItem } from "@/lib/hooks/use-library"

// ── Mocks ─────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("next/image", () => ({
  default: ({ alt, src, ...props }: { alt: string; src: string; [key: string]: unknown }) => {
    const safe = { ...props }
    // Strip Next.js Image props that aren't valid HTML
    for (const key of ["fill", "sizes", "priority", "loading", "placeholder", "blurDataURL", "unoptimized"]) {
      delete safe[key]
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} src={src} {...safe} />
  },
}))

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

afterEach(() => {
  cleanup()
})

// ── Helpers ───────────────────────────────────────

function makeItem(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: "item-1",
    title: "Test Article Title",
    url: "https://example.com/article",
    type: "article",
    date_added: new Date().toISOString(),
    thumbnail_url: null,
    is_bookmarked: false,
    tags: [],
    duration: null,
    summaries: null,
    content_ratings: null,
    ...overrides,
  } as LibraryItem
}

const defaultProps = {
  viewMode: "list" as const,
  isExpanded: false,
  deletingId: null,
  togglingBookmark: null,
  onToggleExpand: vi.fn(),
  onToggleBookmark: vi.fn(),
  onDelete: vi.fn(),
}

// ── List View Tests ───────────────────────────────

describe("LibraryItemCard — List View", () => {
  it("renders title", () => {
    render(<LibraryItemCard item={makeItem()} {...defaultProps} />)
    expect(screen.getByText("Test Article Title")).toBeInTheDocument()
  })

  it("shows 'Processing...' when no title", () => {
    render(<LibraryItemCard item={makeItem({ title: null })} {...defaultProps} />)
    expect(screen.getByText("Processing...")).toBeInTheDocument()
  })

  it("shows article type badge", () => {
    render(<LibraryItemCard item={makeItem({ type: "article" })} {...defaultProps} />)
    expect(screen.getByText("Article")).toBeInTheDocument()
  })

  it("shows YouTube type badge", () => {
    render(<LibraryItemCard item={makeItem({ type: "youtube" })} {...defaultProps} />)
    expect(screen.getByText("YouTube")).toBeInTheDocument()
  })

  it("shows podcast type badge", () => {
    render(<LibraryItemCard item={makeItem({ type: "podcast" })} {...defaultProps} />)
    expect(screen.getByText("Podcast")).toBeInTheDocument()
  })

  it("shows X Post type badge", () => {
    render(<LibraryItemCard item={makeItem({ type: "x_post" })} {...defaultProps} />)
    expect(screen.getByText("X Post")).toBeInTheDocument()
  })

  it("shows PDF type badge", () => {
    render(<LibraryItemCard item={makeItem({ type: "pdf" })} {...defaultProps} />)
    expect(screen.getByText("PDF")).toBeInTheDocument()
  })

  it("displays domain from URL", () => {
    render(<LibraryItemCard item={makeItem({ url: "https://www.nytimes.com/article" })} {...defaultProps} />)
    expect(screen.getByText("nytimes.com")).toBeInTheDocument()
  })

  it("shows tags (up to 3 in list view)", () => {
    render(
      <LibraryItemCard
        item={makeItem({ tags: ["tech", "science", "ai", "ml"] })}
        {...defaultProps}
      />
    )

    expect(screen.getByText("tech")).toBeInTheDocument()
    expect(screen.getByText("science")).toBeInTheDocument()
    expect(screen.getByText("ai")).toBeInTheDocument()
    expect(screen.getByText("+1")).toBeInTheDocument()
  })

  it("calls onToggleExpand when card clicked", () => {
    const onToggleExpand = vi.fn()
    render(
      <LibraryItemCard
        item={makeItem()}
        {...defaultProps}
        onToggleExpand={onToggleExpand}
      />
    )

    // The clickable area has role="button" and aria-expanded
    const expandButton = document.querySelector('[role="button"][aria-expanded]')!
    fireEvent.click(expandButton)
    expect(onToggleExpand).toHaveBeenCalled()
  })

  it("calls onDelete when delete button clicked", () => {
    const onDelete = vi.fn()
    render(
      <LibraryItemCard
        item={makeItem()}
        {...defaultProps}
        onDelete={onDelete}
      />
    )

    const deleteButton = screen.getByLabelText("Delete item")
    fireEvent.click(deleteButton)
    expect(onDelete).toHaveBeenCalled()
  })

  it("calls onToggleBookmark when bookmark button clicked", () => {
    const onToggleBookmark = vi.fn()
    render(
      <LibraryItemCard
        item={makeItem()}
        {...defaultProps}
        onToggleBookmark={onToggleBookmark}
      />
    )

    const bookmarkButton = screen.getByLabelText("Add bookmark")
    fireEvent.click(bookmarkButton)
    expect(onToggleBookmark).toHaveBeenCalled()
  })

  it("shows 'Remove bookmark' label when bookmarked", () => {
    render(
      <LibraryItemCard
        item={makeItem({ is_bookmarked: true })}
        {...defaultProps}
      />
    )

    expect(screen.getAllByLabelText("Remove bookmark").length).toBeGreaterThan(0)
  })

  it("shows expanded content when isExpanded is true", () => {
    render(
      <LibraryItemCard
        item={makeItem({
          summaries: [{
            brief_overview: "This is the overview text.",
            mid_length_summary: "Key takeaways here.",
            triage: { quality_score: 8, one_liner: "Great article" },
            truth_check: null,
          }],
        })}
        {...defaultProps}
        isExpanded={true}
      />
    )

    expect(screen.getByText("Overview")).toBeInTheDocument()
    expect(screen.getByText("This is the overview text.")).toBeInTheDocument()
    expect(screen.getByText("Key Takeaways")).toBeInTheDocument()
    expect(screen.getByText("View Full Analysis")).toBeInTheDocument()
  })

  it("hides summary preview when expanded", () => {
    render(
      <LibraryItemCard
        item={makeItem({
          summaries: [{
            brief_overview: "This is a brief overview that shows when collapsed.",
            mid_length_summary: null,
            triage: null,
            truth_check: null,
          }],
        })}
        {...defaultProps}
        isExpanded={true}
      />
    )

    // The preview (truncated) should not appear when expanded
    expect(screen.queryByText(/This is a brief overview that shows when col\.\.\./)).not.toBeInTheDocument()
  })

  it("shows quality score in expanded view", () => {
    render(
      <LibraryItemCard
        item={makeItem({
          summaries: [{
            brief_overview: null,
            mid_length_summary: null,
            triage: { quality_score: 9 },
            truth_check: null,
          }],
        })}
        {...defaultProps}
        isExpanded={true}
      />
    )

    expect(screen.getByText(/Quality: 9\/10/)).toBeInTheDocument()
  })

  it("disables delete button while deleting", () => {
    render(
      <LibraryItemCard
        item={makeItem()}
        {...defaultProps}
        deletingId="item-1"
      />
    )

    const deleteButton = screen.getByLabelText("Delete item")
    expect(deleteButton).toBeDisabled()
  })
})

// ── Grid View Tests ───────────────────────────────

describe("LibraryItemCard — Grid View", () => {
  it("renders title in grid mode", () => {
    render(<LibraryItemCard item={makeItem()} {...defaultProps} viewMode="grid" />)
    expect(screen.getByText("Test Article Title")).toBeInTheDocument()
  })

  it("shows thumbnail when available", () => {
    render(
      <LibraryItemCard
        item={makeItem({ thumbnail_url: "https://example.com/thumb.jpg" })}
        {...defaultProps}
        viewMode="grid"
      />
    )

    const img = screen.getByAltText("Test Article Title")
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute("src", "https://example.com/thumb.jpg")
  })

  it("links to item detail page", () => {
    render(<LibraryItemCard item={makeItem()} {...defaultProps} viewMode="grid" />)

    const link = document.querySelector('a[href="/item/item-1"]')
    expect(link).not.toBeNull()
  })

  it("shows tags (up to 2 in grid view)", () => {
    render(
      <LibraryItemCard
        item={makeItem({ tags: ["tech", "ai", "ml"] })}
        {...defaultProps}
        viewMode="grid"
      />
    )

    expect(screen.getByText("tech")).toBeInTheDocument()
    expect(screen.getByText("ai")).toBeInTheDocument()
    expect(screen.getByText("+1")).toBeInTheDocument()
  })

  it("shows bookmark indicator when bookmarked", () => {
    const { container } = render(
      <LibraryItemCard
        item={makeItem({ is_bookmarked: true })}
        {...defaultProps}
        viewMode="grid"
      />
    )

    // Bookmark indicator is an absolute-positioned div in the top-left
    const indicator = container.querySelector(".absolute.top-2.left-2")
    expect(indicator).not.toBeNull()
  })
})

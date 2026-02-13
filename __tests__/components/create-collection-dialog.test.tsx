/**
 * @vitest-environment jsdom
 */
import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CreateCollectionDialog } from "@/components/collections/create-collection-dialog"
import type { Collection } from "@/lib/hooks/use-collections"
import { COLLECTION_COLORS } from "@/lib/schemas"

// ----------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------

const { mockToast } = vi.hoisted(() => ({
  mockToast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const safe = { ...props }
      // Strip framer-motion-only props so they don't hit the DOM
      for (const key of [
        "initial",
        "animate",
        "exit",
        "transition",
        "whileHover",
        "whileTap",
        "variants",
        "layout",
      ]) {
        delete safe[key]
      }
      return <div {...safe}>{children as React.ReactNode}</div>
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("sonner", () => ({ toast: mockToast }))

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const makeCollection = (overrides: Partial<Collection> = {}): Collection => ({
  id: "col-1",
  name: "Existing Collection",
  description: "Some description",
  color: "#ef4444",
  icon: "star",
  is_default: false,
  item_count: 3,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  ...overrides,
})

const defaultProps = () => ({
  open: true,
  onClose: vi.fn(),
  onCreate: vi.fn().mockResolvedValue(makeCollection()),
})

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("CreateCollectionDialog", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Does not render when open=false
  it("does not render content when open is false", () => {
    const props = defaultProps()
    render(<CreateCollectionDialog {...props} open={false} />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByText("New Collection")).not.toBeInTheDocument()
  })

  // 2. Renders dialog with form when open=true
  it("renders dialog with form elements when open is true", () => {
    render(<CreateCollectionDialog {...defaultProps()} />)

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toBeInTheDocument()
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
    expect(screen.getByText("Color")).toBeInTheDocument()
    expect(screen.getByText("Icon")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Create" })
    ).toBeInTheDocument()
  })

  // 3. Shows "New Collection" title in create mode
  it('shows "New Collection" title in create mode', () => {
    render(<CreateCollectionDialog {...defaultProps()} />)

    expect(screen.getByText("New Collection")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument()
  })

  // 4. Shows "Edit Collection" title in edit mode with pre-filled values
  it('shows "Edit Collection" title with pre-filled values in edit mode', () => {
    const editing = makeCollection()
    const props = {
      ...defaultProps(),
      editingCollection: editing,
      onUpdate: vi.fn().mockResolvedValue(editing),
    }

    render(<CreateCollectionDialog {...props} />)

    expect(screen.getByText("Edit Collection")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toHaveValue("Existing Collection")
    expect(screen.getByLabelText(/Description/)).toHaveValue(
      "Some description"
    )
  })

  // 5. Shows toast error when submitting with empty name
  it("shows toast error when submitting with empty name", async () => {
    const props = defaultProps()
    render(<CreateCollectionDialog {...props} />)

    // Name starts empty. Type spaces so it's still effectively empty after trim.
    const nameInput = screen.getByLabelText("Name")
    await userEvent.type(nameInput, "   ")

    // Submit the form
    fireEvent.submit(screen.getByRole("button", { name: "Create" }).closest("form")!)

    expect(mockToast.error).toHaveBeenCalledWith(
      "Collection name is required"
    )
    expect(props.onCreate).not.toHaveBeenCalled()
  })

  // 6. Submit button is disabled when name input is empty
  it("disables submit button when name input is empty", () => {
    render(<CreateCollectionDialog {...defaultProps()} />)

    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
  })

  // 7. Calls onCreate with correct data on submit
  it("calls onCreate with correct data on submit", async () => {
    const props = defaultProps()
    render(<CreateCollectionDialog {...props} />)

    const nameInput = screen.getByLabelText("Name")
    const descInput = screen.getByLabelText(/Description/)

    await userEvent.type(nameInput, "My Research")
    await userEvent.type(descInput, "Notes about research")

    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(props.onCreate).toHaveBeenCalledWith({
        name: "My Research",
        description: "Notes about research",
        color: COLLECTION_COLORS[0],
        icon: "folder",
      })
    })
  })

  // 8. Calls onUpdate with correct data in edit mode
  it("calls onUpdate with correct data in edit mode", async () => {
    const editing = makeCollection()
    const onUpdate = vi.fn().mockResolvedValue(editing)
    const props = {
      ...defaultProps(),
      editingCollection: editing,
      onUpdate,
    }

    render(<CreateCollectionDialog {...props} />)

    const nameInput = screen.getByLabelText("Name")
    // Clear existing value and type new one
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, "Updated Name")

    fireEvent.click(screen.getByRole("button", { name: "Update" }))

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith("col-1", {
        name: "Updated Name",
        description: "Some description",
        color: "#ef4444",
        icon: "star",
      })
    })
  })

  // 9. Calls onClose after successful submit
  it("calls onClose after successful submit", async () => {
    const props = defaultProps()
    render(<CreateCollectionDialog {...props} />)

    await userEvent.type(screen.getByLabelText("Name"), "Test Collection")
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(props.onClose).toHaveBeenCalled()
    })
  })

  // 10. Shows error toast on submit failure
  it("shows error toast on submit failure", async () => {
    const props = defaultProps()
    props.onCreate.mockRejectedValue(new Error("Network error"))

    render(<CreateCollectionDialog {...props} />)

    await userEvent.type(screen.getByLabelText("Name"), "Test")
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Network error")
    })
  })

  // 11. Color selection updates active color
  it("updates active color when a color button is clicked", () => {
    render(<CreateCollectionDialog {...defaultProps()} />)

    const secondColor = COLLECTION_COLORS[1]
    const colorButton = screen.getByLabelText(`Select color ${secondColor}`)

    // The first color should be selected by default (has border-white class)
    const firstColorButton = screen.getByLabelText(
      `Select color ${COLLECTION_COLORS[0]}`
    )
    expect(firstColorButton.className).toContain("border-white")

    fireEvent.click(colorButton)

    // Now the second color should be selected
    expect(colorButton.className).toContain("border-white")
    // First color no longer selected
    expect(firstColorButton.className).not.toContain("border-white scale-110")
  })

  // 12. Icon selection updates active icon
  it("updates active icon when an icon button is clicked", () => {
    render(<CreateCollectionDialog {...defaultProps()} />)

    // "folder" is the default selected icon
    const folderButton = screen.getByRole("button", { name: "folder" })
    expect(folderButton.className).toContain("bg-white/[0.1]")

    const starButton = screen.getByRole("button", { name: "star" })
    fireEvent.click(starButton)

    // "star" should now be selected
    expect(starButton.className).toContain("bg-white/[0.1]")
    // "folder" should no longer be selected
    expect(folderButton.className).not.toContain("bg-white/[0.1]")
  })

  // 13. Cancel button calls onClose
  it("calls onClose when Cancel button is clicked", () => {
    const props = defaultProps()
    render(<CreateCollectionDialog {...props} />)

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(props.onClose).toHaveBeenCalled()
  })

  // 14. Close X button calls onClose
  it("calls onClose when close X button is clicked", () => {
    const props = defaultProps()
    render(<CreateCollectionDialog {...props} />)

    fireEvent.click(screen.getByLabelText("Close dialog"))

    expect(props.onClose).toHaveBeenCalled()
  })
})

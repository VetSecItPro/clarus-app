// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, fireEvent, cleanup } from "@testing-library/react"
import { AnalysisModeSelector } from "@/components/analysis-mode-selector"
import { MODE_OPTIONS } from "@/lib/analysis-modes"
import type { AnalysisMode } from "@/lib/analysis-modes"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/components/analysis-mode-sheet", () => ({
  AnalysisModeSheet: () => null,
}))

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="tooltip-content">{children}</span>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => <>{children}</>,
}))

// ---------------------------------------------------------------------------
// Cleanup between tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSelector(overrides: {
  selectedMode?: AnalysisMode
  onModeChange?: (mode: AnalysisMode) => void
  isLocked?: boolean
} = {}) {
  const props = {
    selectedMode: overrides.selectedMode ?? "learn",
    onModeChange: overrides.onModeChange ?? vi.fn(),
    isLocked: overrides.isLocked,
  }
  return { ...render(<AnalysisModeSelector {...props} />), props }
}

/** Returns only the desktop mode buttons (inside the sm:flex container). */
function getDesktopButtons(container: HTMLElement): HTMLButtonElement[] {
  const desktopContainer = container.querySelector(".sm\\:flex")
  if (!desktopContainer) return []
  return Array.from(desktopContainer.querySelectorAll("button"))
}

/** Returns the mobile pill button (the sm:hidden button). */
function getMobilePill(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector("button.sm\\:hidden")
}

// ---------------------------------------------------------------------------
// Desktop view (hidden sm:flex row of buttons)
// ---------------------------------------------------------------------------

describe("AnalysisModeSelector", () => {
  describe("Desktop view", () => {
    it("renders all 5 mode buttons", () => {
      const { container } = renderSelector()

      const desktopButtons = getDesktopButtons(container)
      expect(desktopButtons.length).toBe(5)

      // Each button displays the corresponding mode label
      for (let i = 0; i < MODE_OPTIONS.length; i++) {
        expect(desktopButtons[i].textContent).toContain(MODE_OPTIONS[i].label)
      }
    })

    it("shows the correct mode as active via styling", () => {
      const { container } = renderSelector({ selectedMode: "evaluate" })

      const desktopButtons = getDesktopButtons(container)
      for (let i = 0; i < desktopButtons.length; i++) {
        const btn = desktopButtons[i]
        if (MODE_OPTIONS[i].id === "evaluate") {
          // Active button has brand styling
          expect(btn.className).toContain("bg-brand")
          expect(btn.className).toContain("text-brand")
        } else {
          // Inactive buttons do not have bg-brand/10
          expect(btn.className).not.toContain("bg-brand/10")
        }
      }
    })

    it("calls onModeChange when a mode button is clicked", () => {
      const onModeChange = vi.fn()
      const { container } = renderSelector({ selectedMode: "learn", onModeChange })

      const desktopButtons = getDesktopButtons(container)
      // Click the "Apply" button (index 1 = "apply" mode)
      fireEvent.click(desktopButtons[1])

      expect(onModeChange).toHaveBeenCalledTimes(1)
      expect(onModeChange).toHaveBeenCalledWith("apply")
    })

    it("does NOT call onModeChange when locked", () => {
      const onModeChange = vi.fn()
      const { container } = renderSelector({
        selectedMode: "learn",
        onModeChange,
        isLocked: true,
      })

      const desktopButtons = getDesktopButtons(container)
      // Try clicking every desktop button — none should fire
      for (const btn of desktopButtons) {
        fireEvent.click(btn)
      }

      expect(onModeChange).not.toHaveBeenCalled()
    })

    it("shows lock icon instead of mode icon when locked", () => {
      const { container } = renderSelector({ isLocked: true })

      const desktopButtons = getDesktopButtons(container)
      expect(desktopButtons.length).toBe(5)

      // Each desktop button should have exactly one svg (the Lock icon)
      for (const btn of desktopButtons) {
        const svgs = btn.querySelectorAll("svg")
        expect(svgs.length).toBe(1)
      }
    })

    it("all buttons are disabled when locked", () => {
      const { container } = renderSelector({ isLocked: true })

      // Desktop buttons
      const desktopButtons = getDesktopButtons(container)
      for (const btn of desktopButtons) {
        expect(btn).toBeDisabled()
      }

      // Mobile pill button
      const mobilePill = getMobilePill(container)
      expect(mobilePill).not.toBeNull()
      expect(mobilePill!).toBeDisabled()
    })

    it("shows tooltip with upgrade message when locked", () => {
      const { container } = renderSelector({ isLocked: true })

      const desktopContainer = container.querySelector(".sm\\:flex")
      const tooltipContents = desktopContainer!.querySelectorAll(
        '[data-testid="tooltip-content"]'
      )
      expect(tooltipContents.length).toBe(5)

      for (const tc of tooltipContents) {
        expect(tc.textContent).toBe("Upgrade to Starter to customize")
      }
    })

    it("shows tooltip with mode description when not locked", () => {
      const { container } = renderSelector({ selectedMode: "learn", isLocked: false })

      const desktopContainer = container.querySelector(".sm\\:flex")
      const tooltipContents = desktopContainer!.querySelectorAll(
        '[data-testid="tooltip-content"]'
      )
      expect(tooltipContents.length).toBe(5)

      for (let i = 0; i < tooltipContents.length; i++) {
        expect(tooltipContents[i].textContent).toBe(MODE_OPTIONS[i].description)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Mobile view (single pill button)
  // ---------------------------------------------------------------------------

  describe("Mobile view", () => {
    it("mobile pill shows current mode label", () => {
      const { container } = renderSelector({ selectedMode: "discover" })

      const mobilePill = getMobilePill(container)
      expect(mobilePill).not.toBeNull()
      expect(mobilePill!.textContent).toContain("Discover")
    })

    it('shows "Mode:" prefix on mobile pill', () => {
      const { container } = renderSelector({ selectedMode: "learn" })

      const mobilePill = getMobilePill(container)
      expect(mobilePill).not.toBeNull()
      expect(mobilePill!.textContent).toContain("Mode:")
    })

    it("mobile pill updates label when selectedMode changes", () => {
      const { container, rerender } = render(
        <AnalysisModeSelector selectedMode="learn" onModeChange={vi.fn()} />
      )

      let mobilePill = getMobilePill(container)
      expect(mobilePill!.textContent).toContain("Learn")

      rerender(
        <AnalysisModeSelector selectedMode="create" onModeChange={vi.fn()} />
      )

      mobilePill = getMobilePill(container)
      expect(mobilePill!.textContent).toContain("Create")
    })
  })
})

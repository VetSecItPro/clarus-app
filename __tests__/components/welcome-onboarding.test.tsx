// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { WelcomeOnboarding, hasCompletedOnboarding } from "@/components/welcome-onboarding"

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
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  localStorage.clear()
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────

describe("hasCompletedOnboarding", () => {
  it("returns false when not completed", () => {
    expect(hasCompletedOnboarding()).toBe(false)
  })

  it("returns true when completed", () => {
    localStorage.setItem("clarus_onboarding_completed", "true")
    expect(hasCompletedOnboarding()).toBe(true)
  })
})

describe("WelcomeOnboarding", () => {
  it("renders first step with welcome message", () => {
    render(<WelcomeOnboarding onComplete={vi.fn()} />)

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Welcome to Clarus")).toBeInTheDocument()
  })

  it("personalizes welcome with username", () => {
    render(<WelcomeOnboarding username="Alex" onComplete={vi.fn()} />)

    expect(screen.getByText("Welcome to Clarus, Alex")).toBeInTheDocument()
  })

  it("shows content type features on step 1", () => {
    render(<WelcomeOnboarding onComplete={vi.fn()} />)

    expect(screen.getByText("YouTube Videos")).toBeInTheDocument()
    expect(screen.getByText("Articles")).toBeInTheDocument()
    expect(screen.getByText("Podcasts")).toBeInTheDocument()
    expect(screen.getByText("PDFs")).toBeInTheDocument()
  })

  it("advances to step 2 when Next clicked", () => {
    render(<WelcomeOnboarding onComplete={vi.fn()} />)

    fireEvent.click(screen.getByText("Next"))

    expect(screen.getByText("Your Analysis Toolkit")).toBeInTheDocument()
    expect(screen.getByText("Truth Check")).toBeInTheDocument()
    expect(screen.getByText("Chat")).toBeInTheDocument()
    expect(screen.getByText("Library")).toBeInTheDocument()
  })

  it("shows Get Started on final step", () => {
    render(<WelcomeOnboarding onComplete={vi.fn()} />)

    // Go to step 2
    fireEvent.click(screen.getByText("Next"))

    expect(screen.getByText("Get Started")).toBeInTheDocument()
    expect(screen.queryByText("Next")).not.toBeInTheDocument()
  })

  it("calls onComplete and stores flag on Get Started", () => {
    const onComplete = vi.fn()
    render(<WelcomeOnboarding onComplete={onComplete} />)

    // Step 1 -> Step 2
    fireEvent.click(screen.getByText("Next"))
    // Step 2 -> Complete
    fireEvent.click(screen.getByText("Get Started"))

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem("clarus_onboarding_completed")).toBe("true")
  })

  it("calls onComplete on Skip", () => {
    const onComplete = vi.fn()
    render(<WelcomeOnboarding onComplete={onComplete} />)

    // There are two skip elements: "Skip" text button and X icon
    const skipButton = screen.getByText("Skip")
    fireEvent.click(skipButton)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem("clarus_onboarding_completed")).toBe("true")
  })

  it("calls onComplete on X button click", () => {
    const onComplete = vi.fn()
    render(<WelcomeOnboarding onComplete={onComplete} />)

    fireEvent.click(screen.getByLabelText("Skip onboarding"))

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("shows step indicator dots", () => {
    const { container } = render(<WelcomeOnboarding onComplete={vi.fn()} />)

    // 2 steps = 2 indicator dots
    const dots = container.querySelectorAll(".rounded-full.h-1")
    expect(dots.length).toBe(2)

    // First dot should be active (bg-brand)
    expect(dots[0].className).toContain("bg-brand")
  })

  it("updates step indicator on navigation", () => {
    const { container } = render(<WelcomeOnboarding onComplete={vi.fn()} />)

    fireEvent.click(screen.getByText("Next"))

    const dots = container.querySelectorAll(".rounded-full.h-1")
    // Both dots should be active on step 2
    expect(dots[0].className).toContain("bg-brand")
    expect(dots[1].className).toContain("bg-brand")
  })
})

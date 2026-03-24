// @vitest-environment jsdom
import React from "react"
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { GoogleOAuthButton } from "@/components/google-oauth-button"

// ── Mocks ─────────────────────────────────────────

const mockSignInWithOAuth = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  },
}))

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  mockSignInWithOAuth.mockResolvedValue({ error: null })
})

// ── Tests ─────────────────────────────────────────

describe("GoogleOAuthButton", () => {
  it("renders with default label", () => {
    render(<GoogleOAuthButton />)
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument()
  })

  it("renders with custom label", () => {
    render(<GoogleOAuthButton label="Sign in with Google" />)
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeInTheDocument()
  })

  it("shows Google logo SVG", () => {
    const { container } = render(<GoogleOAuthButton />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
  })

  it("calls signInWithOAuth on click", async () => {
    render(<GoogleOAuthButton />)

    fireEvent.click(screen.getByRole("button"))

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: expect.objectContaining({
          redirectTo: expect.stringContaining("/auth/callback"),
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        }),
      })
    })
  })

  it("includes returnTo in redirect URL when provided", async () => {
    render(<GoogleOAuthButton returnTo="/dashboard" />)

    fireEvent.click(screen.getByRole("button"))

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            redirectTo: expect.stringContaining("next=%2Fdashboard"),
          }),
        })
      )
    })
  })

  it("shows loading state while authenticating", async () => {
    // Make the auth call hang
    mockSignInWithOAuth.mockReturnValue(new Promise(() => {}))

    render(<GoogleOAuthButton />)

    fireEvent.click(screen.getByRole("button"))

    await waitFor(() => {
      expect(screen.getByText("Redirecting...")).toBeInTheDocument()
      expect(screen.getByRole("button")).toBeDisabled()
    })
  })

  it("recovers from auth error", async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ error: new Error("Auth failed") })

    render(<GoogleOAuthButton />)

    fireEvent.click(screen.getByRole("button"))

    // Should recover to non-loading state
    await waitFor(() => {
      expect(screen.getByText("Continue with Google")).toBeInTheDocument()
      expect(screen.getByRole("button")).not.toBeDisabled()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks — must be declared before imports
// =============================================================================

const mockValidateEvent = vi.fn()
vi.mock("@polar-sh/sdk/webhooks", () => ({
  validateEvent: (...args: unknown[]) => mockValidateEvent(...args),
  WebhookVerificationError: class WebhookVerificationError extends Error {},
}))

const mockSupabaseFrom = vi.fn()
const mockSupabaseUpdate = vi.fn()
const mockSupabaseEq = vi.fn()
const mockSupabaseSelect = vi.fn()

// Controllable user lookup — set to null to simulate "user not found"
let mockUserLookupResult: { id: string; email?: string; display_name?: string } | null = {
  id: "user-123",
  email: "test@test.com",
  display_name: "Test",
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      mockSupabaseFrom(table)
      return {
        update: (data: unknown) => {
          mockSupabaseUpdate(data)
          return {
            eq: (field: string, value: string) => {
              mockSupabaseEq(field, value)
              return { error: null }
            },
          }
        },
        select: (fields: string) => {
          mockSupabaseSelect(fields)
          return {
            eq: (field: string, value: string) => {
              mockSupabaseEq(field, value)
              return {
                single: () => {
                  if (!mockUserLookupResult) {
                    return { data: null, error: { code: "PGRST116" } }
                  }
                  return { data: mockUserLookupResult, error: null }
                },
              }
            },
          }
        },
      }
    },
  }),
}))

vi.mock("@/lib/polar", () => ({
  getTierFromProductId: (productId: string) => {
    if (productId === "prod-starter") return "starter"
    if (productId === "prod-pro") return "pro"
    return null
  },
}))

const mockSendStartedEmail = vi.fn().mockResolvedValue(undefined)
const mockSendCancelledEmail = vi.fn().mockResolvedValue(undefined)
const mockSendPaymentFailedEmail = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/email", () => ({
  sendSubscriptionStartedEmail: (...args: unknown[]) => mockSendStartedEmail(...args),
  sendSubscriptionCancelledEmail: (...args: unknown[]) => mockSendCancelledEmail(...args),
  sendPaymentFailedEmail: (...args: unknown[]) => mockSendPaymentFailedEmail(...args),
}))

// =============================================================================
// Import handler after mocks are set up
// =============================================================================

import { POST } from "@/app/api/polar/webhook/route"

// =============================================================================
// Helpers
// =============================================================================

function createWebhookRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("https://clarusapp.io/api/polar/webhook", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "webhook-id": "wh_123",
      "webhook-timestamp": "1234567890",
      "webhook-signature": "v1,valid",
      ...headers,
    },
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/polar/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserLookupResult = { id: "user-123", email: "test@test.com", display_name: "Test" }
    process.env.POLAR_WEBHOOK_SECRET = "test-webhook-secret"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
  })

  // ---------------------------------------------------------------------------
  // Configuration checks
  // ---------------------------------------------------------------------------

  it("returns 503 when POLAR_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.POLAR_WEBHOOK_SECRET

    const request = createWebhookRequest("{}")
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toBe("Webhook not configured")
  })

  // ---------------------------------------------------------------------------
  // Signature verification
  // ---------------------------------------------------------------------------

  it("returns 401 when webhook signature is invalid", async () => {
    const { WebhookVerificationError } = await import("@polar-sh/sdk/webhooks")
    mockValidateEvent.mockImplementation(() => {
      throw new WebhookVerificationError("Invalid signature")
    })

    const request = createWebhookRequest("{}")
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Unauthorized")
  })

  // ---------------------------------------------------------------------------
  // checkout.created — no-op
  // ---------------------------------------------------------------------------

  it("returns 200 for checkout.created event (no-op)", async () => {
    mockValidateEvent.mockReturnValue({ type: "checkout.created", data: {} })

    const request = createWebhookRequest("{}")
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.received).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // checkout.updated — day pass activation
  // ---------------------------------------------------------------------------

  it("activates day pass on successful checkout with day_pass tier", async () => {
    mockValidateEvent.mockReturnValue({
      type: "checkout.updated",
      data: {
        status: "succeeded",
        metadata: { supabase_user_id: "user-123", tier: "day_pass" },
        customerId: "cust_abc",
      },
    })

    const request = createWebhookRequest("{}")
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.received).toBe(true)

    // Verify tier was set to day_pass
    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "day_pass" })
    )
    // Verify day_pass_expires_at was set (should be ~24h from now)
    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        day_pass_expires_at: expect.stringContaining("T"),
      })
    )
    // Verify confirmation email was sent
    expect(mockSendStartedEmail).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // subscription.created — active subscription
  // ---------------------------------------------------------------------------

  it("sets tier and clears day_pass on subscription.created (active)", async () => {
    mockValidateEvent.mockReturnValue({
      type: "subscription.created",
      data: {
        status: "active",
        id: "sub_123",
        customerId: "cust_abc",
        metadata: { supabase_user_id: "user-123", tier: "pro", interval: "monthly" },
        productId: "prod-pro",
        currentPeriodEnd: "2026-03-12T00:00:00Z",
      },
    })

    const request = createWebhookRequest("{}")
    const response = await POST(request)

    expect(response.status).toBe(200)

    // Verify subscription update
    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: "active",
        subscription_id: "sub_123",
        tier: "pro",
        day_pass_expires_at: null,
        polar_customer_id: "cust_abc",
      })
    )
    // Verify welcome email sent
    expect(mockSendStartedEmail).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // subscription.created — user not found
  // ---------------------------------------------------------------------------

  it("returns 400 when subscription event has no matching user", async () => {
    // Simulate no user found in database
    mockUserLookupResult = null

    mockValidateEvent.mockReturnValue({
      type: "subscription.created",
      data: {
        status: "active",
        id: "sub_orphan",
        customerId: "cust_unknown",
        metadata: {},
        productId: "prod-pro",
      },
    })

    const request = createWebhookRequest("{}")
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("User not found")
  })

  // ---------------------------------------------------------------------------
  // subscription.canceled
  // ---------------------------------------------------------------------------

  it("resets tier to free on subscription.canceled", async () => {
    mockValidateEvent.mockReturnValue({
      type: "subscription.canceled",
      data: {
        customerId: "cust_abc",
        metadata: { supabase_user_id: "user-123", tier: "pro" },
        productId: "prod-pro",
        currentPeriodEnd: "2026-03-12T00:00:00Z",
      },
    })

    const request = createWebhookRequest("{}")
    const response = await POST(request)

    expect(response.status).toBe(200)

    // Verify tier reset
    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: "canceled",
        tier: "free",
      })
    )
    // Verify cancellation email sent
    expect(mockSendCancelledEmail).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // subscription.updated — past_due (payment failed)
  // ---------------------------------------------------------------------------

  it("sends payment failed email on subscription.updated with past_due status", async () => {
    mockValidateEvent.mockReturnValue({
      type: "subscription.updated",
      data: {
        status: "past_due",
        id: "sub_123",
        customerId: "cust_abc",
        metadata: { supabase_user_id: "user-123", tier: "starter", interval: "monthly" },
        productId: "prod-starter",
        currentPeriodEnd: "2026-03-12T00:00:00Z",
      },
    })

    const request = createWebhookRequest("{}")
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockSendPaymentFailedEmail).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // Unhandled event type
  // ---------------------------------------------------------------------------

  it("returns 200 for unhandled event types (graceful no-op)", async () => {
    mockValidateEvent.mockReturnValue({ type: "order.created", data: {} })

    const request = createWebhookRequest("{}")
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.received).toBe(true)
  })
})

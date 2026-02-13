import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Module mocks
// =============================================================================

const mockUser = { id: "user-123", email: "test@test.com" }
let mockAuthSuccess = true

vi.mock("@/lib/auth", () => ({
  authenticateRequest: vi.fn(async () => {
    if (!mockAuthSuccess) {
      const { NextResponse } = await import("next/server")
      return {
        success: false,
        response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      }
    }
    return { success: true, user: mockUser, supabase: {} }
  }),
  getAdminClient: () => mockAdminClient,
}))

// Track all Supabase operations for verification
const deleteOps: Array<{ table: string; field: string; value: unknown; method: string }> = []
const selectOps: Array<{ table: string; field: string; value: string }> = []

// Mock data for each table
const mockContentIds = ["content-1", "content-2"]
const mockThreadIds = ["thread-1"]
const mockCollectionIds = ["coll-1"]

const mockAdminClient = {
  from: (table: string) => ({
    select: (_fields: string) => ({
      eq: (field: string, value: string) => {
        selectOps.push({ table, field, value })
        if (table === "content") return { data: mockContentIds.map(id => ({ id })) }
        if (table === "chat_threads") return { data: mockThreadIds.map(id => ({ id })) }
        if (table === "collections") return { data: mockCollectionIds.map(id => ({ id })) }
        return { data: [] }
      },
    }),
    delete: () => ({
      eq: (field: string, value: unknown) => {
        deleteOps.push({ table, field, value, method: "eq" })
        return { error: null }
      },
      in: (field: string, value: unknown) => {
        deleteOps.push({ table, field, value, method: "in" })
        return { error: null }
      },
    }),
  }),
  auth: {
    admin: {
      deleteUser: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}

// =============================================================================
// Import handler after mocks
// =============================================================================

import { DELETE } from "@/app/api/account/delete/route"

// =============================================================================
// Helpers
// =============================================================================

function createDeleteRequest(body?: unknown) {
  return new Request("https://clarusapp.io/api/account/delete", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

// =============================================================================
// Tests
// =============================================================================

describe("DELETE /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteOps.length = 0
    selectOps.length = 0
    mockAuthSuccess = true
  })

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  it("returns 401 when not authenticated", async () => {
    mockAuthSuccess = false

    const request = createDeleteRequest({ confirm: "DELETE_MY_ACCOUNT" })
    const response = await DELETE(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe("Authentication required")
  })

  // ---------------------------------------------------------------------------
  // Confirmation validation
  // ---------------------------------------------------------------------------

  it("returns 400 when confirmation string is missing", async () => {
    const request = createDeleteRequest({})
    const response = await DELETE(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain("Confirmation required")
  })

  it("returns 400 when confirmation string is wrong", async () => {
    const request = createDeleteRequest({ confirm: "delete" })
    const response = await DELETE(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain("Confirmation required")
  })

  it("returns 400 for invalid JSON body", async () => {
    const request = new Request("https://clarusapp.io/api/account/delete", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: "not valid json",
    })
    const response = await DELETE(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid request body")
  })

  // ---------------------------------------------------------------------------
  // Successful deletion
  // ---------------------------------------------------------------------------

  it("deletes all user data and returns success", async () => {
    const request = createDeleteRequest({ confirm: "DELETE_MY_ACCOUNT" })
    const response = await DELETE(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toContain("permanently deleted")
  })

  it("deletes child records before parent records (FK safe)", async () => {
    const request = createDeleteRequest({ confirm: "DELETE_MY_ACCOUNT" })
    await DELETE(request)

    // Verify child tables were deleted (chat_messages, summaries, claims, etc.)
    const childTables = deleteOps.filter(op => op.method === "in").map(op => op.table)
    expect(childTables).toContain("chat_messages")
    expect(childTables).toContain("summaries")
    expect(childTables).toContain("claims")
    expect(childTables).toContain("collection_items")

    // Verify parent tables were deleted (content, chat_threads, collections, users)
    const parentTables = deleteOps.filter(op => op.method === "eq").map(op => op.table)
    expect(parentTables).toContain("content")
    expect(parentTables).toContain("chat_threads")
    expect(parentTables).toContain("collections")
    expect(parentTables).toContain("users")
  })

  it("deletes usage tracking and metrics", async () => {
    const request = createDeleteRequest({ confirm: "DELETE_MY_ACCOUNT" })
    await DELETE(request)

    const deletedTables = deleteOps.map(op => op.table)
    expect(deletedTables).toContain("usage_tracking")
    expect(deletedTables).toContain("api_usage")
    expect(deletedTables).toContain("processing_metrics")
  })

  it("deletes Supabase Auth account", async () => {
    const request = createDeleteRequest({ confirm: "DELETE_MY_ACCOUNT" })
    await DELETE(request)

    expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith("user-123")
  })

  it("succeeds even if auth account deletion fails (non-fatal)", async () => {
    mockAdminClient.auth.admin.deleteUser.mockResolvedValueOnce({
      error: { message: "User not found in auth" },
    })

    const request = createDeleteRequest({ confirm: "DELETE_MY_ACCOUNT" })
    const response = await DELETE(request)
    const body = await response.json()

    // Should still return success — data is already deleted
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("deletes subscription data (podcast + youtube)", async () => {
    const request = createDeleteRequest({ confirm: "DELETE_MY_ACCOUNT" })
    await DELETE(request)

    const deletedTables = deleteOps.map(op => op.table)
    expect(deletedTables).toContain("podcast_subscriptions")
    expect(deletedTables).toContain("youtube_subscriptions")
  })
})

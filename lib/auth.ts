/**
 * Authentication & Authorization Helpers
 * Centralized auth utilities for API routes
 */

import { createServerClient } from "@supabase/ssr"
import { createClient, SupabaseClient, User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Database } from "@/types/database.types"

// Admin user IDs (should match your Supabase users)
const ADMIN_USER_IDS = new Set([
  process.env.ADMIN_USER_ID, // Primary admin
].filter(Boolean))

export interface AuthResult {
  success: true
  user: User
  supabase: SupabaseClient<Database>
}

export interface AuthError {
  success: false
  response: NextResponse
}

/**
 * Authenticate a request using session cookies
 * Returns the authenticated user and a Supabase client
 */
export async function authenticateRequest(): Promise<AuthResult | AuthError> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options)
              } catch {
                // Ignore cookie errors in read-only contexts
              }
            })
          },
        },
      }
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        ),
      }
    }

    return { success: true, user, supabase }
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      ),
    }
  }
}

/**
 * Authenticate request and verify admin status
 * Checks is_admin column in database OR environment variable whitelist
 */
export async function authenticateAdmin(): Promise<AuthResult | AuthError> {
  const auth = await authenticateRequest()
  if (!auth.success) return auth

  // Check against environment variable whitelist first (fast path)
  if (ADMIN_USER_IDS.has(auth.user.id)) {
    return auth
  }

  // Check database for is_admin flag
  const adminClient = getAdminClient()
  const { data: userData } = await adminClient
    .from("users")
    .select("is_admin")
    .eq("id", auth.user.id)
    .single()

  if (!userData?.is_admin) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    }
  }

  return auth
}

/**
 * Verify that the authenticated user owns a piece of content
 */
export async function verifyContentOwnership(
  supabase: SupabaseClient<Database>,
  userId: string,
  contentId: string
): Promise<{ owned: true; content: Database["public"]["Tables"]["content"]["Row"] } | { owned: false; response: NextResponse }> {
  const { data: content, error } = await supabase
    .from("content")
    .select("*")
    .eq("id", contentId)
    .single()

  if (error || !content) {
    return {
      owned: false,
      response: NextResponse.json(
        { error: "Content not found" },
        { status: 404 }
      ),
    }
  }

  if (content.user_id !== userId) {
    return {
      owned: false,
      response: NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      ),
    }
  }

  return { owned: true, content }
}

/**
 * Get admin Supabase client (bypasses RLS)
 * ONLY use when you've already verified authorization in code
 */
export function getAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Check if a user is an admin
 */
export function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.has(userId)
}

/**
 * Standard error responses
 */
export const AuthErrors = {
  unauthorized: () =>
    NextResponse.json({ error: "Authentication required" }, { status: 401 }),
  forbidden: () =>
    NextResponse.json({ error: "Access denied" }, { status: 403 }),
  notFound: (resource = "Resource") =>
    NextResponse.json({ error: `${resource} not found` }, { status: 404 }),
  badRequest: (message = "Invalid request") =>
    NextResponse.json({ error: message }, { status: 400 }),
  rateLimit: (resetIn: number) =>
    NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
    ),
  serverError: () =>
    NextResponse.json({ error: "Internal server error" }, { status: 500 }),
}

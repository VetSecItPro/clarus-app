/**
 * Authentication & Authorization Helpers
 * Centralized auth utilities for API routes
 */

import { createServerClient } from "@supabase/ssr"
import { createClient, SupabaseClient, User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Database } from "@/types/database.types"

// Admin cache to avoid repeated DB queries within the same runtime (5 min TTL, max 500 entries)
const adminCache = new Map<string, { isAdmin: boolean; expires: number }>()
const MAX_ADMIN_CACHE_SIZE = 500

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
        db: {
          schema: "clarus",
        },
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
 * Always checks is_admin column in database (single source of truth)
 */
export async function authenticateAdmin(): Promise<AuthResult | AuthError> {
  const auth = await authenticateRequest()
  if (!auth.success) return auth

  // Check short-lived cache first (avoids repeated DB hits within same runtime)
  const cached = adminCache.get(auth.user.id)
  if (cached && cached.expires > Date.now()) {
    if (!cached.isAdmin) {
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

  // Always check database for is_admin flag (single source of truth)
  const adminClient = getAdminClient()
  const { data: userData } = await adminClient
    .from("users")
    .select("is_admin")
    .eq("id", auth.user.id)
    .single()

  const isAdmin = userData?.is_admin === true

  // Cache for 5 minutes (evict oldest if over limit)
  if (adminCache.size >= MAX_ADMIN_CACHE_SIZE) {
    const firstKey = adminCache.keys().next().value
    if (firstKey) adminCache.delete(firstKey)
  }
  adminCache.set(auth.user.id, { isAdmin, expires: Date.now() + 5 * 60 * 1000 })

  if (!isAdmin) {
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

/** Fields returned by verifyContentOwnership — intentionally narrower than the full Row */
export type ContentOwnershipFields = Pick<
  Database["clarus"]["Tables"]["content"]["Row"],
  "id" | "user_id" | "title" | "url" | "type" | "thumbnail_url" | "tags" | "is_bookmarked" | "date_added" | "share_token" | "author" | "duration" | "detected_tone"
>

export async function verifyContentOwnership(
  supabase: SupabaseClient<Database>,
  userId: string,
  contentId: string
): Promise<{ owned: true; content: ContentOwnershipFields } | { owned: false; response: NextResponse }> {
  const { data: content, error } = await supabase
    .from("content")
    .select("id, user_id, title, url, type, thumbnail_url, tags, is_bookmarked, date_added, share_token, author, duration, detected_tone")
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: {
        schema: "clarus",
      },
    }
  )
}

/**
 * Check if a user is an admin (checks cache, falls back to DB)
 * For use in non-async contexts — prefer authenticateAdmin() in API routes
 */
export function isAdmin(userId: string): boolean {
  const cached = adminCache.get(userId)
  if (cached && cached.expires > Date.now()) {
    return cached.isAdmin
  }
  // If not cached, return false — caller should use authenticateAdmin() for authoritative check
  return false
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

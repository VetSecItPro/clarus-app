/**
 * @module auth
 * @description Authentication and authorization helpers for API routes.
 *
 * Provides cookie-based session authentication, admin verification with
 * a short-lived cache, content ownership checks, and a service-role
 * Supabase client for privileged operations.
 *
 * All API routes should call {@link authenticateRequest} (or
 * {@link authenticateAdmin} for admin endpoints) before performing any
 * database operations on behalf of a user.
 *
 * @see {@link lib/supabase-middleware.ts} for the middleware-level client
 */

import { createServerClient } from "@supabase/ssr"
import { createClient, SupabaseClient, User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Database } from "@/types/database.types"

// Admin cache to avoid repeated DB queries within the same runtime (5 min TTL, max 500 entries)
// PERF: LRU eviction strategy — tracks last access time, evicts least recently used
const adminCache = new Map<string, { isAdmin: boolean; expires: number; lastAccess: number }>()
const MAX_ADMIN_CACHE_SIZE = 500

/**
 * Successful authentication result containing the verified user
 * and a Supabase client scoped to their session.
 */
export interface AuthResult {
  success: true
  user: User
  supabase: SupabaseClient<Database>
}

/**
 * Failed authentication result containing a pre-built NextResponse
 * that the API route can return directly.
 */
export interface AuthError {
  success: false
  response: NextResponse
}

/**
 * Authenticates an incoming request using Supabase session cookies.
 *
 * Uses `supabase.auth.getUser()` (server-side JWT verification) rather
 * than `getSession()` to prevent token forgery.  Returns either an
 * {@link AuthResult} with the verified user and a scoped Supabase client,
 * or an {@link AuthError} with a 401 response.
 *
 * @returns A discriminated union -- check `result.success` before accessing fields
 *
 * @example
 * ```ts
 * const auth = await authenticateRequest()
 * if (!auth.success) return auth.response
 * const { user, supabase } = auth
 * ```
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
 * Authenticates a request and verifies the user has admin privileges.
 *
 * First calls {@link authenticateRequest}, then checks the `is_admin`
 * column in the database (the single source of truth).  Results are
 * cached for 5 minutes with LRU eviction to avoid repeated DB hits
 * within the same serverless runtime.
 *
 * @returns A discriminated union -- 401 for unauthenticated, 403 for non-admin
 *
 * @example
 * ```ts
 * const auth = await authenticateAdmin()
 * if (!auth.success) return auth.response
 * // Proceed with admin-only logic
 * ```
 */
export async function authenticateAdmin(): Promise<AuthResult | AuthError> {
  const auth = await authenticateRequest()
  if (!auth.success) return auth

  // Check short-lived cache first (avoids repeated DB hits within same runtime)
  const cached = adminCache.get(auth.user.id)
  const now = Date.now()
  if (cached && cached.expires > now) {
    // LRU: Update last access time
    cached.lastAccess = now
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

  // LRU cache eviction: if over limit, evict least recently used entry
  if (adminCache.size >= MAX_ADMIN_CACHE_SIZE) {
    let oldestKey: string | null = null
    let oldestAccess = Infinity
    for (const [key, entry] of adminCache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess
        oldestKey = key
      }
    }
    if (oldestKey) adminCache.delete(oldestKey)
  }

  // Cache for 5 minutes
  adminCache.set(auth.user.id, { isAdmin, expires: now + 5 * 60 * 1000, lastAccess: now })

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

/** Fields returned by {@link verifyContentOwnership} -- intentionally narrower than the full Row. */
export type ContentOwnershipFields = Pick<
  Database["clarus"]["Tables"]["content"]["Row"],
  "id" | "user_id" | "title" | "url" | "type" | "thumbnail_url" | "tags" | "is_bookmarked" | "date_added" | "share_token" | "author" | "duration" | "detected_tone"
>

/**
 * Verifies that a specific content record exists and belongs to the given user.
 *
 * Prevents IDOR (Insecure Direct Object Reference) attacks by ensuring
 * the authenticated user owns the content they are trying to access.
 *
 * @param supabase - An authenticated Supabase client (from {@link authenticateRequest})
 * @param userId - The authenticated user's ID
 * @param contentId - The content record ID to verify
 * @returns Either `{ owned: true, content }` or `{ owned: false, response }` with a 404/403
 *
 * @example
 * ```ts
 * const ownership = await verifyContentOwnership(supabase, user.id, contentId)
 * if (!ownership.owned) return ownership.response
 * // Safe to use ownership.content
 * ```
 */
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
 * Creates a Supabase client with the service role key (bypasses RLS).
 *
 * **Security:** Only use after authorization has already been verified
 * in application code. This client can read and write any row in the
 * `clarus` schema regardless of RLS policies.
 *
 * @returns A Supabase client configured with service-role credentials
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
 * Synchronously checks whether a user ID is cached as an admin.
 *
 * Returns `false` if the user is not in the cache or the cache entry
 * has expired.  For authoritative checks, use {@link authenticateAdmin}
 * instead.
 *
 * @param userId - The user ID to check
 * @returns `true` only if a non-expired cache entry confirms admin status
 */
export function isAdmin(userId: string): boolean {
  const cached = adminCache.get(userId)
  const now = Date.now()
  if (cached && cached.expires > now) {
    // LRU: Update last access time
    cached.lastAccess = now
    return cached.isAdmin
  }
  // If not cached, return false — caller should use authenticateAdmin() for authoritative check
  return false
}

/**
 * Pre-built error response factories for common HTTP error codes.
 *
 * Keeps error message wording consistent across all API routes and
 * prevents information leakage by using generic messages.
 *
 * @example
 * ```ts
 * return AuthErrors.notFound("Content")  // { error: "Content not found" }, 404
 * return AuthErrors.rateLimit(30000)      // Retry-After: 30
 * ```
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

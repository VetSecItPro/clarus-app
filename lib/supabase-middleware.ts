/**
 * @module supabase-middleware
 * @description Supabase client factory for Next.js middleware.
 *
 * Creates a server-side Supabase client that reads and writes auth
 * cookies through the middleware request/response cycle. This is
 * required because middleware runs on the edge and cannot use the
 * browser client's `localStorage`-based session storage.
 *
 * Cookie handling follows the Supabase SSR pattern:
 *   - `get` reads cookies from the incoming request
 *   - `set` writes cookies to both the request (for downstream handlers)
 *     and the response (for the browser)
 *   - `remove` expires cookies by setting them with `maxAge: 0`
 *
 * Session cookies persist for 30 days with `SameSite=Lax` and
 * `Secure` in production.
 *
 * @see {@link middleware.ts} for the middleware entry point that uses this client
 * @see {@link lib/supabase.ts} for the browser-side client
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database.types"

/**
 * Creates a Supabase client configured for the Next.js middleware context.
 *
 * Returns both the client and the response object, since cookie mutations
 * require updating the response headers.
 *
 * @param request - The incoming Next.js middleware request
 * @returns An object with `supabase` (the client) and `response` (the modified NextResponse)
 */
export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: {
        schema: "clarus",
      },
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
            // Ensure cookies persist for 30 days
            maxAge: options.maxAge ?? 60 * 60 * 24 * 30,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: "",
            ...options,
            maxAge: 0,
          })
        },
      },
    }
  )

  return { supabase, response }
}

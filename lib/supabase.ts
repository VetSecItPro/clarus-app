/**
 * @module supabase
 * @description Browser-side Supabase client singleton.
 *
 * Creates a single shared Supabase client for all client components.
 * Configured against the `clarus` schema. Uses default `@supabase/ssr`
 * cookie-based auth storage to stay in sync with server-side session cookies.
 *
 * Uses the **anon key** (safe for client-side) -- never the service role key.
 * For server-side admin operations, use {@link lib/auth.ts} `getAdminClient`.
 *
 * @see {@link lib/supabase-middleware.ts} for the middleware client (cookie-based auth)
 * @see {@link lib/auth.ts} getAdminClient for the server-side admin client
 */

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database.types"

let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

/** Creates or returns the singleton browser Supabase client. */
function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: {
          schema: "clarus",
        },
      }
    )
  }
  return supabaseInstance
}

/**
 * The shared browser Supabase client instance.
 * All client components import this single instance to avoid creating
 * multiple GoTrue sessions or WebSocket connections.
 */
export const supabase = getSupabaseClient()

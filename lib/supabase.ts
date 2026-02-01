import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database.types"

let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: {
          schema: "clarus",
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
        },
      }
    )
  }
  return supabaseInstance
}

// Single shared instance — all imports use the same client
export const supabase = getSupabaseClient()

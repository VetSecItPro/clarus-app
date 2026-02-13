/**
 * @module api/preferences
 * @description CRUD endpoint for user analysis preferences.
 *
 * GET  — Fetch the user's current preferences (returns defaults if no row exists)
 * PUT  — Upsert preferences (create or update)
 *
 * Tier-gated: Starter+ only. Free users cannot save preferences.
 */

import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth"
import { getUserTier } from "@/lib/usage"
import { TIER_FEATURES } from "@/lib/tier-limits"
import { updatePreferencesSchema } from "@/lib/schemas"
import { logger } from "@/lib/logger"

const DEFAULT_PREFERENCES = {
  analysis_mode: "apply",
  expertise_level: "intermediate",
  focus_areas: ["takeaways", "accuracy"],
  is_active: true,
}

export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  const { data, error } = await supabase
    .from("user_analysis_preferences")
    .select("analysis_mode, expertise_level, focus_areas, is_active, updated_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    logger.error("[preferences] GET error:", error.message)
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
  }

  return NextResponse.json({
    preferences: data ?? DEFAULT_PREFERENCES,
    hasCustomPreferences: !!data,
  })
}

export async function PUT(request: Request) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user, supabase } = auth

  // Tier gate: Starter+ only
  const tier = await getUserTier(supabase, user.id)
  if (!TIER_FEATURES[tier].analysisPreferences) {
    return NextResponse.json(
      { error: "Analysis preferences require a Starter plan or higher." },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = updatePreferencesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid preferences", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const updates = parsed.data

  // Upsert: insert if no row exists, update if it does
  const { data, error } = await supabase
    .from("user_analysis_preferences")
    .upsert(
      {
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("analysis_mode, expertise_level, focus_areas, is_active, updated_at")
    .single()

  if (error) {
    logger.error("[preferences] PUT error:", error.message)
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 })
  }

  return NextResponse.json({ preferences: data })
}

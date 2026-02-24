/**
 * @module schemas/user
 * @description User-related validation schemas (name, preferences, digest).
 */

import { z } from "zod"
import { usernameSchema } from "./base"

/**
 * Update user name request
 */
export const updateNameSchema = z.object({
  name: usernameSchema,
})

// ===========================================
// ANALYSIS PREFERENCES SCHEMAS
// ===========================================

const VALID_ANALYSIS_MODES = ["learn", "apply", "evaluate", "discover", "create"] as const
const VALID_EXPERTISE_LEVELS = ["beginner", "intermediate", "expert"] as const
const VALID_FOCUS_AREAS = ["accuracy", "takeaways", "efficiency", "depth", "bias", "novelty"] as const

export const updatePreferencesSchema = z.object({
  analysis_mode: z.enum(VALID_ANALYSIS_MODES).optional(),
  expertise_level: z.enum(VALID_EXPERTISE_LEVELS).optional(),
  focus_areas: z
    .array(z.enum(VALID_FOCUS_AREAS))
    .max(3, "Maximum 3 focus areas allowed")
    .refine((arr) => new Set(arr).size === arr.length, "Duplicate focus areas not allowed")
    .optional(),
  is_active: z.boolean().optional(),
})

/**
 * Digest preferences update
 */
export const digestPreferencesSchema = z.object({
  digest_enabled: z.boolean(),
})

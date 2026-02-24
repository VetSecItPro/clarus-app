/**
 * @module schemas/collections
 * @description Collection-related validation schemas.
 */

import { z } from "zod"
import { uuidSchema, XSS_PATTERNS } from "./base"

/** Preset colors for collections */
export const COLLECTION_COLORS = [
  "#1d9bf0", // Blue (primary)
  "#7c3aed", // Purple
  "#ef4444", // Red
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#f97316", // Orange
  "#06b6d4", // Cyan
] as const

/** Hex color schema restricted to preset palette */
const collectionColorSchema = z
  .string()
  .trim()
  .refine(
    (val) => (COLLECTION_COLORS as readonly string[]).includes(val),
    { message: "Invalid collection color" }
  )

/**
 * Create collection request
 */
export const createCollectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Collection name is required")
    .max(100, "Collection name is too long (max 100 characters)")
    .transform((name) => {
      let sanitized = name
      for (const pattern of XSS_PATTERNS) {
        sanitized = sanitized.replace(pattern, "")
      }
      return sanitized
    }),
  description: z
    .string()
    .trim()
    .max(500, "Description is too long (max 500 characters)")
    .transform((text) => {
      let sanitized = text
      for (const pattern of XSS_PATTERNS) {
        sanitized = sanitized.replace(pattern, "")
      }
      return sanitized
    })
    .optional()
    .nullable(),
  color: collectionColorSchema.optional().nullable(),
  icon: z
    .string()
    .trim()
    .max(50, "Icon value is too long")
    .optional()
    .nullable(),
})

/**
 * Update collection request
 */
export const updateCollectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Collection name is required")
    .max(100, "Collection name is too long (max 100 characters)")
    .transform((name) => {
      let sanitized = name
      for (const pattern of XSS_PATTERNS) {
        sanitized = sanitized.replace(pattern, "")
      }
      return sanitized
    })
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description is too long (max 500 characters)")
    .transform((text) => {
      let sanitized = text
      for (const pattern of XSS_PATTERNS) {
        sanitized = sanitized.replace(pattern, "")
      }
      return sanitized
    })
    .optional()
    .nullable(),
  color: collectionColorSchema.optional().nullable(),
  icon: z
    .string()
    .trim()
    .max(50, "Icon value is too long")
    .optional()
    .nullable(),
})

/**
 * Add item to collection request
 */
export const addToCollectionSchema = z.object({
  content_id: uuidSchema,
})

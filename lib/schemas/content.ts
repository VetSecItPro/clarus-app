/**
 * @module schemas/content
 * @description Content-related API request schemas (process, search, export, etc.).
 */

import { z } from "zod"
import {
  uuidSchema,
  safeUrlSchema,
  emailSchema,
  safeTextSchema,
  htmlSafeSchema,
  contentTypeSchema,
} from "./base"

/**
 * Process content request
 */
export const processContentSchema = z.object({
  content_id: uuidSchema,
  force_regenerate: z.boolean().optional().default(false),
  language: z.string().min(2).max(5).optional().default("en"),
  skipScraping: z.boolean().optional().default(false),
})

/**
 * Search request
 */
export const searchSchema = z.object({
  q: z.string().trim().min(1, "Search query is required").max(500),
  content_type: contentTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  bookmark_only: z.coerce.boolean().optional().default(false),
  tags: z.string().optional(), // Comma-separated tag list
})

/**
 * Tags update request
 */
export const tagsUpdateSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
})

/**
 * Bookmark update request
 */
export const bookmarkUpdateSchema = z.object({
  is_bookmarked: z.boolean(),
})

/**
 * Share content request
 */
export const shareContentSchema = z.object({
  to: emailSchema,
  subject: z.string().trim().min(1).max(200).optional(),
  contentTitle: z.string().trim().max(500).optional(),
  contentUrl: safeUrlSchema.optional(),
  briefOverview: safeTextSchema.optional(),
  personalMessage: htmlSafeSchema.optional(),
})

/**
 * Export request (query params)
 */
export const exportSchema = z.object({
  id: uuidSchema,
})

/**
 * Compare content request — accepts 2-3 content IDs
 */
export const compareContentSchema = z.object({
  contentIds: z.array(uuidSchema).min(2, "At least 2 items required").max(3, "Maximum 3 items allowed"),
})

/**
 * Fetch title request — accepts a URL
 */
export const fetchTitleSchema = z.object({
  url: safeUrlSchema,
})

/**
 * Translate content request — accepts a language code
 */
export const translateContentSchema = z.object({
  language: z.string().trim().min(2, "Language code is required").max(5, "Invalid language code"),
})

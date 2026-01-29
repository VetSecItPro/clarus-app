/**
 * Zod Schemas for API Input Validation
 * Centralized validation schemas for all API routes
 */

import { z } from "zod"

// ===========================================
// CUSTOM VALIDATORS
// ===========================================

// UUID v4 regex
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Dangerous URL schemes
const DANGEROUS_SCHEMES = ["javascript:", "data:", "vbscript:", "file:"]

// Internal IPs for SSRF protection
const INTERNAL_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]

// XSS patterns to strip
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
]

// ===========================================
// BASE SCHEMAS
// ===========================================

/**
 * UUID v4 schema - strict validation
 */
export const uuidSchema = z
  .string()
  .trim()
  .refine((val) => UUID_V4_REGEX.test(val), {
    message: "Invalid UUID format",
  })
  .transform((val) => val.toLowerCase())

/**
 * Safe URL schema with SSRF protection
 */
export const safeUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL is too long (max 2048 characters)")
  .refine(
    (url) => {
      const lower = url.toLowerCase()
      return !DANGEROUS_SCHEMES.some((scheme) => lower.startsWith(scheme))
    },
    { message: "Invalid URL scheme" }
  )
  .refine(
    (url) => {
      try {
        const parsed = new URL(url)
        return ["http:", "https:"].includes(parsed.protocol)
      } catch {
        return false
      }
    },
    { message: "Only HTTP and HTTPS URLs are allowed" }
  )
  .refine(
    (url) => {
      try {
        const parsed = new URL(url)
        const hostname = parsed.hostname.toLowerCase()
        // Block internal IPs
        if (INTERNAL_HOSTNAMES.includes(hostname)) return false
        if (hostname.startsWith("192.168.")) return false
        if (hostname.startsWith("10.")) return false
        if (hostname.startsWith("172.16.")) return false
        return true
      } catch {
        return false
      }
    },
    { message: "Internal URLs are not allowed" }
  )
  .transform((url) => {
    const parsed = new URL(url)
    return parsed.href
  })

/**
 * Email schema with header injection protection
 */
export const emailSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .max(254, "Email is too long")
  .refine(
    (email) => !email.includes("\n") && !email.includes("\r"),
    { message: "Invalid characters in email" }
  )

/**
 * Username schema (3-20 chars, alphanumeric + underscore)
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores"
  )

/**
 * Chat message schema with XSS stripping
 */
export const chatMessageSchema = z
  .string()
  .trim()
  .min(1, "Message cannot be empty")
  .max(10000, "Message is too long (max 10000 characters)")
  .transform((msg) => {
    let sanitized = msg
    for (const pattern of XSS_PATTERNS) {
      sanitized = sanitized.replace(pattern, "")
    }
    return sanitized
  })

/**
 * Safe text input (general purpose with HTML encoding)
 */
export const safeTextSchema = z
  .string()
  .trim()
  .max(10000, "Text is too long")
  .transform((text) => {
    // Strip dangerous script patterns
    let sanitized = text
    for (const pattern of XSS_PATTERNS) {
      sanitized = sanitized.replace(pattern, "")
    }
    return sanitized
  })

/**
 * HTML-safe text for display (encodes HTML entities)
 */
export const htmlSafeSchema = z.string().transform((text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
)

// ===========================================
// CONTENT TYPE SCHEMAS
// ===========================================

export const contentTypeSchema = z.enum([
  "youtube",
  "article",
  "pdf",
  "x_post",
])

export const contentCategorySchema = z.enum([
  "music",
  "podcast",
  "news",
  "opinion",
  "educational",
  "entertainment",
  "documentary",
  "product_review",
  "tech",
  "finance",
  "health",
  "other",
])

// ===========================================
// API REQUEST SCHEMAS
// ===========================================

/**
 * Process content request
 */
export const processContentSchema = z.object({
  content_id: uuidSchema,
  force_regenerate: z.boolean().optional().default(false),
})

/**
 * Process PDF request (form data fields)
 */
export const processPdfSchema = z.object({
  user_id: uuidSchema,
  title: z.string().trim().min(1).max(500).optional(),
})

/**
 * Search request
 */
export const searchSchema = z.object({
  q: z.string().trim().min(1, "Search query is required").max(500),
  content_type: contentTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/**
 * Chat request
 */
export const chatRequestSchema = z.object({
  message: chatMessageSchema,
  summary_id: uuidSchema,
  thread_id: uuidSchema.optional(),
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
 * Update user name request
 */
export const updateNameSchema = z.object({
  name: usernameSchema,
})

/**
 * Polar checkout request
 */
export const checkoutSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  successUrl: safeUrlSchema.optional(),
  cancelUrl: safeUrlSchema.optional(),
})

/**
 * Export request (query params)
 */
export const exportSchema = z.object({
  id: uuidSchema,
})

/**
 * Admin metrics request
 */
export const adminMetricsSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
})

// ===========================================
// TYPE EXPORTS
// ===========================================

export type ProcessContentInput = z.infer<typeof processContentSchema>
export type SearchInput = z.infer<typeof searchSchema>
export type ChatRequestInput = z.infer<typeof chatRequestSchema>
export type TagsUpdateInput = z.infer<typeof tagsUpdateSchema>
export type BookmarkUpdateInput = z.infer<typeof bookmarkUpdateSchema>
export type ShareContentInput = z.infer<typeof shareContentSchema>
export type UpdateNameInput = z.infer<typeof updateNameSchema>
export type CheckoutInput = z.infer<typeof checkoutSchema>
export type ExportInput = z.infer<typeof exportSchema>

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Parse and validate request body with Zod schema
 * Returns { success: true, data } or { success: false, error }
 */
export function parseBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(body)
  if (!result.success) {
    // Zod v4 uses issues array
    const errors = result.error.issues.map((e: z.ZodIssue) => e.message).join(", ")
    return { success: false, error: errors }
  }
  return { success: true, data: result.data }
}

/**
 * Parse query parameters from URLSearchParams
 */
export function parseQuery<T extends z.ZodSchema>(
  schema: T,
  searchParams: URLSearchParams
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })
  return parseBody(schema, params)
}

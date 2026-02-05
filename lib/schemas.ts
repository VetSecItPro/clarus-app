/**
 * @module schemas
 * @description Centralized Zod validation schemas for all API routes.
 *
 * Every API request body and query parameter set passes through a schema
 * defined here before touching business logic. This ensures:
 *   - Type-safe parsing with runtime validation
 *   - SSRF protection on URL inputs (blocks internal IPs, cloud metadata endpoints)
 *   - XSS sanitization on text inputs (strips script tags and event handlers)
 *   - Email header injection prevention
 *   - UUID v4 format enforcement with case normalization
 *
 * Schemas are composed from reusable base schemas (`uuidSchema`, `safeUrlSchema`,
 * `emailSchema`, etc.) into API-specific request schemas (`processContentSchema`,
 * `chatRequestSchema`, etc.).
 *
 * @see {@link lib/validation.ts} for the older imperative validation utilities
 */

import { z } from "zod"

// ===========================================
// CUSTOM VALIDATORS
// ===========================================

// UUID v4 regex
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Dangerous URL schemes
const DANGEROUS_SCHEMES = ["javascript:", "data:", "vbscript:", "file:"]

// SECURITY: Internal IPs for SSRF protection — FIX-008 (added decimal/octal/hex IP bypass protection)
const INTERNAL_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "169.254.169.254",       // Cloud metadata endpoint (AWS/GCP/Azure)
  "metadata.google.internal",
  "2130706433",            // 127.0.0.1 in decimal notation
  "0x7f000001",            // 127.0.0.1 in hex notation
  "017700000001",          // 127.0.0.1 in octal notation
  "0177.0.0.1",            // 127.0.0.1 in octal dotted
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
        // Full RFC 1918 range: 172.16.0.0 - 172.31.255.255
        const match172 = hostname.match(/^172\.(\d+)\./)
        if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) return false
        // Block link-local
        if (hostname.startsWith("169.254.")) return false
        // Block IPv6-mapped IPv4 (::ffff:127.0.0.1)
        if (hostname.includes("::ffff:")) return false
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
const htmlSafeSchema = z.string().transform((text) =>
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

const contentTypeSchema = z.enum([
  "youtube",
  "article",
  "pdf",
  "document",
  "x_post",
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
 * Contact form request
 */
export const contactFormSchema = z.object({
  name: safeTextSchema.pipe(z.string().min(1, "Name is required").max(100, "Name is too long")),
  email: emailSchema,
  subject: safeTextSchema.pipe(z.string().min(1, "Subject is required").max(200, "Subject is too long")),
  message: safeTextSchema.pipe(z.string().min(10, "Message must be at least 10 characters").max(5000, "Message is too long (max 5000 characters)")),
})

/**
 * Digest preferences update
 */
export const digestPreferencesSchema = z.object({
  digest_enabled: z.boolean(),
})

/**
 * Export request (query params)
 */
export const exportSchema = z.object({
  id: uuidSchema,
})

// ===========================================
// COLLECTION SCHEMAS
// ===========================================

/** Preset colors for collections */
const COLLECTION_COLORS = [
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

/** Exported preset colors for UI use */
export { COLLECTION_COLORS }

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Parses and validates a request body against a Zod schema.
 *
 * Returns a discriminated union: check `success` before accessing `data` or `error`.
 * Error messages are joined from all Zod issues for display in API responses.
 *
 * @param schema - The Zod schema to validate against
 * @param body - The raw request body (typically from `await request.json()`)
 * @returns `{ success: true, data }` on valid input, `{ success: false, error }` on invalid
 *
 * @example
 * ```ts
 * const result = parseBody(processContentSchema, await request.json())
 * if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
 * const { content_id } = result.data
 * ```
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
 * Parses and validates URL query parameters against a Zod schema.
 *
 * Converts `URLSearchParams` to a plain object before passing to the schema,
 * so schemas can use `z.coerce` for numeric parameters.
 *
 * @param schema - The Zod schema to validate against
 * @param searchParams - The URLSearchParams from the request URL
 * @returns `{ success: true, data }` on valid input, `{ success: false, error }` on invalid
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

/**
 * @module schemas/base
 * @description Reusable base Zod schemas and helper functions.
 *
 * Contains foundational validators (UUID, URL, email, text sanitization)
 * and the parseBody/parseQuery helpers used across all API routes.
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
export const XSS_PATTERNS = [
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
  "podcast",
  "pdf",
  "document",
  "x_post",
])

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

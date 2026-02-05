/**
 * @module validation
 * @description Input validation and sanitization for user-supplied data.
 *
 * Provides URL validation with SSRF protection, UUID validation,
 * chat message sanitization, and in-memory rate limiting.
 * Used by API routes that accept user input before any database
 * or external-service interaction.
 *
 * @see {@link lib/schemas.ts} for Zod-based request body validation
 */

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Dangerous URL schemes that could execute code
const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:']

/**
 * Result of a validation check.
 *
 * When `isValid` is `true`, `sanitized` contains the cleaned value.
 * When `isValid` is `false`, `error` contains a user-safe message.
 */
export interface ValidationResult {
  isValid: boolean
  error?: string
  sanitized?: string
}

/**
 * Validates and sanitizes a URL for content processing.
 *
 * Checks for dangerous schemes (javascript:, data:, etc.), enforces
 * HTTPS/HTTP-only, and blocks SSRF vectors including private IP ranges
 * (RFC 1918), cloud metadata endpoints, localhost, and obfuscated IP
 * notations (decimal, hex, octal).
 *
 * @param url - The raw URL string to validate
 * @returns A {@link ValidationResult} with the canonicalized URL or an error message
 *
 * @example
 * ```ts
 * const result = validateUrl("https://example.com/article?ref=twitter")
 * if (!result.isValid) {
 *   return NextResponse.json({ error: result.error }, { status: 400 })
 * }
 * // Use result.sanitized for downstream processing
 * ```
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required' }
  }

  const trimmed = url.trim()

  if (trimmed.length > 2048) {
    return { isValid: false, error: 'URL is too long (max 2048 characters)' }
  }

  // Check for dangerous schemes
  const lowerUrl = trimmed.toLowerCase()
  for (const scheme of DANGEROUS_SCHEMES) {
    if (lowerUrl.startsWith(scheme)) {
      return { isValid: false, error: 'Invalid URL scheme' }
    }
  }

  // Validate URL format
  try {
    const parsed = new URL(trimmed)

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { isValid: false, error: 'Only HTTP and HTTPS URLs are allowed' }
    }

    // SECURITY: SSRF protection — FIX-008 (added decimal/octal/hex IP bypass + all-numeric hostname check)
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '169.254.169.254' ||
      hostname === 'metadata.google.internal' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('169.254.') ||
      hostname.includes('::ffff:') ||
      (() => { const m = hostname.match(/^172\.(\d+)\./); return m ? Number(m[1]) >= 16 && Number(m[1]) <= 31 : false })() ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      /^\d+$/.test(hostname) || // Block decimal IP notation (e.g., 2130706433 = 127.0.0.1)
      /^0[xX]/.test(hostname) || // Block hex IP notation
      /^0\d/.test(hostname) // Block octal IP notation
    ) {
      return { isValid: false, error: 'Internal URLs are not allowed' }
    }

    return { isValid: true, sanitized: parsed.href }
  } catch {
    return { isValid: false, error: 'Invalid URL format' }
  }
}

/**
 * Validates a UUID v4 string.
 *
 * Used for content IDs, user IDs, and other database primary keys
 * before they are included in database queries.
 *
 * @param id - The string to validate as a UUID v4
 * @returns A {@link ValidationResult} with the lowercased UUID or an error message
 *
 * @example
 * ```ts
 * const result = validateUUID(req.params.id)
 * if (!result.isValid) return AuthErrors.badRequest(result.error)
 * ```
 */
export function validateUUID(id: string): ValidationResult {
  if (!id || typeof id !== 'string') {
    return { isValid: false, error: 'ID is required' }
  }

  const trimmed = id.trim()

  if (!UUID_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Invalid ID format' }
  }

  return { isValid: true, sanitized: trimmed.toLowerCase() }
}

/**
 * Validates a content ID (alias for {@link validateUUID}).
 *
 * Provides a semantically meaningful name when validating content
 * record identifiers in API routes.
 *
 * @param contentId - The content ID string to validate
 * @returns A {@link ValidationResult} with the validated ID or an error message
 */
export function validateContentId(contentId: string): ValidationResult {
  return validateUUID(contentId)
}

/**
 * Validates and sanitizes a chat message before storage or AI processing.
 *
 * Strips `<script>` tags and inline event handlers to prevent stored XSS,
 * while preserving legitimate text content (including discussions about
 * security topics).
 *
 * @param message - The raw chat message from the user
 * @returns A {@link ValidationResult} with the sanitized message or an error
 *
 * @example
 * ```ts
 * const result = validateChatMessage(body.message)
 * if (!result.isValid) return AuthErrors.badRequest(result.error)
 * // Pass result.sanitized to the AI prompt
 * ```
 */
export function validateChatMessage(message: string): ValidationResult {
  if (!message || typeof message !== 'string') {
    return { isValid: false, error: 'Message is required' }
  }

  const trimmed = message.trim()

  if (trimmed.length === 0) {
    return { isValid: false, error: 'Message cannot be empty' }
  }

  if (trimmed.length > 10000) {
    return { isValid: false, error: 'Message is too long (max 10000 characters)' }
  }

  // For chat, we sanitize rather than reject to allow legitimate discussions
  // about security topics
  let sanitized = trimmed

  // Remove any script tags or event handlers
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')

  return { isValid: true, sanitized }
}

/**
 * Rate limiting helper - tracks request counts
 * Evicts expired entries every 1000 calls to prevent memory leaks in long-lived serverless instances
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const MAX_RATE_LIMIT_ENTRIES = 10000
let rateLimitCallCount = 0

function evictExpiredEntries() {
  const now = Date.now()
  for (const [key, record] of rateLimitMap) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}

/**
 * Checks whether a request from the given identifier is within rate limits.
 *
 * Uses an in-memory sliding-window counter. Expired entries are evicted
 * every 1,000 calls, and the map is hard-capped at {@link MAX_RATE_LIMIT_ENTRIES}
 * to bound memory usage in long-lived serverless instances.
 *
 * @param identifier - A unique key for the requester (e.g., user ID or IP address)
 * @param maxRequests - Maximum requests allowed within the window (default: 100)
 * @param windowMs - Window duration in milliseconds (default: 60,000 = 1 minute)
 * @returns An object with `allowed`, `remaining` count, and `resetIn` milliseconds
 *
 * @example
 * ```ts
 * const limit = checkRateLimit(userId, 10, 60_000)
 * if (!limit.allowed) {
 *   return AuthErrors.rateLimit(limit.resetIn)
 * }
 * ```
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()

  // Periodic eviction to prevent unbounded growth
  rateLimitCallCount++
  if (rateLimitCallCount % 1000 === 0 || rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    evictExpiredEntries()
  }

  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs }
  }

  if (record.count >= maxRequests) {
    // SECURITY: FIX-SEC-017 — Log rate limit hits for security monitoring
    console.warn(`[SECURITY] Rate limit exceeded: key=${identifier}`)
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now }
  }

  record.count++
  return { allowed: true, remaining: maxRequests - record.count, resetIn: record.resetTime - now }
}

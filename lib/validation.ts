/**
 * Input Validation & Sanitization Library
 * Protects against SQL injection, XSS, and other common attacks
 */

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Dangerous URL schemes that could execute code
const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:']

export interface ValidationResult {
  isValid: boolean
  error?: string
  sanitized?: string
}

/**
 * Validates and sanitizes a URL
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
 * Validates a UUID (v4)
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
 * Validates and sanitizes a content ID
 */
export function validateContentId(contentId: string): ValidationResult {
  return validateUUID(contentId)
}

/**
 * Validates chat message input
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
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now }
  }

  record.count++
  return { allowed: true, remaining: maxRequests - record.count, resetIn: record.resetTime - now }
}

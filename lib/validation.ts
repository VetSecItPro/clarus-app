/**
 * Input Validation & Sanitization Library
 * Protects against SQL injection, XSS, and other common attacks
 */

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Username: 3-20 chars, alphanumeric + underscore only
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/

// Dangerous URL schemes that could execute code
const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:']

// SQL injection patterns to detect
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION|DECLARE)\b)/i,
  /(--|;|\/\*|\*\/|@@|@)/,
  /(\bOR\b|\bAND\b)\s*[\d'"]/i,
  /['"](\s*)(OR|AND)(\s*)['"]?\s*[=><]/i,
  /(\bEXEC\b|\bEXECUTE\b)(\s+)(\bXP_)/i,
]

// XSS patterns to detect
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<link/gi,
  /<meta/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
]

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

    // Check for localhost/internal IPs (SSRF protection)
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname === '::1' ||
      hostname === '[::1]'
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
 * Validates a username
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username is required' }
  }

  const trimmed = username.trim()

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' }
  }

  if (trimmed.length > 20) {
    return { isValid: false, error: 'Username must be at most 20 characters' }
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores' }
  }

  // Check for SQL injection attempts
  if (containsSqlInjection(trimmed)) {
    return { isValid: false, error: 'Invalid characters in username' }
  }

  return { isValid: true, sanitized: trimmed }
}

/**
 * Checks if a string contains SQL injection patterns
 */
export function containsSqlInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true
    }
  }
  return false
}

/**
 * Checks if a string contains XSS patterns
 */
export function containsXss(input: string): boolean {
  if (!input || typeof input !== 'string') return false

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return true
    }
  }
  return false
}

/**
 * Sanitizes a string for safe display (HTML entity encoding)
 */
export function sanitizeForDisplay(input: string): string {
  if (!input || typeof input !== 'string') return ''

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitizes user input for database storage
 * Removes dangerous patterns while preserving legitimate content
 */
export function sanitizeInput(input: string, options: { maxLength?: number } = {}): ValidationResult {
  if (!input || typeof input !== 'string') {
    return { isValid: false, error: 'Input is required' }
  }

  const { maxLength = 10000 } = options
  let sanitized = input.trim()

  if (sanitized.length > maxLength) {
    return { isValid: false, error: `Input exceeds maximum length of ${maxLength} characters` }
  }

  // Check for SQL injection
  if (containsSqlInjection(sanitized)) {
    return { isValid: false, error: 'Input contains invalid characters' }
  }

  // Check for XSS
  if (containsXss(sanitized)) {
    // Remove XSS patterns instead of rejecting
    for (const pattern of XSS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '')
    }
  }

  return { isValid: true, sanitized }
}

/**
 * Validates and sanitizes a content ID
 */
export function validateContentId(contentId: string): ValidationResult {
  return validateUUID(contentId)
}

/**
 * Validates and sanitizes a user ID
 */
export function validateUserId(userId: string): ValidationResult {
  return validateUUID(userId)
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
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
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

/**
 * Cleans up expired rate limit records (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now()
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}

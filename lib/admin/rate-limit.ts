/**
 * Simple in-memory sliding-window rate limiter for admin API endpoints.
 *
 * Uses a Map of timestamps per key (IP or user ID). Each request
 * appends the current timestamp; expired entries are pruned on check.
 *
 * This lives in-memory on each serverless instance, so limits reset
 * when the instance cold-starts. For a single-admin app this is fine —
 * it prevents accidental runaway polling, not distributed attacks.
 */

interface RateLimitConfig {
  /** Maximum requests allowed within the window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000, // 60 requests per minute
}

/** Store: key → array of timestamps */
const store = new Map<string, number[]>()

/** Evict stale entries every 5 minutes to prevent memory growth */
const CLEANUP_INTERVAL = 5 * 60_000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - windowMs
  for (const [key, timestamps] of store.entries()) {
    const valid = timestamps.filter((t) => t > cutoff)
    if (valid.length === 0) {
      store.delete(key)
    } else {
      store.set(key, valid)
    }
  }
}

/**
 * Check if a request should be rate-limited.
 *
 * @param key - Unique identifier (e.g. user ID or IP)
 * @param config - Optional override for limits
 * @returns Object with `limited` boolean and `retryAfterMs` if limited
 */
export function checkRateLimit(
  key: string,
  config: Partial<RateLimitConfig> = {}
): { limited: boolean; remaining: number; retryAfterMs: number } {
  const { maxRequests, windowMs } = { ...DEFAULT_CONFIG, ...config }
  const now = Date.now()
  const cutoff = now - windowMs

  cleanup(windowMs)

  const timestamps = store.get(key) ?? []
  const valid = timestamps.filter((t) => t > cutoff)

  if (valid.length >= maxRequests) {
    const oldestInWindow = valid[0]
    const retryAfterMs = oldestInWindow + windowMs - now
    return { limited: true, remaining: 0, retryAfterMs }
  }

  valid.push(now)
  store.set(key, valid)

  return {
    limited: false,
    remaining: maxRequests - valid.length,
    retryAfterMs: 0,
  }
}

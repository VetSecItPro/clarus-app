/**
 * @module rate-limit
 * @description Distributed rate limiting with Upstash Redis and in-memory fallback.
 *
 * When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set,
 * rate limits are enforced via Upstash Redis — shared across all Vercel
 * serverless instances. When credentials are absent (local dev, tests),
 * an in-memory fixed-window counter is used as a seamless fallback.
 *
 * @example
 * ```ts
 * import { checkRateLimit } from "@/lib/rate-limit"
 *
 * const limit = await checkRateLimit(`chat:${userId}`, 15, 60_000)
 * if (!limit.allowed) {
 *   return NextResponse.json({ error: "Too many requests" }, { status: 429 })
 * }
 * ```
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { logger } from "./logger"

// ---------------------------------------------------------------------------
// Redis client (null when credentials aren't configured)
// ---------------------------------------------------------------------------

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

// ---------------------------------------------------------------------------
// Limiter instance cache — one per unique (maxRequests, windowMs) combo
// ---------------------------------------------------------------------------

const limiterCache = new Map<string, Ratelimit>()

function toDuration(ms: number): `${number} ms` | `${number} s` | `${number} m` | `${number} h` | `${number} d` {
  if (ms >= 86_400_000) return `${Math.round(ms / 86_400_000)} d`
  if (ms >= 3_600_000) return `${Math.round(ms / 3_600_000)} h`
  if (ms >= 60_000) return `${Math.round(ms / 60_000)} m`
  if (ms >= 1_000) return `${Math.round(ms / 1_000)} s`
  return `${ms} ms`
}

function getLimiter(maxRequests: number, windowMs: number): Ratelimit | null {
  if (!redis) return null

  const cacheKey = `${maxRequests}:${windowMs}`
  let limiter = limiterCache.get(cacheKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(maxRequests, toDuration(windowMs)),
      prefix: `rl:${cacheKey}`,
    })
    limiterCache.set(cacheKey, limiter)
  }
  return limiter
}

// ---------------------------------------------------------------------------
// In-memory fallback (used when Redis is not configured)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const MAX_ENTRIES = 10_000
let callCount = 0

function evictExpired() {
  const now = Date.now()
  for (const [key, record] of rateLimitMap) {
    if (now > record.resetTime) rateLimitMap.delete(key)
  }
}

function checkInMemory(
  identifier: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()

  callCount++
  if (callCount % 1000 === 0 || rateLimitMap.size > MAX_ENTRIES) evictExpired()

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Checks whether a request from the given identifier is within rate limits.
 *
 * Uses Upstash Redis when configured (distributed across all serverless
 * instances), or falls back to an in-memory fixed-window counter.
 *
 * @param identifier - A unique key for the requester (e.g., `chat:${userId}`)
 * @param maxRequests - Maximum requests allowed within the window (default: 100)
 * @param windowMs - Window duration in milliseconds (default: 60,000 = 1 minute)
 * @returns An object with `allowed`, `remaining` count, and `resetIn` milliseconds
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60_000,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const limiter = getLimiter(maxRequests, windowMs)

  if (limiter) {
    try {
      const result = await limiter.limit(identifier)
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetIn: Math.max(0, result.reset - Date.now()),
      }
    } catch (err) {
      logger.warn("Redis rate limit failed, falling back to in-memory", err)
      return checkInMemory(identifier, maxRequests, windowMs)
    }
  }

  return checkInMemory(identifier, maxRequests, windowMs)
}

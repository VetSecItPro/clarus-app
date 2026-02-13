/**
 * @module logger
 * @description Structured logger with level-based filtering for server-side code.
 *
 * In production (`NODE_ENV=production`), only `warn` and `error` are emitted —
 * suppressing noisy `debug` and `info` output. Override with the `LOG_LEVEL`
 * environment variable (e.g., `LOG_LEVEL=debug` for verbose output in staging).
 *
 * Uses native `console.*` under the hood so Vercel's log pipeline captures
 * everything without additional transports or dependencies.
 *
 * @example
 * ```ts
 * import { logger } from "@/lib/logger"
 *
 * logger.info("Processing content", contentId)
 * logger.warn("Rate limit approaching", { remaining: 5 })
 * logger.error("Pipeline failed", error)
 * ```
 */

type LogLevel = "debug" | "info" | "warn" | "error"

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const configuredLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ??
  (process.env.NODE_ENV === "production" ? "warn" : "debug")

const threshold = LOG_LEVELS[configuredLevel] ?? LOG_LEVELS.debug

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= threshold
}

export const logger = {
  debug: (...args: unknown[]): void => {
    if (shouldLog("debug")) console.debug("[DEBUG]", ...args)
  },
  info: (...args: unknown[]): void => {
    if (shouldLog("info")) console.info("[INFO]", ...args)
  },
  warn: (...args: unknown[]): void => {
    if (shouldLog("warn")) console.warn("[WARN]", ...args)
  },
  error: (...args: unknown[]): void => {
    if (shouldLog("error")) console.error("[ERROR]", ...args)
  },
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ---------------------------------------------------------------------------
// We need to test the logger with different LOG_LEVEL / NODE_ENV values.
// Because the module reads process.env at import time and caches the
// threshold, we must use `vi.resetModules()` + dynamic `import()` to get a
// fresh module with each environment configuration.
// ---------------------------------------------------------------------------

describe("logger", () => {
  let debugSpy: ReturnType<typeof vi.spyOn>
  let infoSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  // Helper: import a fresh logger with specified env vars
  async function importLogger(env: Record<string, string | undefined> = {}) {
    // Save originals for the keys we'll modify
    const saved: Record<string, string | undefined> = {}
    for (const key of Object.keys(env)) {
      saved[key] = process.env[key]
    }
    // Apply env overrides (delete keys set to undefined)
    for (const [key, val] of Object.entries(env)) {
      if (val === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = val
      }
    }
    // Reset module cache so logger re-evaluates process.env
    vi.resetModules()
    const mod = await import("@/lib/logger")
    // Restore original env after import (threshold is already cached)
    for (const [key, val] of Object.entries(saved)) {
      if (val === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = val
      }
    }
    return mod.logger
  }

  // =========================================================================
  // Default level (test env, NODE_ENV=test → defaults to "debug")
  // =========================================================================

  describe("default level (debug in non-production)", () => {
    it("logger.debug calls console.debug", async () => {
      const logger = await importLogger({ NODE_ENV: "test" })
      logger.debug("test message")
      expect(debugSpy).toHaveBeenCalledWith("[DEBUG]", "test message")
    })

    it("logger.info calls console.info", async () => {
      const logger = await importLogger({ NODE_ENV: "test" })
      logger.info("info message")
      expect(infoSpy).toHaveBeenCalledWith("[INFO]", "info message")
    })

    it("logger.warn calls console.warn", async () => {
      const logger = await importLogger({ NODE_ENV: "test" })
      logger.warn("warning")
      expect(warnSpy).toHaveBeenCalledWith("[WARN]", "warning")
    })

    it("logger.error calls console.error", async () => {
      const logger = await importLogger({ NODE_ENV: "test" })
      logger.error("error")
      expect(errorSpy).toHaveBeenCalledWith("[ERROR]", "error")
    })
  })

  // =========================================================================
  // Multiple arguments
  // =========================================================================

  describe("multiple arguments", () => {
    it("passes multiple args through to console", async () => {
      const logger = await importLogger({ NODE_ENV: "test" })
      const obj = { foo: "bar" }
      logger.info("context", obj, 42)
      expect(infoSpy).toHaveBeenCalledWith("[INFO]", "context", obj, 42)
    })
  })

  // =========================================================================
  // Level filtering — LOG_LEVEL=warn
  // =========================================================================

  describe("LOG_LEVEL=warn suppresses debug and info", () => {
    it("suppresses debug when LOG_LEVEL=warn", async () => {
      const logger = await importLogger({ LOG_LEVEL: "warn" })
      logger.debug("should not appear")
      expect(debugSpy).not.toHaveBeenCalled()
    })

    it("suppresses info when LOG_LEVEL=warn", async () => {
      const logger = await importLogger({ LOG_LEVEL: "warn" })
      logger.info("should not appear")
      expect(infoSpy).not.toHaveBeenCalled()
    })

    it("allows warn when LOG_LEVEL=warn", async () => {
      const logger = await importLogger({ LOG_LEVEL: "warn" })
      logger.warn("visible")
      expect(warnSpy).toHaveBeenCalledWith("[WARN]", "visible")
    })

    it("allows error when LOG_LEVEL=warn", async () => {
      const logger = await importLogger({ LOG_LEVEL: "warn" })
      logger.error("visible")
      expect(errorSpy).toHaveBeenCalledWith("[ERROR]", "visible")
    })
  })

  // =========================================================================
  // Level filtering — LOG_LEVEL=error
  // =========================================================================

  describe("LOG_LEVEL=error suppresses debug, info, and warn", () => {
    it("suppresses debug when LOG_LEVEL=error", async () => {
      const logger = await importLogger({ LOG_LEVEL: "error" })
      logger.debug("hidden")
      expect(debugSpy).not.toHaveBeenCalled()
    })

    it("suppresses info when LOG_LEVEL=error", async () => {
      const logger = await importLogger({ LOG_LEVEL: "error" })
      logger.info("hidden")
      expect(infoSpy).not.toHaveBeenCalled()
    })

    it("suppresses warn when LOG_LEVEL=error", async () => {
      const logger = await importLogger({ LOG_LEVEL: "error" })
      logger.warn("hidden")
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it("allows error when LOG_LEVEL=error", async () => {
      const logger = await importLogger({ LOG_LEVEL: "error" })
      logger.error("critical")
      expect(errorSpy).toHaveBeenCalledWith("[ERROR]", "critical")
    })
  })

  // =========================================================================
  // Level filtering — LOG_LEVEL=info
  // =========================================================================

  describe("LOG_LEVEL=info suppresses only debug", () => {
    it("suppresses debug when LOG_LEVEL=info", async () => {
      const logger = await importLogger({ LOG_LEVEL: "info" })
      logger.debug("hidden")
      expect(debugSpy).not.toHaveBeenCalled()
    })

    it("allows info when LOG_LEVEL=info", async () => {
      const logger = await importLogger({ LOG_LEVEL: "info" })
      logger.info("visible")
      expect(infoSpy).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Production defaults
  // =========================================================================

  describe("production defaults to warn level", () => {
    it("suppresses debug in production (no LOG_LEVEL override)", async () => {
      const logger = await importLogger({ NODE_ENV: "production", LOG_LEVEL: undefined })
      logger.debug("hidden")
      expect(debugSpy).not.toHaveBeenCalled()
    })

    it("suppresses info in production (no LOG_LEVEL override)", async () => {
      const logger = await importLogger({ NODE_ENV: "production", LOG_LEVEL: undefined })
      logger.info("hidden")
      expect(infoSpy).not.toHaveBeenCalled()
    })

    it("allows warn in production", async () => {
      const logger = await importLogger({ NODE_ENV: "production", LOG_LEVEL: undefined })
      logger.warn("visible")
      expect(warnSpy).toHaveBeenCalled()
    })

    it("allows error in production", async () => {
      const logger = await importLogger({ NODE_ENV: "production", LOG_LEVEL: undefined })
      logger.error("visible")
      expect(errorSpy).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Prefix formatting
  // =========================================================================

  describe("log prefix formatting", () => {
    it("debug output starts with [DEBUG]", async () => {
      const logger = await importLogger({ NODE_ENV: "test" })
      logger.debug("msg")
      expect(debugSpy.mock.calls[0][0]).toBe("[DEBUG]")
    })

    it("info output starts with [INFO]", async () => {
      const logger = await importLogger({ NODE_ENV: "test" })
      logger.info("msg")
      expect(infoSpy.mock.calls[0][0]).toBe("[INFO]")
    })

    it("warn output starts with [WARN]", async () => {
      const logger = await importLogger({ NODE_ENV: "test" })
      logger.warn("msg")
      expect(warnSpy.mock.calls[0][0]).toBe("[WARN]")
    })

    it("error output starts with [ERROR]", async () => {
      const logger = await importLogger({ NODE_ENV: "test" })
      logger.error("msg")
      expect(errorSpy.mock.calls[0][0]).toBe("[ERROR]")
    })
  })
})

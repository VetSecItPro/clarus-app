import { describe, it, expect } from "vitest"
import {
  TIER_LIMITS,
  TIER_FEATURES,
  getLimitForField,
  isAtLimit,
  getCurrentPeriod,
  normalizeTier,
} from "@/lib/tier-limits"
import type { UserTier } from "@/types/database.types"

// =============================================================================
// TIER_LIMITS
// =============================================================================

describe("TIER_LIMITS", () => {
  const tiers: UserTier[] = ["free", "starter", "pro", "day_pass"]

  it("defines limits for all four tiers", () => {
    for (const tier of tiers) {
      expect(TIER_LIMITS[tier]).toBeDefined()
    }
  })

  it("free tier has correct analysis limit", () => {
    expect(TIER_LIMITS.free.analyses).toBe(5)
  })

  it("starter tier has correct analysis limit", () => {
    expect(TIER_LIMITS.starter.analyses).toBe(50)
  })

  it("pro tier has correct analysis limit", () => {
    expect(TIER_LIMITS.pro.analyses).toBe(150)
  })

  it("day_pass tier has correct analysis limit", () => {
    expect(TIER_LIMITS.day_pass.analyses).toBe(15)
  })

  it("free tier has zero share links and exports", () => {
    expect(TIER_LIMITS.free.shareLinks).toBe(0)
    expect(TIER_LIMITS.free.exports).toBe(0)
  })

  it("free tier has zero podcast analyses", () => {
    expect(TIER_LIMITS.free.podcastAnalyses).toBe(0)
  })

  it("pro tier has highest chat message limits", () => {
    expect(TIER_LIMITS.pro.chatMessagesMonthly).toBeGreaterThan(TIER_LIMITS.starter.chatMessagesMonthly)
    expect(TIER_LIMITS.pro.chatMessagesPerContent).toBeGreaterThan(TIER_LIMITS.starter.chatMessagesPerContent)
  })

  it("all limits are positive numbers or zero", () => {
    for (const tier of tiers) {
      const limits = TIER_LIMITS[tier]
      for (const [key, value] of Object.entries(limits)) {
        expect(value, `${tier}.${key}`).toBeGreaterThanOrEqual(0)
        expect(typeof value).toBe("number")
      }
    }
  })
})

// =============================================================================
// getLimitForField
// =============================================================================

describe("getLimitForField", () => {
  it("returns correct limit for free tier analyses", () => {
    expect(getLimitForField("free", "analyses_count")).toBe(5)
  })

  it("returns correct limit for pro tier chat messages", () => {
    expect(getLimitForField("pro", "chat_messages_count")).toBe(1000)
  })

  it("returns correct limit for starter bookmarks", () => {
    expect(getLimitForField("starter", "bookmarks_count")).toBe(50)
  })

  it("returns correct limit for day_pass exports", () => {
    expect(getLimitForField("day_pass", "exports_count")).toBe(10)
  })

  it("returns correct limit for pro podcast analyses", () => {
    expect(getLimitForField("pro", "podcast_analyses_count")).toBe(30)
  })

  it("returns correct limit for free share links (zero)", () => {
    expect(getLimitForField("free", "share_links_count")).toBe(0)
  })
})

// =============================================================================
// isAtLimit
// =============================================================================

describe("isAtLimit", () => {
  it("returns false when count is below limit", () => {
    expect(isAtLimit("free", "analyses_count", 3)).toBe(false)
  })

  it("returns true when count equals limit", () => {
    expect(isAtLimit("free", "analyses_count", 5)).toBe(true)
  })

  it("returns true when count exceeds limit", () => {
    expect(isAtLimit("free", "analyses_count", 10)).toBe(true)
  })

  it("returns true immediately for zero-limited features", () => {
    // Free tier has 0 share links, so even count=0 should be at limit
    expect(isAtLimit("free", "share_links_count", 0)).toBe(true)
  })

  it("returns false at 0 count for non-zero limited features", () => {
    expect(isAtLimit("pro", "analyses_count", 0)).toBe(false)
  })
})

// =============================================================================
// getCurrentPeriod
// =============================================================================

describe("getCurrentPeriod", () => {
  it("returns a YYYY-MM formatted string", () => {
    const period = getCurrentPeriod()
    expect(period).toMatch(/^\d{4}-\d{2}$/)
  })

  it("matches the current UTC year and month", () => {
    const now = new Date()
    const expectedYear = now.getUTCFullYear()
    const expectedMonth = String(now.getUTCMonth() + 1).padStart(2, "0")
    expect(getCurrentPeriod()).toBe(`${expectedYear}-${expectedMonth}`)
  })
})

// =============================================================================
// normalizeTier
// =============================================================================

describe("normalizeTier", () => {
  it("returns 'free' for null tier", () => {
    expect(normalizeTier(null)).toBe("free")
  })

  it("returns 'free' for undefined tier", () => {
    expect(normalizeTier(undefined)).toBe("free")
  })

  it("returns 'free' for empty string", () => {
    expect(normalizeTier("")).toBe("free")
  })

  it("returns 'free' for unknown tier strings", () => {
    expect(normalizeTier("enterprise")).toBe("free")
    expect(normalizeTier("premium")).toBe("free")
    expect(normalizeTier("basic")).toBe("free")
  })

  it("returns 'starter' for starter tier", () => {
    expect(normalizeTier("starter")).toBe("starter")
  })

  it("returns 'pro' for pro tier", () => {
    expect(normalizeTier("pro")).toBe("pro")
  })

  it("returns 'day_pass' when day pass is not expired", () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    expect(normalizeTier("day_pass", tomorrow)).toBe("day_pass")
  })

  it("returns 'free' when day pass is expired", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    expect(normalizeTier("day_pass", yesterday)).toBe("free")
  })

  it("returns 'free' when day pass has no expiration date", () => {
    expect(normalizeTier("day_pass", null)).toBe("free")
    expect(normalizeTier("day_pass", undefined)).toBe("free")
  })

  it("does not check expiration for starter/pro tiers", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    expect(normalizeTier("starter", yesterday)).toBe("starter")
    expect(normalizeTier("pro", yesterday)).toBe("pro")
  })
})

// =============================================================================
// TIER_FEATURES
// =============================================================================

describe("TIER_FEATURES", () => {
  it("free tier has all features disabled", () => {
    const features = TIER_FEATURES.free
    expect(features.shareLinks).toBe(false)
    expect(features.exports).toBe(false)
    expect(features.weeklyDigest).toBe(false)
    expect(features.claimTracking).toBe(false)
    expect(features.priorityProcessing).toBe(false)
    expect(features.multiLanguageAnalysis).toBe(false)
  })

  it("starter tier has sharing and exports enabled", () => {
    expect(TIER_FEATURES.starter.shareLinks).toBe(true)
    expect(TIER_FEATURES.starter.exports).toBe(true)
  })

  it("starter tier has weekly digest but no priority processing", () => {
    expect(TIER_FEATURES.starter.weeklyDigest).toBe(true)
    expect(TIER_FEATURES.starter.priorityProcessing).toBe(false)
  })

  it("pro tier has all features enabled", () => {
    const features = TIER_FEATURES.pro
    expect(features.shareLinks).toBe(true)
    expect(features.exports).toBe(true)
    expect(features.weeklyDigest).toBe(true)
    expect(features.claimTracking).toBe(true)
    expect(features.priorityProcessing).toBe(true)
    expect(features.multiLanguageAnalysis).toBe(true)
  })

  it("day_pass has no claim tracking and no weekly digest", () => {
    expect(TIER_FEATURES.day_pass.claimTracking).toBe(false)
    expect(TIER_FEATURES.day_pass.weeklyDigest).toBe(false)
  })

  it("starter tier has no claim tracking", () => {
    expect(TIER_FEATURES.starter.claimTracking).toBe(false)
  })

  it("day_pass has no priority processing", () => {
    expect(TIER_FEATURES.day_pass.priorityProcessing).toBe(false)
  })
})

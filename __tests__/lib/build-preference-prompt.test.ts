import { describe, it, expect } from "vitest"
import { buildPreferenceBlock } from "@/lib/build-preference-prompt"
import type { UserAnalysisPreferences } from "@/lib/build-preference-prompt"

// =============================================================================
// buildPreferenceBlock — Null / inactive
// =============================================================================

describe("buildPreferenceBlock — null and inactive", () => {
  it("returns empty string for null preferences", () => {
    expect(buildPreferenceBlock(null)).toBe("")
  })

  it("returns empty string when is_active is false", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "learn",
      expertise_level: "expert",
      focus_areas: ["depth"],
      is_active: false,
    }
    expect(buildPreferenceBlock(prefs)).toBe("")
  })
})

// =============================================================================
// buildPreferenceBlock — Default values (skipped)
// =============================================================================

describe("buildPreferenceBlock — default values", () => {
  it("returns empty string for default preferences (apply + intermediate + [takeaways, accuracy])", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "apply",
      expertise_level: "intermediate",
      focus_areas: ["takeaways", "accuracy"],
      is_active: true,
    }
    expect(buildPreferenceBlock(prefs)).toBe("")
  })

  it("returns empty string for defaults regardless of focus_areas order", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "apply",
      expertise_level: "intermediate",
      focus_areas: ["accuracy", "takeaways"],
      is_active: true,
    }
    expect(buildPreferenceBlock(prefs)).toBe("")
  })
})

// =============================================================================
// buildPreferenceBlock — Analysis modes
// =============================================================================

describe("buildPreferenceBlock — analysis modes", () => {
  it("includes LEARN mode label and directive", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "learn",
      expertise_level: "intermediate",
      focus_areas: ["depth"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("LEARN")
    expect(result).toContain("understand this content deeply")
  })

  it("includes EVALUATE mode label and directive", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "evaluate",
      expertise_level: "intermediate",
      focus_areas: ["accuracy"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("EVALUATE")
    expect(result).toContain("critically")
  })

  it("includes DISCOVER mode label and directive", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "discover",
      expertise_level: "intermediate",
      focus_areas: ["novelty"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("DISCOVER")
    expect(result).toContain("accessible overview")
  })

  it("includes CREATE mode label and directive", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "create",
      expertise_level: "intermediate",
      focus_areas: ["depth"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("CREATE")
    expect(result).toContain("content creator")
  })

  it("includes APPLY mode label and directive when not at defaults", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "apply",
      expertise_level: "expert",
      focus_areas: ["efficiency"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("APPLY")
    expect(result).toContain("practical, actionable")
  })
})

// =============================================================================
// buildPreferenceBlock — Expertise levels
// =============================================================================

describe("buildPreferenceBlock — expertise levels", () => {
  it("includes BEGINNER label and directive", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "learn",
      expertise_level: "beginner",
      focus_areas: ["takeaways"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("BEGINNER")
    expect(result).toContain("extra context")
  })

  it("includes INTERMEDIATE label and directive", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "learn",
      expertise_level: "intermediate",
      focus_areas: ["depth"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("INTERMEDIATE")
    expect(result).toContain("Standard depth")
  })

  it("includes EXPERT label and directive", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "learn",
      expertise_level: "expert",
      focus_areas: ["depth"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("EXPERT")
    expect(result).toContain("Skip foundational")
  })
})

// =============================================================================
// buildPreferenceBlock — Focus areas
// =============================================================================

describe("buildPreferenceBlock — focus areas", () => {
  it("includes focus area labels in output", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "learn",
      expertise_level: "intermediate",
      focus_areas: ["accuracy", "depth"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("ACCURACY")
    expect(result).toContain("DEPTH")
  })

  it("includes focus area directives", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "learn",
      expertise_level: "intermediate",
      focus_areas: ["bias"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("BIAS")
    expect(result).toContain("author perspective")
  })

  it("handles multiple focus areas joined with 'and'", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "evaluate",
      expertise_level: "expert",
      focus_areas: ["accuracy", "novelty"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("ACCURACY")
    expect(result).toContain("NOVELTY")
    expect(result).toContain(" and ")
  })

  it("handles empty focus areas without error", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "learn",
      expertise_level: "expert",
      focus_areas: [],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).not.toContain("Priorities:")
    // Should still have mode and expertise
    expect(result).toContain("LEARN")
    expect(result).toContain("EXPERT")
  })

  it("filters out unknown focus areas gracefully", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "learn",
      expertise_level: "intermediate",
      focus_areas: ["accuracy", "unknown_focus" as string],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("ACCURACY")
    // unknown_focus should be filtered out by .filter(Boolean)
  })
})

// =============================================================================
// buildPreferenceBlock — Output structure
// =============================================================================

describe("buildPreferenceBlock — output structure", () => {
  it("starts with a newline", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "learn",
      expertise_level: "expert",
      focus_areas: ["depth"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result.startsWith("\n")).toBe(true)
  })

  it("ends with a newline", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "learn",
      expertise_level: "expert",
      focus_areas: ["depth"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result.endsWith("\n")).toBe(true)
  })

  it("contains USER PREFERENCES header", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "discover",
      expertise_level: "beginner",
      focus_areas: ["novelty"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("USER PREFERENCES")
  })

  it("contains scoring instruction tied to mode", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "evaluate",
      expertise_level: "intermediate",
      focus_areas: ["accuracy"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("signal_noise_score")
    expect(result).toContain("credibility")
  })

  it("contains Analysis mode label", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "create",
      expertise_level: "expert",
      focus_areas: ["depth"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("Analysis mode: CREATE")
  })

  it("contains Expertise label", () => {
    const prefs: UserAnalysisPreferences = {
      analysis_mode: "create",
      expertise_level: "beginner",
      focus_areas: ["depth"],
      is_active: true,
    }
    const result = buildPreferenceBlock(prefs)
    expect(result).toContain("Expertise: BEGINNER")
  })
})

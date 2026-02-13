import { describe, it, expect } from "vitest"
import {
  MODE_OPTIONS,
  getModeOption,
  type AnalysisMode,
  type ModeOption,
} from "@/lib/analysis-modes"

// ---------------------------------------------------------------------------
// MODE_OPTIONS array
// ---------------------------------------------------------------------------

describe("MODE_OPTIONS", () => {
  it("contains exactly 5 mode options", () => {
    expect(MODE_OPTIONS).toHaveLength(5)
  })

  it("contains all expected mode IDs", () => {
    const ids = MODE_OPTIONS.map((m) => m.id)
    expect(ids).toContain("learn")
    expect(ids).toContain("apply")
    expect(ids).toContain("evaluate")
    expect(ids).toContain("discover")
    expect(ids).toContain("create")
  })

  it("has unique mode IDs (no duplicates)", () => {
    const ids = MODE_OPTIONS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("every mode has a non-empty label", () => {
    for (const mode of MODE_OPTIONS) {
      expect(mode.label).toBeTruthy()
      expect(typeof mode.label).toBe("string")
      expect(mode.label.length).toBeGreaterThan(0)
    }
  })

  it("every mode has a non-empty description", () => {
    for (const mode of MODE_OPTIONS) {
      expect(mode.description).toBeTruthy()
      expect(typeof mode.description).toBe("string")
      expect(mode.description.length).toBeGreaterThan(0)
    }
  })

  it("every mode has an icon (React component)", () => {
    for (const mode of MODE_OPTIONS) {
      // Lucide icons are React forwardRef objects, not plain functions
      expect(mode.icon).toBeTruthy()
    }
  })

  // Verify specific mode properties

  it("learn mode has correct label and description", () => {
    const learn = MODE_OPTIONS.find((m) => m.id === "learn")!
    expect(learn.label).toBe("Learn")
    expect(learn.description).toBe("Help me understand this")
  })

  it("apply mode has correct label and description", () => {
    const apply = MODE_OPTIONS.find((m) => m.id === "apply")!
    expect(apply.label).toBe("Apply")
    expect(apply.description).toBe("Help me use this")
  })

  it("evaluate mode has correct label and description", () => {
    const evaluate = MODE_OPTIONS.find((m) => m.id === "evaluate")!
    expect(evaluate.label).toBe("Evaluate")
    expect(evaluate.description).toBe("Help me assess this critically")
  })

  it("discover mode has correct label and description", () => {
    const discover = MODE_OPTIONS.find((m) => m.id === "discover")!
    expect(discover.label).toBe("Discover")
    expect(discover.description).toBe("Give me the highlights")
  })

  it("create mode has correct label and description", () => {
    const create = MODE_OPTIONS.find((m) => m.id === "create")!
    expect(create.label).toBe("Create")
    expect(create.description).toBe("Help me learn as a creator")
  })

  it("modes are in the expected order", () => {
    const ids = MODE_OPTIONS.map((m) => m.id)
    expect(ids).toEqual(["learn", "apply", "evaluate", "discover", "create"])
  })
})

// ---------------------------------------------------------------------------
// getModeOption
// ---------------------------------------------------------------------------

describe("getModeOption", () => {
  it("returns the correct option for 'learn'", () => {
    const result = getModeOption("learn")
    expect(result.id).toBe("learn")
    expect(result.label).toBe("Learn")
  })

  it("returns the correct option for 'apply'", () => {
    const result = getModeOption("apply")
    expect(result.id).toBe("apply")
    expect(result.label).toBe("Apply")
  })

  it("returns the correct option for 'evaluate'", () => {
    const result = getModeOption("evaluate")
    expect(result.id).toBe("evaluate")
    expect(result.label).toBe("Evaluate")
  })

  it("returns the correct option for 'discover'", () => {
    const result = getModeOption("discover")
    expect(result.id).toBe("discover")
    expect(result.label).toBe("Discover")
  })

  it("returns the correct option for 'create'", () => {
    const result = getModeOption("create")
    expect(result.id).toBe("create")
    expect(result.label).toBe("Create")
  })

  it("falls back to 'apply' for an invalid mode ID", () => {
    // Force-cast an invalid string to AnalysisMode to test the fallback
    const result = getModeOption("nonexistent" as AnalysisMode)
    expect(result.id).toBe("apply")
    expect(result.label).toBe("Apply")
  })

  it("returns a valid ModeOption shape for every valid mode", () => {
    const allModes: AnalysisMode[] = ["learn", "apply", "evaluate", "discover", "create"]
    for (const mode of allModes) {
      const result = getModeOption(mode)
      expect(result).toHaveProperty("id")
      expect(result).toHaveProperty("label")
      expect(result).toHaveProperty("description")
      expect(result).toHaveProperty("icon")
    }
  })

  it("returns the same object reference as in MODE_OPTIONS", () => {
    for (const mode of MODE_OPTIONS) {
      const result = getModeOption(mode.id)
      expect(result).toBe(mode)
    }
  })
})

// ---------------------------------------------------------------------------
// Type coverage — compile-time only, but verifying exhaustive switch-like use
// ---------------------------------------------------------------------------

describe("AnalysisMode type", () => {
  it("all 5 analysis modes are assignable to AnalysisMode", () => {
    // If any of these fail to compile, the type is wrong
    const modes: AnalysisMode[] = ["learn", "apply", "evaluate", "discover", "create"]
    expect(modes).toHaveLength(5)
  })

  it("ModeOption interface has required properties", () => {
    const option: ModeOption = MODE_OPTIONS[0]
    expect(option.id).toBeDefined()
    expect(option.label).toBeDefined()
    expect(option.description).toBeDefined()
    expect(option.icon).toBeDefined()
  })
})

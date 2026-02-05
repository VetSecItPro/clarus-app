import { describe, it, expect } from "vitest"
import {
  SUPPORTED_LANGUAGES,
  isValidLanguage,
  getLanguageConfig,
  getLanguageDirective,
  LANGUAGE_STORAGE_KEY,
  type AnalysisLanguage,
} from "@/lib/languages"

// =============================================================================
// SUPPORTED_LANGUAGES
// =============================================================================

describe("SUPPORTED_LANGUAGES", () => {
  it("contains 11 languages", () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(11)
  })

  it("has English as the first entry", () => {
    expect(SUPPORTED_LANGUAGES[0].code).toBe("en")
    expect(SUPPORTED_LANGUAGES[0].name).toBe("English")
  })

  it("has all expected language codes", () => {
    const codes = SUPPORTED_LANGUAGES.map(l => l.code)
    expect(codes).toContain("en")
    expect(codes).toContain("ar")
    expect(codes).toContain("es")
    expect(codes).toContain("fr")
    expect(codes).toContain("de")
    expect(codes).toContain("pt")
    expect(codes).toContain("ja")
    expect(codes).toContain("ko")
    expect(codes).toContain("zh")
    expect(codes).toContain("it")
    expect(codes).toContain("nl")
  })

  it("has unique codes for all languages", () => {
    const codes = SUPPORTED_LANGUAGES.map(l => l.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it("every language has required fields", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang.code).toBeTruthy()
      expect(lang.name).toBeTruthy()
      expect(lang.nativeName).toBeTruthy()
      expect(lang.flag).toBeTruthy()
      expect(["ltr", "rtl"]).toContain(lang.dir)
    }
  })

  it("only Arabic is RTL", () => {
    const rtlLanguages = SUPPORTED_LANGUAGES.filter(l => l.dir === "rtl")
    expect(rtlLanguages).toHaveLength(1)
    expect(rtlLanguages[0].code).toBe("ar")
  })

  it("all non-Arabic languages are LTR", () => {
    const nonArabic = SUPPORTED_LANGUAGES.filter(l => l.code !== "ar")
    for (const lang of nonArabic) {
      expect(lang.dir).toBe("ltr")
    }
  })
})

// =============================================================================
// isValidLanguage
// =============================================================================

describe("isValidLanguage", () => {
  it("returns true for all supported language codes", () => {
    const codes: AnalysisLanguage[] = ["en", "ar", "es", "fr", "de", "pt", "ja", "ko", "zh", "it", "nl"]
    for (const code of codes) {
      expect(isValidLanguage(code)).toBe(true)
    }
  })

  it("returns false for invalid language codes", () => {
    expect(isValidLanguage("xx")).toBe(false)
    expect(isValidLanguage("")).toBe(false)
    expect(isValidLanguage("english")).toBe(false)
    expect(isValidLanguage("EN")).toBe(false) // case-sensitive
  })

  it("returns false for similar but unsupported codes", () => {
    expect(isValidLanguage("ru")).toBe(false) // Russian not supported
    expect(isValidLanguage("hi")).toBe(false) // Hindi not supported
    expect(isValidLanguage("sv")).toBe(false) // Swedish not supported
  })
})

// =============================================================================
// getLanguageConfig
// =============================================================================

describe("getLanguageConfig", () => {
  it("returns correct config for English", () => {
    const config = getLanguageConfig("en")
    expect(config.code).toBe("en")
    expect(config.name).toBe("English")
    expect(config.dir).toBe("ltr")
  })

  it("returns correct config for Arabic", () => {
    const config = getLanguageConfig("ar")
    expect(config.code).toBe("ar")
    expect(config.name).toBe("Arabic")
    expect(config.dir).toBe("rtl")
  })

  it("returns correct config for Japanese", () => {
    const config = getLanguageConfig("ja")
    expect(config.code).toBe("ja")
    expect(config.name).toBe("Japanese")
  })

  it("falls back to English for invalid code", () => {
    const config = getLanguageConfig("invalid")
    expect(config.code).toBe("en")
    expect(config.name).toBe("English")
  })

  it("falls back to English for empty string", () => {
    const config = getLanguageConfig("")
    expect(config.code).toBe("en")
  })
})

// =============================================================================
// getLanguageDirective
// =============================================================================

describe("getLanguageDirective", () => {
  it("returns simple English directive for 'en'", () => {
    const directive = getLanguageDirective("en")
    expect(directive).toBe("Write your analysis in English.")
  })

  it("returns detailed directive for non-English languages", () => {
    const directive = getLanguageDirective("es")
    expect(directive).toContain("Spanish")
    expect(directive).toContain("ENTIRE")
    expect(directive).toContain("headers")
    expect(directive).toContain("bullets")
  })

  it("includes native name for non-English languages", () => {
    const directive = getLanguageDirective("fr")
    expect(directive).toContain("French")
    // Should contain the native name from the config
    const config = getLanguageConfig("fr")
    expect(directive).toContain(config.nativeName)
  })

  it("mentions proper nouns exception", () => {
    const directive = getLanguageDirective("de")
    expect(directive).toContain("proper nouns")
  })

  it("generates valid directives for all supported languages", () => {
    const codes: AnalysisLanguage[] = ["en", "ar", "es", "fr", "de", "pt", "ja", "ko", "zh", "it", "nl"]
    for (const code of codes) {
      const directive = getLanguageDirective(code)
      expect(directive.length).toBeGreaterThan(0)
      if (code === "en") {
        expect(directive).toContain("English")
      } else {
        expect(directive).toContain("ENTIRE")
      }
    }
  })
})

// =============================================================================
// LANGUAGE_STORAGE_KEY
// =============================================================================

describe("LANGUAGE_STORAGE_KEY", () => {
  it("is a non-empty string", () => {
    expect(typeof LANGUAGE_STORAGE_KEY).toBe("string")
    expect(LANGUAGE_STORAGE_KEY.length).toBeGreaterThan(0)
  })

  it("has the expected value", () => {
    expect(LANGUAGE_STORAGE_KEY).toBe("clarus-analysis-language")
  })
})

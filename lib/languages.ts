/**
 * Multi-language analysis support for Clarus.
 * Defines supported languages, types, and prompt directive generators.
 */

export type AnalysisLanguage =
  | "en" | "ar" | "es" | "fr" | "de"
  | "pt" | "ja" | "ko" | "zh" | "it" | "nl"

export interface LanguageConfig {
  code: AnalysisLanguage
  name: string
  nativeName: string
  flag: string
  dir: "ltr" | "rtl"
}

/** All supported languages, ordered for dropdown display. English first, then alphabetical. */
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: "en", name: "English",    nativeName: "English",    flag: "\u{1F1FA}\u{1F1F8}", dir: "ltr" },
  { code: "ar", name: "Arabic",     nativeName: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", flag: "\u{1F1F8}\u{1F1E6}", dir: "rtl" },
  { code: "es", name: "Spanish",    nativeName: "Espa\u00F1ol",    flag: "\u{1F1EA}\u{1F1F8}", dir: "ltr" },
  { code: "fr", name: "French",     nativeName: "Fran\u00E7ais",   flag: "\u{1F1EB}\u{1F1F7}", dir: "ltr" },
  { code: "de", name: "German",     nativeName: "Deutsch",    flag: "\u{1F1E9}\u{1F1EA}", dir: "ltr" },
  { code: "pt", name: "Portuguese", nativeName: "Portugu\u00EAs", flag: "\u{1F1E7}\u{1F1F7}", dir: "ltr" },
  { code: "ja", name: "Japanese",   nativeName: "\u65E5\u672C\u8A9E",     flag: "\u{1F1EF}\u{1F1F5}", dir: "ltr" },
  { code: "ko", name: "Korean",     nativeName: "\uD55C\uAD6D\uC5B4",     flag: "\u{1F1F0}\u{1F1F7}", dir: "ltr" },
  { code: "zh", name: "Chinese",    nativeName: "\u4E2D\u6587",       flag: "\u{1F1E8}\u{1F1F3}", dir: "ltr" },
  { code: "it", name: "Italian",    nativeName: "Italiano",   flag: "\u{1F1EE}\u{1F1F9}", dir: "ltr" },
  { code: "nl", name: "Dutch",      nativeName: "Nederlands", flag: "\u{1F1F3}\u{1F1F1}", dir: "ltr" },
]

/** Language code set for fast validation */
const LANGUAGE_CODES = new Set<string>(SUPPORTED_LANGUAGES.map(l => l.code))

/** Check if a string is a valid AnalysisLanguage code */
export function isValidLanguage(code: string): code is AnalysisLanguage {
  return LANGUAGE_CODES.has(code)
}

/** Get config for a language code. Returns English config if code is invalid. */
export function getLanguageConfig(code: string): LanguageConfig {
  return SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0]
}

/**
 * Generate the prompt directive for a given language code.
 * This string replaces {{LANGUAGE}} in analysis prompt templates.
 */
export function getLanguageDirective(code: AnalysisLanguage): string {
  if (code === "en") {
    return "Write your analysis in English."
  }
  const config = getLanguageConfig(code)
  return `Write your ENTIRE analysis output in ${config.name} (${config.nativeName}). ALL headers, bullets, descriptions, and prose MUST be in ${config.name}. Do not mix languages except for proper nouns and technical terms.`
}

/** localStorage key for persisting last-used language */
export const LANGUAGE_STORAGE_KEY = "clarus-analysis-language"

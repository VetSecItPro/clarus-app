/**
 * @module lib/build-preference-prompt
 * @description Maps structured user analysis preferences into a natural language
 * instruction block for injection into AI analysis prompts.
 *
 * The generated block is placed before the content in the prompt template,
 * shaping how the AI frames its analysis without users needing to write raw prompts.
 */

export interface UserAnalysisPreferences {
  analysis_mode: "learn" | "apply" | "evaluate" | "discover" | "create"
  expertise_level: "beginner" | "intermediate" | "expert"
  focus_areas: string[]
  is_active: boolean
}

const MODE_INSTRUCTIONS: Record<string, { label: string; directive: string; scoring: string }> = {
  learn: {
    label: "LEARN",
    directive:
      "The user wants to understand this content deeply. " +
      "Frame takeaways as concepts to study. Define technical terms when they appear. " +
      "Action items should guide further learning (e.g., \"research X,\" \"study Y\"), not immediate implementation.",
    scoring:
      "Weight educational value and depth of explanation more heavily than practical actionability.",
  },
  apply: {
    label: "APPLY",
    directive:
      "The user wants practical, actionable output. " +
      "Focus on what can be implemented this week. Assess ROI and feasibility. " +
      "Action items should be concrete steps (e.g., \"implement X,\" \"try Y approach\").",
    scoring:
      "Weight actionability and practical value most heavily.",
  },
  evaluate: {
    label: "EVALUATE",
    directive:
      "The user wants to assess this content critically. " +
      "Scrutinize evidence, methodology, and sourcing. Highlight gaps, counterarguments, and unstated assumptions. " +
      "Action items should guide verification (e.g., \"verify X,\" \"compare with Y\").",
    scoring:
      "Weight credibility, evidence quality, and intellectual rigor most heavily.",
  },
  discover: {
    label: "DISCOVER",
    directive:
      "The user wants a concise, accessible overview. " +
      "Focus on the most interesting and surprising points. Entertainment value and novelty matter. " +
      "Keep action items minimal — the user is browsing, not building.",
    scoring:
      "Weight how genuinely interesting and novel the content is.",
  },
  create: {
    label: "CREATE",
    directive:
      "The user is a content creator studying this for craft insights. " +
      "Analyze structure, narrative techniques, and audience engagement strategies. " +
      "Highlight what makes this content effective or ineffective. " +
      "Action items should be creative techniques to adopt (e.g., \"use X hook technique,\" \"structure like Y\").",
    scoring:
      "Weight craft quality, production value, and transferable creative techniques.",
  },
}

const EXPERTISE_INSTRUCTIONS: Record<string, { label: string; directive: string }> = {
  beginner: {
    label: "BEGINNER",
    directive:
      "Provide extra context for domain-specific concepts. Define technical terms. " +
      "Use accessible language. Give longer explanations where clarity requires it.",
  },
  intermediate: {
    label: "INTERMEDIATE",
    directive:
      "Standard depth. Only explain niche or uncommon terms. Assume general familiarity with common concepts.",
  },
  expert: {
    label: "EXPERT",
    directive:
      "Skip foundational explanations. Focus on nuances, edge cases, and advanced critique. " +
      "Be concise and dense — the user has deep domain knowledge.",
  },
}

const FOCUS_LABELS: Record<string, { label: string; directive: string }> = {
  accuracy: {
    label: "ACCURACY",
    directive: "Scrutinize claims and sources closely. Flag unsourced or dubious assertions.",
  },
  takeaways: {
    label: "TAKEAWAYS",
    directive: "Emphasize memorable insights. Focus key takeaways on \"so what?\" value.",
  },
  efficiency: {
    label: "EFFICIENCY",
    directive: "Keep all sections concise. Prioritize the verdict and essentials.",
  },
  depth: {
    label: "DEPTH",
    directive: "Be thorough in your analysis. Longer, more detailed output is fine.",
  },
  bias: {
    label: "BIAS",
    directive: "Highlight author perspective, unstated assumptions, and conflicts of interest.",
  },
  novelty: {
    label: "NOVELTY",
    directive: "Flag derivative content. Highlight genuinely original ideas and fresh perspectives.",
  },
}

/**
 * Converts structured preferences into a natural language instruction block
 * for injection into AI analysis prompts.
 *
 * Returns empty string if preferences are inactive or at all-default values,
 * so the analysis pipeline behaves as before for users without custom prefs.
 */
export function buildPreferenceBlock(prefs: UserAnalysisPreferences | null): string {
  if (!prefs || !prefs.is_active) return ""

  // Skip if everything is at defaults (apply + intermediate + [takeaways, accuracy])
  const isDefault =
    prefs.analysis_mode === "apply" &&
    prefs.expertise_level === "intermediate" &&
    prefs.focus_areas.length === 2 &&
    prefs.focus_areas.includes("takeaways") &&
    prefs.focus_areas.includes("accuracy")

  if (isDefault) return ""

  const mode = MODE_INSTRUCTIONS[prefs.analysis_mode] ?? MODE_INSTRUCTIONS.apply
  const expertise = EXPERTISE_INSTRUCTIONS[prefs.expertise_level] ?? EXPERTISE_INSTRUCTIONS.intermediate

  const lines: string[] = [
    "USER PREFERENCES (adjust your evaluation accordingly):",
    `- Analysis mode: ${mode.label} — ${mode.directive}`,
    `- Expertise: ${expertise.label} — ${expertise.directive}`,
  ]

  if (prefs.focus_areas.length > 0) {
    const focusDescriptions = prefs.focus_areas
      .map((f) => FOCUS_LABELS[f])
      .filter(Boolean)
      .map((f) => `${f.label} (${f.directive})`)
      .join(" and ")

    if (focusDescriptions) {
      lines.push(`- Priorities: ${focusDescriptions}`)
    }
  }

  lines.push("")
  lines.push(`When scoring signal_noise_score, ${mode.scoring}`)

  return "\n" + lines.join("\n") + "\n"
}

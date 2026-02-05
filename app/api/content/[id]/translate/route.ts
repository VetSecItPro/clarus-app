import { NextResponse } from "next/server"
import type { Json } from "@/types/database.types"
import { authenticateRequest, verifyContentOwnership, AuthErrors } from "@/lib/auth"
import { uuidSchema } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/validation"
import { logApiUsage } from "@/lib/api-usage"
import { isValidLanguage, getLanguageConfig, type AnalysisLanguage } from "@/lib/languages"
import { normalizeTier, TIER_FEATURES } from "@/lib/tier-limits"
import { sanitizeForPrompt, wrapUserContent, INSTRUCTION_ANCHOR, detectOutputLeakage } from "@/lib/prompt-sanitizer"

const openRouterApiKey = process.env.OPENROUTER_API_KEY
const AI_CALL_TIMEOUT_MS = 60000 // 60 seconds — translations are faster than full analysis

interface TranslatableFields {
  brief_overview: string | null
  triage: {
    worth_your_time?: string
    target_audience?: string[]
    content_density?: string
    quality_score?: number
    signal_noise_score?: number
    estimated_value?: string
    content_category?: string
  } | null
  truth_check: {
    overall_rating?: string
    issues?: Array<{
      type: string
      claim_or_issue: string
      assessment: string
      severity: string
      timestamp?: string
      sources?: Array<{ url: string; title: string }>
    }>
    claims?: Array<{
      claim: string
      verdict: string
      confidence: number
      explanation: string
      source_quote?: string
      timestamp?: string
    }>
    strengths?: string[]
    sources_quality?: string
  } | null
  action_items: Array<{
    title: string
    description: string
    priority: string
    category?: string
  }> | null
  mid_length_summary: string | null
  detailed_summary: string | null
}

/**
 * Extract only the translatable text fields from a summary row,
 * preserving the JSON structure but stripping numeric/enum values.
 */
function extractTranslatablePayload(summary: TranslatableFields): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (summary.brief_overview) {
    payload.brief_overview = summary.brief_overview
  }

  if (summary.triage) {
    const triage = summary.triage
    payload.triage = {
      worth_your_time: triage.worth_your_time || null,
      target_audience: triage.target_audience || null,
      content_density: triage.content_density || null,
      estimated_value: triage.estimated_value || null,
    }
  }

  if (summary.truth_check) {
    const tc = summary.truth_check
    payload.truth_check = {
      issues: tc.issues?.map(issue => ({
        claim_or_issue: issue.claim_or_issue,
        assessment: issue.assessment,
      })) || null,
      claims: tc.claims?.map(claim => ({
        claim: claim.claim,
        verdict: claim.verdict,
        explanation: claim.explanation,
      })) || null,
      strengths: tc.strengths || null,
      sources_quality: tc.sources_quality || null,
    }
  }

  if (summary.action_items) {
    payload.action_items = summary.action_items.map(item => ({
      title: item.title,
      description: item.description,
    }))
  }

  if (summary.mid_length_summary) {
    payload.mid_length_summary = summary.mid_length_summary
  }

  if (summary.detailed_summary) {
    payload.detailed_summary = summary.detailed_summary
  }

  return payload
}

/**
 * Recursively sanitize string values in the translation payload.
 * This protects against injection via previously-stored analysis text.
 */
function sanitizeTranslationPayload(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeForPrompt(value, { context: `translate-${key}`, maxLength: 50_000 })
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === "string") {
          return sanitizeForPrompt(item, { context: `translate-${key}-item`, maxLength: 50_000 })
        }
        if (item && typeof item === "object") {
          return sanitizeTranslationPayload(item as Record<string, unknown>)
        }
        return item
      })
    } else if (value && typeof value === "object") {
      result[key] = sanitizeTranslationPayload(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Merge translated text fields back into the full summary structure,
 * preserving all numeric/enum values from the source.
 */
function mergeTranslatedFields(
  sourceSummary: Record<string, unknown>,
  translated: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // brief_overview — simple text
  result.brief_overview = typeof translated.brief_overview === "string"
    ? translated.brief_overview
    : sourceSummary.brief_overview

  // triage — merge translated text into original structure
  if (sourceSummary.triage && typeof sourceSummary.triage === "object") {
    const originalTriage = sourceSummary.triage as Record<string, unknown>
    const translatedTriage = (translated.triage && typeof translated.triage === "object")
      ? translated.triage as Record<string, unknown>
      : {}
    result.triage = {
      ...originalTriage,
      worth_your_time: translatedTriage.worth_your_time ?? originalTriage.worth_your_time,
      target_audience: translatedTriage.target_audience ?? originalTriage.target_audience,
      content_density: translatedTriage.content_density ?? originalTriage.content_density,
      estimated_value: translatedTriage.estimated_value ?? originalTriage.estimated_value,
    }
  } else {
    result.triage = sourceSummary.triage
  }

  // truth_check — merge translated issues/claims/strengths
  if (sourceSummary.truth_check && typeof sourceSummary.truth_check === "object") {
    const originalTc = sourceSummary.truth_check as Record<string, unknown>
    const translatedTc = (translated.truth_check && typeof translated.truth_check === "object")
      ? translated.truth_check as Record<string, unknown>
      : {}

    // Merge issues
    let mergedIssues = originalTc.issues
    if (Array.isArray(translatedTc.issues) && Array.isArray(originalTc.issues)) {
      mergedIssues = (originalTc.issues as Array<Record<string, unknown>>).map((issue, i) => ({
        ...issue,
        claim_or_issue: (translatedTc.issues as Array<Record<string, unknown>>)[i]?.claim_or_issue ?? issue.claim_or_issue,
        assessment: (translatedTc.issues as Array<Record<string, unknown>>)[i]?.assessment ?? issue.assessment,
      }))
    }

    // Merge claims
    let mergedClaims = originalTc.claims
    if (Array.isArray(translatedTc.claims) && Array.isArray(originalTc.claims)) {
      mergedClaims = (originalTc.claims as Array<Record<string, unknown>>).map((claim, i) => ({
        ...claim,
        claim: (translatedTc.claims as Array<Record<string, unknown>>)[i]?.claim ?? claim.claim,
        verdict: (translatedTc.claims as Array<Record<string, unknown>>)[i]?.verdict ?? claim.verdict,
        explanation: (translatedTc.claims as Array<Record<string, unknown>>)[i]?.explanation ?? claim.explanation,
      }))
    }

    result.truth_check = {
      ...originalTc,
      issues: mergedIssues,
      claims: mergedClaims,
      strengths: Array.isArray(translatedTc.strengths) ? translatedTc.strengths : originalTc.strengths,
      sources_quality: typeof translatedTc.sources_quality === "string" ? translatedTc.sources_quality : originalTc.sources_quality,
    }
  } else {
    result.truth_check = sourceSummary.truth_check
  }

  // action_items — merge translated title/description
  if (Array.isArray(sourceSummary.action_items) && Array.isArray(translated.action_items)) {
    result.action_items = (sourceSummary.action_items as Array<Record<string, unknown>>).map((item, i) => ({
      ...item,
      title: (translated.action_items as Array<Record<string, unknown>>)[i]?.title ?? item.title,
      description: (translated.action_items as Array<Record<string, unknown>>)[i]?.description ?? item.description,
    }))
  } else {
    result.action_items = sourceSummary.action_items
  }

  // mid_length_summary — simple text
  result.mid_length_summary = typeof translated.mid_length_summary === "string"
    ? translated.mid_length_summary
    : sourceSummary.mid_length_summary

  // detailed_summary — simple text
  result.detailed_summary = typeof translated.detailed_summary === "string"
    ? translated.detailed_summary
    : sourceSummary.detailed_summary

  return result
}

/**
 * Call Gemini Flash Lite via OpenRouter to translate content.
 * Falls back to Gemini Flash if Flash Lite fails.
 */
async function translateViaAI(
  payload: Record<string, unknown>,
  targetLang: AnalysisLanguage,
  sourceLang: AnalysisLanguage,
  userId: string | null,
  contentId: string,
): Promise<{ translated: Record<string, unknown>; model: string; tokensIn: number; tokensOut: number }> {
  const langConfig = getLanguageConfig(targetLang)
  const models = ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"]

  const sourceLangName = sourceLang === "en" ? "English" : getLanguageConfig(sourceLang).name
  const systemPrompt = `You are a professional translator. Translate the JSON values from ${sourceLangName} to ${langConfig.name} (${langConfig.nativeName}).

Rules:
- Translate ALL text string values naturally, not word-for-word
- Keep proper nouns, technical terms, URLs, and timestamps unchanged
- Keep the JSON structure IDENTICAL — only change string values
- Do NOT translate null values — keep them as null
- Do NOT translate numeric scores, ratings, severity levels, or enum values
- For arrays of strings, translate each string in the array
- For arrays of objects, translate only the text fields within each object
${langConfig.dir === "rtl" ? `- This is an RTL language — ensure text reads naturally right-to-left` : ""}

Return ONLY valid JSON. No markdown code blocks, no explanation.`

  // Sanitize the payload text values before sending to AI
  const sanitizedPayload = sanitizeTranslationPayload(payload)
  const userPrompt = wrapUserContent(JSON.stringify(sanitizedPayload, null, 2)) + INSTRUCTION_ANCHOR

  for (const model of models) {
    const startTime = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), AI_CALL_TIMEOUT_MS)

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://clarusapp.io",
          "X-Title": "Clarus",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 16000,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`Translation API error (${model}, ${response.status}):`, errorBody)
        await logApiUsage({
          userId,
          contentId,
          apiName: "openrouter",
          operation: "translate",
          modelName: model,
          responseTimeMs: Date.now() - startTime,
          status: "error",
          errorMessage: `API ${response.status}: ${errorBody.slice(0, 200)}`,
        })
        continue // Try fallback model
      }

      const result = await response.json()
      const rawContent = result.choices?.[0]?.message?.content

      if (!rawContent) {
        console.error(`Translation empty response (${model})`)
        continue
      }

      // Monitor output for injection leakage
      if (typeof rawContent === "string") {
        detectOutputLeakage(rawContent, "translation")
      }

      // Parse JSON — handle optional markdown code blocks
      let parsed: Record<string, unknown>
      try {
        const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch?.[1]) {
          parsed = JSON.parse(jsonMatch[1])
        } else {
          parsed = JSON.parse(rawContent)
        }
      } catch {
        console.error(`Translation JSON parse failed (${model}):`, rawContent.slice(0, 500))
        await logApiUsage({
          userId,
          contentId,
          apiName: "openrouter",
          operation: "translate",
          modelName: model,
          responseTimeMs: Date.now() - startTime,
          status: "error",
          errorMessage: "JSON parse failed",
        })
        continue
      }

      const tokensIn = result.usage?.prompt_tokens || 0
      const tokensOut = result.usage?.completion_tokens || 0

      await logApiUsage({
        userId,
        contentId,
        apiName: "openrouter",
        operation: "translate",
        tokensInput: tokensIn,
        tokensOutput: tokensOut,
        modelName: model,
        responseTimeMs: Date.now() - startTime,
        status: "success",
        metadata: { targetLanguage: targetLang },
      })

      return { translated: parsed, model, tokensIn, tokensOut }
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      const isTimeout = err instanceof Error && err.name === "AbortError"
      console.error(`Translation failed (${model}):`, isTimeout ? "timeout" : err)
      await logApiUsage({
        userId,
        contentId,
        apiName: "openrouter",
        operation: "translate",
        modelName: model,
        responseTimeMs: Date.now() - startTime,
        status: isTimeout ? "timeout" : "error",
        errorMessage: isTimeout ? "Request timed out" : String(err),
      })
      continue
    }
  }

  throw new Error("Translation failed with all models")
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Rate limit
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`translate:${clientIp}`, 20, 60000)
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // 2. Validate content ID
    const idResult = uuidSchema.safeParse(id)
    if (!idResult.success) {
      return AuthErrors.badRequest("Invalid content ID")
    }

    // 3. Authenticate
    const auth = await authenticateRequest()
    if (!auth.success) {
      return auth.response
    }

    // 4. Verify ownership
    const ownership = await verifyContentOwnership(auth.supabase, auth.user.id, idResult.data)
    if (!ownership.owned) {
      return ownership.response
    }

    // 5. Parse + validate language
    let body: { language?: string }
    try {
      body = await request.json()
    } catch {
      return AuthErrors.badRequest("Invalid JSON body")
    }

    const targetLang = body.language
    if (!targetLang || !isValidLanguage(targetLang)) {
      return AuthErrors.badRequest("Invalid or missing language code")
    }

    // 6. Tier gate — non-English requires Starter+
    const { data: userData } = await auth.supabase
      .from("users")
      .select("tier, day_pass_expires_at")
      .eq("id", auth.user.id)
      .single()

    const tier = normalizeTier(userData?.tier, userData?.day_pass_expires_at)
    if (!TIER_FEATURES[tier].multiLanguageAnalysis) {
      return NextResponse.json(
        { error: "Multi-language analysis requires Starter plan or higher", upgrade_required: true, tier },
        { status: 403 }
      )
    }

    // 7. Check if translation already exists
    const summaryColumns = "id, content_id, user_id, model_name, created_at, updated_at, brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, processing_status, language"
    const { data: existingTranslation } = await auth.supabase
      .from("summaries")
      .select(summaryColumns)
      .eq("content_id", idResult.data)
      .eq("language", targetLang)
      .maybeSingle()

    if (existingTranslation?.processing_status === "complete") {
      return NextResponse.json(existingTranslation)
    }

    // If a translation is already in progress, return a polling hint
    if (existingTranslation?.processing_status === "translating") {
      return NextResponse.json(
        { error: "Translation already in progress", status: "translating" },
        { status: 202 }
      )
    }

    // 8. Fetch source summary — prefer English, fall back to any completed language
    const { data: allSummaries, error: sumError } = await auth.supabase
      .from("summaries")
      .select("brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, processing_status, language")
      .eq("content_id", idResult.data)
      .eq("processing_status", "complete")
      .neq("language", targetLang)

    if (sumError || !allSummaries || allSummaries.length === 0) {
      return AuthErrors.badRequest("No completed analysis found. Analyze content first before translating.")
    }

    // Prefer English source for best translation quality, fall back to any available
    const sourceSummary = allSummaries.find(s => s.language === "en") || allSummaries[0]
    const sourceLanguage = sourceSummary.language as AnalysisLanguage

    if (!openRouterApiKey) {
      return AuthErrors.serverError()
    }

    // 9. Create placeholder row with 'translating' status (upsert in case a failed row exists)
    const { error: upsertError } = await auth.supabase
      .from("summaries")
      .upsert({
        content_id: idResult.data,
        user_id: auth.user.id,
        language: targetLang,
        processing_status: "translating",
        model_name: "google/gemini-2.5-flash-lite",
      }, {
        onConflict: "content_id,language",
      })

    if (upsertError) {
      console.error("Failed to create translation placeholder:", upsertError)
      return AuthErrors.serverError()
    }

    // 10. Extract translatable fields and call AI
    const translatablePayload = extractTranslatablePayload({
      brief_overview: sourceSummary.brief_overview,
      triage: sourceSummary.triage as TranslatableFields["triage"],
      truth_check: sourceSummary.truth_check as TranslatableFields["truth_check"],
      action_items: sourceSummary.action_items as TranslatableFields["action_items"],
      mid_length_summary: sourceSummary.mid_length_summary,
      detailed_summary: sourceSummary.detailed_summary,
    })

    let translatedResult: Awaited<ReturnType<typeof translateViaAI>>
    try {
      translatedResult = await translateViaAI(
        translatablePayload,
        targetLang,
        sourceLanguage,
        auth.user.id,
        idResult.data,
      )
    } catch (err) {
      // Mark as failed so user can retry
      await auth.supabase
        .from("summaries")
        .update({ processing_status: "error" })
        .eq("content_id", idResult.data)
        .eq("language", targetLang)

      console.error("Translation failed:", err)
      return NextResponse.json(
        { error: "Translation failed. Please try again." },
        { status: 500 }
      )
    }

    // 11. Merge translated text with English numeric/structural data
    const merged = mergeTranslatedFields(
      {
        brief_overview: sourceSummary.brief_overview,
        triage: sourceSummary.triage,
        truth_check: sourceSummary.truth_check,
        action_items: sourceSummary.action_items,
        mid_length_summary: sourceSummary.mid_length_summary,
        detailed_summary: sourceSummary.detailed_summary,
      },
      translatedResult.translated,
    )

    // 12. Update the summary row with translated content
    const { data: updatedSummary, error: updateError } = await auth.supabase
      .from("summaries")
      .update({
        brief_overview: merged.brief_overview as string | null,
        triage: merged.triage as Json,
        truth_check: merged.truth_check as Json,
        action_items: merged.action_items as Json,
        mid_length_summary: merged.mid_length_summary as string | null,
        detailed_summary: merged.detailed_summary as string | null,
        processing_status: "complete",
        model_name: translatedResult.model,
        updated_at: new Date().toISOString(),
      })
      .eq("content_id", idResult.data)
      .eq("language", targetLang)
      .select(summaryColumns)
      .single()

    if (updateError || !updatedSummary) {
      console.error("Failed to save translation:", updateError)
      return AuthErrors.serverError()
    }

    // 13. Update content.analysis_language to the target language
    await auth.supabase
      .from("content")
      .update({ analysis_language: targetLang })
      .eq("id", idResult.data)

    return NextResponse.json(updatedSummary)
  } catch (err) {
    console.error("Translate route error:", err)
    return AuthErrors.serverError()
  }
}

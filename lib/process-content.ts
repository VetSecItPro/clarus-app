/**
 * @module lib/process-content
 * @description Core content processing pipeline orchestrator.
 *
 * This module delegates to pipeline/* sub-modules for each stage:
 * - YouTube video metadata and transcript extraction (pipeline/youtube)
 * - Article scraping via Firecrawl (pipeline/article-scraper)
 * - Podcast transcription via Deepgram
 * - Web search context via Tavily (pipeline/web-search)
 * - Claim verification (pipeline/claim-search)
 * - Tone detection (pipeline/tone-detection)
 * - AI-powered analysis sections via OpenRouter (pipeline/ai-sections)
 * - Cross-user content caching (pipeline/content-cache)
 * - Domain credibility tracking (pipeline/domain-tracking)
 * - Transcript correction (pipeline/transcript-correction)
 * - Content metadata formatting (pipeline/content-metadata)
 *
 * The main export is `processContent()` which can be called directly
 * by internal routes instead of making an HTTP fetch to /api/process-content.
 *
 * @see {@link app/api/process-content/route.ts} for the HTTP wrapper
 */

import { createClient } from "@supabase/supabase-js"
import type { Database, Json, TriageData, TruthCheckData, ActionItemsData } from "@/types/database.types"
import { logProcessingMetrics } from "@/lib/api-usage"
import { enforceAndIncrementUsage } from "@/lib/usage"
import { detectPaywallTruncation } from "@/lib/paywall-detection"
import { screenContent, detectAiRefusal, persistFlag } from "@/lib/content-screening"
import { submitPodcastTranscription } from "@/lib/deepgram"
import { getLanguageDirective } from "@/lib/languages"
import { TIER_FEATURES, normalizeTier } from "@/lib/tier-limits"
import { classifyError, getUserFriendlyError } from "@/lib/error-sanitizer"
import { buildPreferenceBlock } from "@/lib/build-preference-prompt"
import type { UserAnalysisPreferences } from "@/lib/build-preference-prompt"
import { logger } from "@/lib/logger"

// Pipeline types and helpers
import {
  ProcessContentError,
  type ProcessContentOptions,
  type ProcessContentResult,
  getErrorMessage,
  PIPELINE_TIMEOUT_MS,
  PHASE1_TIMEOUT_MS,
} from "./pipeline/types"

// Pipeline stages
import { correctTranscriptFromMetadata, buildTranscriptCorrectionNotice } from "./pipeline/transcript-correction"
import { buildContentMetadataBlock, countSpeakers, buildTypeInstructions } from "./pipeline/content-metadata"
import { getWebSearchContext } from "./pipeline/web-search"
import type { WebSearchResult, WebSearchContext } from "./pipeline/web-search"
import { getClaimSearchContext } from "./pipeline/claim-search"
import type { ClaimSearchContext } from "./pipeline/web-search"
import { detectContentTone, NEUTRAL_TONE_LABEL } from "./pipeline/tone-detection"
import type { ToneDetectionResult } from "./pipeline/tone-detection"
import { getYouTubeMetadata, getYouTubeTranscript, detectMusicContent } from "./pipeline/youtube"
import { scrapeArticle } from "./pipeline/article-scraper"
import type { ScrapedArticleData } from "./pipeline/article-scraper"
import {
  getModelSummary,
  generateBriefOverview,
  generateTriage,
  generateTruthCheck,
  generateActionItems,
  generateDetailedSummary,
  generateAutoTags,
} from "./pipeline/ai-sections"
import type { ModelSummary } from "./pipeline/ai-sections"
import { updateSummarySection, isEntertainmentUrl, getDomainCredibility, updateDomainStats } from "./pipeline/domain-tracking"
import { findCachedAnalysis, buildMetadataCopyPayload, cloneCachedContent } from "./pipeline/content-cache"

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supadataApiKey = process.env.SUPADATA_API_KEY
const openRouterApiKey = process.env.OPENROUTER_API_KEY
const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
const deepgramApiKey = process.env.DEEPGRAM_API_KEY

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

/**
 * Process content by ID. This is the core analysis pipeline.
 *
 * @param options - Processing options including contentId, userId, language, etc.
 * @returns A ProcessContentResult on success
 * @throws ProcessContentError on failure with appropriate status code
 */
export async function processContent(options: ProcessContentOptions): Promise<ProcessContentResult> {
  const {
    contentId,
    userId: authenticatedUserId,
    language = "en",
    forceRegenerate = false,
    skipScraping = false,
    feedAuthHeader,
  } = options

  // Validate environment
  if (!supabaseUrl || !supabaseKey) {
    throw new ProcessContentError("Server configuration error: Missing database credentials.", 500)
  }

  if (!supadataApiKey || !openRouterApiKey || !firecrawlApiKey) {
    throw new ProcessContentError("Server configuration error: Missing API keys.", 500)
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, { db: { schema: "clarus" } })

  // Fetch content record
  const { data: content, error: fetchError } = await supabase
    .from("content")
    .select("id, url, type, user_id, full_text, title, author, duration, thumbnail_url, description, upload_date, view_count, like_count, channel_id, raw_youtube_metadata, transcript_languages, detected_tone, tags, analysis_language, regeneration_count, podcast_transcript_id, date_added, is_bookmarked, share_token")
    .eq("id", contentId)
    .single()

  if (fetchError || !content) {
    logger.error(`API: Error fetching content by ID ${contentId}:`, fetchError)
    throw new ProcessContentError("Content not found", 404)
  }

  // Verify ownership for authenticated calls
  if (authenticatedUserId && content.user_id !== authenticatedUserId) {
    throw new ProcessContentError("Access denied", 403)
  }

  // Multi-language tier gating
  if (language !== "en" && content.user_id) {
    const { data: userData } = await supabase
      .from("users")
      .select("tier, day_pass_expires_at")
      .eq("id", content.user_id)
      .single()
    const userTier = normalizeTier(userData?.tier, userData?.day_pass_expires_at)
    if (!TIER_FEATURES[userTier].multiLanguageAnalysis) {
      throw new ProcessContentError(
        "Multi-language analysis requires a Starter plan or higher.",
        403,
        true,
        userTier
      )
    }
  }

  // Tier-based usage limit check — atomic check + increment (no TOCTOU race)
  const usageField = content.type === "podcast" ? "podcast_analyses_count" as const : "analyses_count" as const
  if (!forceRegenerate && content.user_id) {
    const usageCheck = await enforceAndIncrementUsage(supabase, content.user_id, usageField)
    if (!usageCheck.allowed) {
      const label = content.type === "podcast" ? "podcast analysis" : "analysis"
      throw new ProcessContentError(
        `Monthly ${label} limit reached (${usageCheck.limit}). Upgrade your plan for more.`,
        403,
        true,
        usageCheck.tier
      )
    }
  }

  // Cross-user cache check
  if (!forceRegenerate && content.user_id) {
    const cached = await findCachedAnalysis(supabase, content.url, language, content.user_id, content.type)

    if (cached?.type === "full") {
      const cloneSuccess = await cloneCachedContent(
        supabase,
        content.id,
        content.user_id,
        cached,
        language,
      )

      if (cloneSuccess) {
        // Update domain stats
        const cachedTriage = cached.summary.triage as TriageData | null
        const cachedTruthCheck = cached.summary.truth_check as TruthCheckData | null
        if (content.url) {
          updateDomainStats(supabase, content.url, cachedTriage, cachedTruthCheck).catch(
            (err) => logger.warn("API: [cache] Domain stats update failed:", err)
          )
        }

        // Clone claims
        try {
          const { data: sourceClaims } = await supabase
            .from("claims")
            .select("claim_text, normalized_text, status, severity, sources")
            .eq("content_id", cached.content.id)

          if (sourceClaims && sourceClaims.length > 0) {
            const clonedClaims = sourceClaims.map((claim) => ({
              content_id: content.id,
              user_id: content.user_id!,
              claim_text: claim.claim_text,
              normalized_text: claim.normalized_text,
              status: claim.status,
              severity: claim.severity,
              sources: claim.sources,
            }))
            await supabase.from("claims").insert(clonedClaims)
          }
        } catch (claimErr) {
          logger.warn("API: [cache] Claims clone failed (non-fatal):", claimErr)
        }

        // Usage already incremented atomically by enforceAndIncrementUsage() above

        logProcessingMetrics({
          contentId: content.id,
          userId: content.user_id,
          sectionType: "cache_hit",
          modelName: "none",
          tokensInput: 0,
          tokensOutput: 0,
          processingTimeMs: 0,
          retryCount: 0,
          status: "success",
        })

        return {
          success: true,
          cached: true,
          message: "Content analysis served from cache.",
          contentId: content.id,
          sectionsGenerated: [
            "brief_overview", "triage", "truth_check",
            "action_items", "mid_length_summary", "detailed_summary",
          ].filter((s) => {
            const key = s as keyof typeof cached.summary
            return cached.summary[key] != null
          }),
          language,
        }
      }
      logger.warn("API: [cache] Clone failed, falling back to normal pipeline")
    } else if (cached?.type === "text_only") {
      const metadataPayload = buildMetadataCopyPayload(cached.content)
      const textOnlyUpdate: Partial<Database["clarus"]["Tables"]["content"]["Update"]> = {
        ...metadataPayload,
        full_text: cached.content.full_text,
        detected_tone: cached.content.detected_tone,
      }

      const { error: textCopyError } = await supabase
        .from("content")
        .update(textOnlyUpdate)
        .eq("id", content.id)

      if (!textCopyError) {
        Object.assign(content, textOnlyUpdate)
      } else {
        logger.warn("API: [cache] Text copy failed, proceeding with normal scrape:", textCopyError)
      }
    }
  }

  // Content fetching (unless skipScraping is true)
  if (!skipScraping) {
    try {
      if (content.type === "youtube") {
        const shouldFetchYouTubeMetadata =
          forceRegenerate ||
          !content.author ||
          !content.duration ||
          !content.thumbnail_url ||
          !content.raw_youtube_metadata
        if (shouldFetchYouTubeMetadata) {
          const metadata = await getYouTubeMetadata(content.url, supadataApiKey, content.user_id, content.id)
          const updatePayload: Partial<Database["clarus"]["Tables"]["content"]["Update"]> = {}
          if (metadata.title) updatePayload.title = metadata.title
          if (metadata.author) updatePayload.author = metadata.author
          if (metadata.duration) updatePayload.duration = metadata.duration
          if (metadata.thumbnail_url) updatePayload.thumbnail_url = metadata.thumbnail_url
          if (metadata.description) updatePayload.description = metadata.description
          if (metadata.upload_date) updatePayload.upload_date = metadata.upload_date
          if (metadata.view_count) updatePayload.view_count = metadata.view_count
          if (metadata.like_count) updatePayload.like_count = metadata.like_count
          if (metadata.channel_id) updatePayload.channel_id = metadata.channel_id
          if (metadata.transcript_languages) updatePayload.transcript_languages = metadata.transcript_languages
          if (metadata.raw_youtube_metadata) updatePayload.raw_youtube_metadata = metadata.raw_youtube_metadata

          if (Object.keys(updatePayload).length > 0) {
            const { error: updateMetaError } = await supabase.from("content").update(updatePayload).eq("id", content.id)
            if (updateMetaError) logger.error("API: Error updating YouTube metadata in DB:", updateMetaError)
            else Object.assign(content, updatePayload)
          }
        }

        // Early music content gate — reject before expensive transcript fetch
        // Use content (which includes freshly fetched metadata via Object.assign)
        const musicCheckMetadata = {
          title: content.title,
          author: content.author,
          duration: content.duration,
          thumbnail_url: content.thumbnail_url,
          description: content.description,
          upload_date: content.upload_date,
          view_count: content.view_count,
          like_count: content.like_count,
          channel_id: content.channel_id,
          transcript_languages: content.transcript_languages,
          raw_youtube_metadata: content.raw_youtube_metadata,
        }
        if (detectMusicContent(musicCheckMetadata)) {
          logger.info(`API: Music content detected for ${content.url} — skipping analysis`)
          await supabase.from("content").update({
            full_text: "PROCESSING_FAILED::YOUTUBE::MUSIC_CONTENT",
          }).eq("id", content.id)

          await updateSummarySection(supabase, content.id, content.user_id!, {
            processing_status: "refused",
            brief_overview: "This appears to be primarily music content (music video, concert, album, etc.). Clarus is designed to analyze spoken and written content like interviews, podcasts, news, and educational videos. Music content doesn't have enough spoken dialogue for meaningful analysis.",
          }, language)

          throw new ProcessContentError(
            "This video appears to be primarily music content. Clarus analyzes spoken and written content — music videos, concerts, and albums don't have enough dialogue to analyze.",
            200,
          )
        }

        const shouldFetchYouTubeText = !content.full_text || forceRegenerate
        if (shouldFetchYouTubeText) {
          const { full_text } = await getYouTubeTranscript(content.url, supadataApiKey, content.user_id, content.id)
          if (full_text) {
            const { error: updateTranscriptError } = await supabase
              .from("content")
              .update({ full_text })
              .eq("id", content.id)
            if (updateTranscriptError)
              logger.error("API: Error updating YouTube transcript in DB:", updateTranscriptError)
            else content.full_text = full_text
          }
        }
      } else if (content.type === "podcast") {
        if (!content.full_text || forceRegenerate) {
          if (!deepgramApiKey) {
            logger.error("API: DEEPGRAM_API_KEY not configured")
            throw new ProcessContentError("Podcast transcription is not configured.", 500)
          }

          const appUrl = process.env.NEXT_PUBLIC_APP_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
          const tokenParam = process.env.DEEPGRAM_WEBHOOK_TOKEN
            ? `?token=${process.env.DEEPGRAM_WEBHOOK_TOKEN}`
            : ""
          const webhookUrl = `${appUrl}/api/deepgram-webhook${tokenParam}`

          logger.info(`API: [podcast] Submitting to Deepgram — audio: ${content.url}, webhook: ${appUrl}/api/deepgram-webhook (token ${tokenParam ? "present" : "MISSING"})`)

          const { transcript_id } = await submitPodcastTranscription(
            content.url,
            webhookUrl,
            deepgramApiKey,
            feedAuthHeader ? { feedAuthHeader } : undefined,
          )

          logger.info(`API: [podcast] Deepgram accepted — request_id: ${transcript_id}, content: ${content.id}`)

          await supabase
            .from("content")
            .update({ podcast_transcript_id: transcript_id })
            .eq("id", content.id)

          await updateSummarySection(supabase, content.id, content.user_id!, {
            processing_status: "transcribing",
          }, language)

          return {
            success: true,
            cached: false,
            message: "Podcast transcription started. Analysis will begin when transcription completes.",
            contentId: content.id,
            transcriptId: transcript_id,
            sectionsGenerated: [],
            language,
          }
        }
      } else if (content.type === "article" || content.type === "pdf" || content.type === "document" || content.type === "x_post") {
        const shouldScrape = forceRegenerate || !content.full_text || content.full_text.startsWith("PROCESSING_FAILED::")
        if (shouldScrape) {
          let scrapedData: ScrapedArticleData | null = null

          if (content.type === "x_post") {
            // Fallback chain for X/Twitter: fixupx → fxtwitter → direct
            const urlsToTry: string[] = []
            try {
              const urlObject = new URL(content.url)
              const hostname = urlObject.hostname
              if (hostname === "x.com" || hostname === "twitter.com") {
                const fixup = new URL(content.url)
                fixup.hostname = "fixupx.com"
                urlsToTry.push(fixup.toString())

                const fx = new URL(content.url)
                fx.hostname = "fxtwitter.com"
                urlsToTry.push(fx.toString())
              }
            } catch {
              logger.error(`API: Could not parse URL for x_post: ${content.url}`)
            }
            urlsToTry.push(content.url) // Always try direct URL as last resort

            for (const urlToTry of urlsToTry) {
              try {
                const result = await scrapeArticle(urlToTry, firecrawlApiKey, content.user_id, content.id)
                if (result.full_text && result.full_text.length > 20) {
                  scrapedData = result
                  break
                }
                logger.warn(`API: [x_post] Empty result from ${new URL(urlToTry).hostname}, trying next`)
              } catch (err) {
                logger.warn(`API: [x_post] Scrape failed for ${new URL(urlToTry).hostname}:`, getErrorMessage(err))
                // Continue to next URL in chain
              }
            }
            if (!scrapedData) {
              throw new ProcessContentError("Could not retrieve X/Twitter post content from any source", 200)
            }
          } else {
            scrapedData = await scrapeArticle(content.url, firecrawlApiKey, content.user_id, content.id)
          }

          const updatePayload: Partial<Database["clarus"]["Tables"]["content"]["Update"]> = {}
          if (scrapedData.title) updatePayload.title = scrapedData.title
          if (scrapedData.full_text) updatePayload.full_text = scrapedData.full_text
          if (scrapedData.description) updatePayload.description = scrapedData.description
          if (scrapedData.thumbnail_url) updatePayload.thumbnail_url = scrapedData.thumbnail_url
          updatePayload.author = null
          updatePayload.duration = null
          updatePayload.upload_date = null
          updatePayload.view_count = null
          updatePayload.like_count = null
          updatePayload.channel_id = null
          updatePayload.transcript_languages = null
          updatePayload.raw_youtube_metadata = null

          if (Object.keys(updatePayload).length > 0) {
            const { error: updateArticleError } = await supabase
              .from("content")
              .update(updatePayload)
              .eq("id", content.id)
            if (updateArticleError) logger.error("API: Error updating article data in DB:", updateArticleError)
            else Object.assign(content, updatePayload)
          }
        }
      }
    } catch (error: unknown) {
      const rawMsg = getErrorMessage(error)
      const contentTypeLabel = content.type?.toUpperCase() || "UNKNOWN"
      logger.error(`API: Text processing error for content ${content.id}:`, rawMsg)

      const errorCategory = classifyError(rawMsg)
      const failure_reason = `PROCESSING_FAILED::${contentTypeLabel}::${errorCategory}`
      await supabase.from("content").update({ full_text: failure_reason }).eq("id", content.id)

      const userMessage = getUserFriendlyError(contentTypeLabel, errorCategory)
      throw new ProcessContentError(userMessage, 200) // 200 because partial success
    }
  }

  if (!content.full_text || content.full_text.startsWith("PROCESSING_FAILED::")) {
    logger.warn(
      `API: No valid full text available for content ID ${content.id}. Skipping summary generation. Reason: ${content.full_text}`,
    )
    return {
      success: true,
      cached: false,
      message: "Content processed, but no valid text found for summary.",
      contentId: content.id,
      sectionsGenerated: [],
      language,
    }
  }

  // Content moderation pre-screening
  const screeningResult = await screenContent({
    url: content.url,
    scrapedText: content.full_text,
    contentId: content.id,
    userId: content.user_id,
    contentType: content.type,
    userIp: "internal",
  })

  if (screeningResult.blocked) {
    logger.warn(`MODERATION: Content blocked for ${content.url} — ${screeningResult.flags.map(f => f.reason).join("; ")}`)

    await supabase.from("content").update({
      full_text: "PROCESSING_FAILED::CONTENT_POLICY_VIOLATION",
    }).eq("id", content.id)

    await supabase.from("summaries").upsert({
      content_id: content.id,
      user_id: content.user_id!,
      language,
      processing_status: "refused",
      brief_overview: "This content could not be analyzed because it may violate our content policy.",
      updated_at: new Date().toISOString(),
    }, { onConflict: "content_id,language" })

    throw new ProcessContentError(
      "This content cannot be analyzed because it may contain prohibited material.",
      200
    )
  }

  // Paywall detection
  const paywallWarning = detectPaywallTruncation(
    content.url,
    content.full_text,
    content.type || "article"
  )

  // Compute language directive
  const languageDirective = getLanguageDirective(language)

  if (!content.user_id) {
    logger.error(`API: user_id is missing on content object with id ${content.id}. Cannot save summary.`)
    throw new ProcessContentError("Internal error: user_id missing from content.", 500)
  }

  const userId = content.user_id
  const contentIdVal = content.id
  const contentUrl = content.url
  const contentType = content.type || "article"

  // --- Transcript correction (speech-to-text error fixing) ---
  // Cross-reference the title against the transcript to fix misspelled proper nouns.
  // This runs BEFORE text slicing so all sections get the corrected text.
  const rawFullText = content.full_text
  const transcriptCorrection = correctTranscriptFromMetadata(
    rawFullText,
    content.title,
    content.description,
  )
  const fullText = transcriptCorrection.text

  // Pre-truncate text once — each section gets the right-sized slice without redundant allocations.
  // Cascade from largest to smallest so smaller slices reuse the larger string's memory.
  const text30K = fullText.substring(0, 30000)   // detailed_summary
  const text20K = text30K.substring(0, 20000)     // truth_check
  const text15K = text20K.substring(0, 15000)     // action_items, claim search
  const text10K = text15K.substring(0, 10000)     // triage, auto_tags, web search
  const text8K  = text10K.substring(0, 8000)      // brief_overview

  // Build rich metadata block for AI context — zero API calls, uses data already fetched
  // Append transcript correction notice for youtube/podcast (warns AI about STT errors)
  const baseMetadata = buildContentMetadataBlock(content) || ""
  const correctionNotice = buildTranscriptCorrectionNotice(
    content.title,
    content.description,
    contentType,
    transcriptCorrection.corrections,
  )
  const metadataBlock = (baseMetadata + correctionNotice) || null

  // Build type-specific analysis instructions — tells the AI what to focus on per content type
  const typeInstructions = buildTypeInstructions(contentType, {
    duration: content.duration,
    speakerCount: fullText ? countSpeakers(fullText) : undefined,
  }) || null

  const titleNeedsFixing = !content.title || content.title.startsWith("Processing:") || content.title.startsWith("Analyzing:")

  const failedSections: string[] = []
  const sectionsGenerated: string[] = []

  // Global pipeline timeout — prevents hung requests from consuming resources indefinitely
  const pipelineAbort = new AbortController()
  const pipelineTimeoutId = setTimeout(() => pipelineAbort.abort(), PIPELINE_TIMEOUT_MS)

  // Request-scoped Tavily cache — isolated per request, prevents cross-user data leakage
  const tavilyCache = new Map<string, WebSearchResult>()

  // Web search context + claim verification + tone detection + user preferences (parallel)
  // Wrapped in a timeout — Phase 1 is enrichment, not critical. Falls back to defaults if slow.
  type Phase1Result = [WebSearchContext | null, ClaimSearchContext | null, ToneDetectionResult, UserAnalysisPreferences | null, string | null]
  const phase1Default: Phase1Result = [null, null, { tone_label: "neutral", tone_directive: "The content uses a standard informational tone. Write your analysis in a clear, neutral voice." }, null, null]

  let phase1: Phase1Result
  try {
    phase1 = await Promise.race([
      Promise.all([
        getWebSearchContext(text10K, content.title || undefined, tavilyCache),
        isEntertainmentUrl(contentUrl) ? Promise.resolve(null) : getClaimSearchContext(text15K, tavilyCache),
        detectContentTone(fullText, content.title, contentType, userId, contentIdVal),
        supabase
          .from("user_analysis_preferences")
          .select("analysis_mode, expertise_level, focus_areas, is_active")
          .eq("user_id", userId)
          .maybeSingle()
          .then(({ data }) => data as UserAnalysisPreferences | null),
        getDomainCredibility(supabase, contentUrl),
      ]) as Promise<Phase1Result>,
      new Promise<Phase1Result>((_, reject) =>
        setTimeout(() => reject(new Error("Phase 1 timeout")), PHASE1_TIMEOUT_MS)
      ),
    ])
  } catch (err) {
    logger.warn(`API: Phase 1 timed out after ${PHASE1_TIMEOUT_MS / 1000}s, using defaults:`, getErrorMessage(err))
    phase1 = phase1Default
  }

  const [webSearchContext, claimSearchCtx, toneResult, preferencesRow, domainCredibility] = phase1
  const webContext = webSearchContext?.formattedContext || null
  const claimContext = claimSearchCtx?.formattedContext || null
  const toneDirective = toneResult.tone_directive
  const preferencesBlock = buildPreferenceBlock(preferencesRow)

  // Persist tone label
  if (toneResult.tone_label !== NEUTRAL_TONE_LABEL) {
    supabase.from("content").update({ detected_tone: toneResult.tone_label }).eq("id", contentIdVal).then(
      () => {},
      (err) => logger.warn("Failed to persist detected_tone:", err)
    )
  }

  // Check pipeline timeout before starting Phase 2
  if (pipelineAbort.signal.aborted) {
    clearTimeout(pipelineTimeoutId)
    logger.warn("API: Pipeline timeout hit after Phase 1, saving partial results")
    await updateSummarySection(supabase, contentIdVal, userId, { processing_status: "partial" }, language)
    return { success: true, cached: false, message: "Content partially processed (timeout).", contentId: content.id, sectionsGenerated, language, paywallWarning }
  }

  // All sections in parallel
  const overviewPromise = (async () => {
    const result = await generateBriefOverview(text8K, contentType, userId, contentIdVal, webContext, toneDirective, languageDirective, metadataBlock, typeInstructions)
    if (result) {
      await updateSummarySection(supabase, contentIdVal, userId, { brief_overview: result }, language)
      sectionsGenerated.push("brief_overview")
    } else {
      failedSections.push("brief_overview")
      logger.warn(`API: [1/6] Brief overview failed.`)
    }
    return result
  })()

  const triagePromise = (async () => {
    const result = await generateTriage(text10K, contentType, userId, contentIdVal, webContext, languageDirective, preferencesBlock || null, metadataBlock, typeInstructions)
    if (result) {
      await updateSummarySection(supabase, contentIdVal, userId, { triage: result as unknown as Json }, language)
      sectionsGenerated.push("triage")
    } else {
      failedSections.push("triage")
      logger.warn(`API: [2/6] Triage failed.`)
    }
    return result
  })()

  const midSummaryPromise = (async () => {
    const summaryResult = await getModelSummary(text30K, { shouldExtractTitle: titleNeedsFixing, toneDirective, languageDirective, metadataBlock, typeInstructions, contentType })
    if (summaryResult && !("error" in summaryResult)) {
      const validSummary = summaryResult as ModelSummary
      if (titleNeedsFixing && validSummary.title) {
        await supabase.from("content").update({ title: validSummary.title }).eq("id", contentIdVal)
      }
      if (validSummary.mid_length_summary) {
        await updateSummarySection(supabase, contentIdVal, userId, { mid_length_summary: validSummary.mid_length_summary }, language)
        sectionsGenerated.push("mid_length_summary")
      }
    } else {
      failedSections.push("mid_length_summary")
      logger.warn(`API: [5/6] Mid-length summary failed.`)
    }
    return summaryResult
  })()

  const detailedPromise = (async () => {
    const result = await generateDetailedSummary(text30K, contentType, userId, contentIdVal, webContext, toneDirective, languageDirective, preferencesBlock || null, metadataBlock, typeInstructions)
    if (result) {
      await updateSummarySection(supabase, contentIdVal, userId, { detailed_summary: result }, language)
      sectionsGenerated.push("detailed_summary")
    } else {
      failedSections.push("detailed_summary")
      logger.warn(`API: [6/6] Detailed summary failed.`)
    }
    return result
  })()

  const autoTagPromise = (async () => {
    const tags = await generateAutoTags(text10K, contentType, userId, contentIdVal)
    if (tags && tags.length > 0) {
      await supabase
        .from("content")
        .update({ tags })
        .eq("id", contentIdVal)
    } else {
      logger.warn(`API: [tags] Auto-tag generation failed or empty.`)
    }
    return tags
  })()

  const truthCheckPromise = (async () => {
    const result = await generateTruthCheck(text20K, contentType, userId, contentIdVal, webContext, languageDirective, webSearchContext, preferencesBlock || null, claimContext, claimSearchCtx, metadataBlock, typeInstructions, domainCredibility)
    if (result) {
      // Will be saved after triage check
    } else {
      logger.warn(`API: [3/6] Truth check failed.`)
    }
    return result
  })()

  const actionItemsPromise = (async () => {
    const result = await generateActionItems(text15K, contentType, userId, contentIdVal, webContext, languageDirective, preferencesBlock || null, metadataBlock, typeInstructions)
    if (result) {
      // Will be saved after triage check
    } else {
      logger.warn(`API: [4/6] Action items failed.`)
    }
    return result
  })()

  // Promise.allSettled: one section crashing won't kill the others
  const phase2Results = await Promise.allSettled([
    overviewPromise, triagePromise, midSummaryPromise, detailedPromise, autoTagPromise,
    truthCheckPromise, actionItemsPromise,
  ])

  // Extract values — rejected promises return null (IIFEs already handle their own errors,
  // so rejection here means an unexpected crash, which we log and treat as a section failure)
  const phase2Values = phase2Results.map((r, i) => {
    if (r.status === "fulfilled") return r.value
    const sectionNames = ["brief_overview", "triage", "mid_length_summary", "detailed_summary", "auto_tags", "truth_check", "action_items"]
    logger.error(`API: Phase 2 section ${sectionNames[i]} crashed unexpectedly:`, r.reason)
    if (!failedSections.includes(sectionNames[i])) failedSections.push(sectionNames[i])
    return null
  })

  const [briefOverview, triage, , detailedSummary, , truthCheckResult, actionItemsResult] = phase2Values as [
    string | null, TriageData | null, unknown, string | null, unknown, TruthCheckData | null, ActionItemsData | null
  ]

  // Check pipeline timeout before post-processing
  if (pipelineAbort.signal.aborted) {
    clearTimeout(pipelineTimeoutId)
    logger.warn("API: Pipeline timeout hit after Phase 2, saving partial results")
    await updateSummarySection(supabase, contentIdVal, userId, { processing_status: "partial" }, language)
    return { success: true, cached: false, message: "Content partially processed (timeout).", contentId: content.id, sectionsGenerated, language, paywallWarning }
  }

  // Post-check: skip saving truth check + action items for music/entertainment
  const skipCategories = ["music", "entertainment"]
  const triageCategory = triage?.content_category
  const shouldSkipTruthCheck = triageCategory && skipCategories.includes(triageCategory)

  let truthCheck: TruthCheckData | null = null

  if (shouldSkipTruthCheck) {
    // Skip
  } else {
    if (truthCheckResult) {
      await updateSummarySection(supabase, contentIdVal, userId, { truth_check: truthCheckResult as unknown as Json }, language)
      sectionsGenerated.push("truth_check")
    } else {
      failedSections.push("truth_check")
    }

    if (actionItemsResult) {
      await updateSummarySection(supabase, contentIdVal, userId, { action_items: actionItemsResult as unknown as Json }, language)
      sectionsGenerated.push("action_items")
    }

    truthCheck = truthCheckResult
  }

  // AI refusal detection
  const aiSections = [
    { name: "brief_overview", content: briefOverview },
    { name: "triage", content: triage },
    { name: "detailed_summary", content: detailedSummary },
    { name: "truth_check", content: truthCheck },
  ]

  for (const section of aiSections) {
    const refusal = detectAiRefusal(section.content)
    if (refusal) {
      await persistFlag({
        contentId: contentIdVal,
        userId,
        url: contentUrl,
        contentType,
        flag: refusal,
        userIp: "internal",
        scrapedText: fullText,
      })
      logger.warn(`MODERATION: AI refused [${section.name}] for ${contentUrl}: ${refusal.reason}`)
    }
  }

  // Update domain stats
  if (contentUrl && triage) {
    await updateDomainStats(supabase, contentUrl, triage, truthCheck)
  }

  // Claim tracking
  if (truthCheck && userId) {
    try {
      await supabase.from("claims").delete().eq("content_id", contentIdVal)

      const claimsToInsert: Array<{
        content_id: string
        user_id: string
        claim_text: string
        normalized_text: string
        status: string
        severity: string | null
        sources: Json | null
      }> = []

      if (truthCheck.claims && truthCheck.claims.length > 0) {
        for (const claim of truthCheck.claims) {
          if (!claim.exact_text) continue
          claimsToInsert.push({
            content_id: contentIdVal,
            user_id: userId,
            claim_text: claim.exact_text,
            normalized_text: claim.exact_text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim(),
            status: claim.status,
            severity: claim.severity ?? null,
            sources: (claim.sources ?? null) as Json,
          })
        }
      }

      if (truthCheck.issues && truthCheck.issues.length > 0) {
        for (const issue of truthCheck.issues) {
          if (!issue.claim_or_issue) continue
          claimsToInsert.push({
            content_id: contentIdVal,
            user_id: userId,
            claim_text: issue.claim_or_issue,
            normalized_text: issue.claim_or_issue.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim(),
            status: issue.type,
            severity: issue.severity ?? null,
            sources: (issue.sources ? issue.sources.map(s => s.url) : null) as Json,
          })
        }
      }

      if (claimsToInsert.length > 0) {
        await supabase.from("claims").insert(claimsToInsert)
      }
    } catch (claimErr) {
      logger.warn("API: Failed to extract claims (non-fatal):", claimErr)
    }
  }

  // Self-healing: retry critical failures once
  const criticalSections = ["brief_overview", "triage", "detailed_summary"]
  const criticalFailures = failedSections.filter((s) => criticalSections.includes(s))

  if (criticalFailures.length > 0) {
    await Promise.all(criticalFailures.map(async (section) => {
      if (section === "brief_overview") {
        const result = await generateBriefOverview(fullText, contentType, userId, contentIdVal, null, toneDirective, languageDirective)
        if (result) {
          await updateSummarySection(supabase, contentIdVal, userId, { brief_overview: result }, language)
          sectionsGenerated.push("brief_overview")
        }
      } else if (section === "triage") {
        const result = await generateTriage(fullText, contentType, userId, contentIdVal, undefined, languageDirective)
        if (result) {
          await updateSummarySection(supabase, contentIdVal, userId, { triage: result as unknown as Json }, language)
          sectionsGenerated.push("triage")
          if (contentUrl) await updateDomainStats(supabase, contentUrl, result, truthCheck)
        }
      } else if (section === "detailed_summary") {
        const result = await generateDetailedSummary(fullText, contentType, userId, contentIdVal, null, toneDirective, languageDirective)
        if (result) {
          await updateSummarySection(supabase, contentIdVal, userId, { detailed_summary: result }, language)
          sectionsGenerated.push("detailed_summary")
        }
      }
    }))
  }

  // Clear pipeline timeout — we completed successfully
  clearTimeout(pipelineTimeoutId)

  // Mark processing complete
  await updateSummarySection(supabase, contentIdVal, userId, {
    processing_status: "complete",
  }, language)

  // Update content.analysis_language
  supabase.from("content").update({ analysis_language: language }).eq("id", contentIdVal).then(
    () => {},
    (err) => logger.warn("Failed to update analysis_language:", err)
  )

  // Usage already incremented atomically by enforceAndIncrementUsage() at top of processContent()

  return {
    success: true,
    cached: false,
    message: "Content processed successfully.",
    contentId: content.id,
    sectionsGenerated,
    language,
    paywallWarning,
  }
}

// ============================================
// RE-EXPORTS (public API for external consumers)
// ============================================

export { ProcessContentError }
export type { ProcessContentOptions, ProcessContentResult }

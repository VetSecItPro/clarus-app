/**
 * @module lib/pipeline/content-cache
 * @description Cross-user content caching for the analysis pipeline.
 *
 * When a URL has already been analyzed by another user, this module
 * finds the cached result and clones it to avoid redundant AI calls.
 * Cache staleness varies by content type (articles expire faster than
 * podcasts/PDFs).
 */

import { createClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/types/database.types"
import { normalizeUrl } from "@/lib/utils"
import { logger } from "@/lib/logger"

// Type-specific cache staleness: articles/tweets change frequently,
// podcasts/videos/PDFs are static once published
function getCacheStaleDays(contentType: string | null): number {
  switch (contentType) {
    case "article":
    case "x_post":
      return 3    // Articles/tweets are often updated or become stale quickly
    case "youtube":
    case "podcast":
      return 14   // Audio/video content doesn't change after publication
    case "pdf":
    case "document":
      return 30   // Static documents rarely change
    default:
      return 7    // Conservative default
  }
}

export interface CachedSourceFull {
  type: "full"
  content: Tables<"content">
  summary: Tables<"summaries">
}

export interface CachedSourceTextOnly {
  type: "text_only"
  content: Tables<"content">
}

export type CachedSource = CachedSourceFull | CachedSourceTextOnly | null

export async function findCachedAnalysis(
  supabase: ReturnType<typeof createClient<Database>>,
  url: string,
  targetLanguage: string,
  currentUserId: string,
  contentType: string | null = null,
): Promise<CachedSource> {
  if (url.startsWith("pdf://") || url.startsWith("file://")) return null

  const normalizedUrlValue = normalizeUrl(url)
  const stalenessDate = new Date()
  stalenessDate.setDate(stalenessDate.getDate() - getCacheStaleDays(contentType))

  const { data: candidates, error } = await supabase
    .from("content")
    .select("id, url, user_id, full_text, title, author, duration, thumbnail_url, description, upload_date, view_count, like_count, channel_id, raw_youtube_metadata, transcript_languages, detected_tone, tags, analysis_language, type, date_added, is_bookmarked, share_token, podcast_transcript_id, regeneration_count")
    .eq("url", normalizedUrlValue)
    .not("full_text", "is", null)
    .neq("user_id", currentUserId)
    .gte("date_added", stalenessDate.toISOString())
    .order("date_added", { ascending: false })
    .limit(5)

  if (error || !candidates || candidates.length === 0) return null

  const validCandidates = candidates.filter(
    (c) => c.full_text && !c.full_text.startsWith("PROCESSING_FAILED::")
  )
  if (validCandidates.length === 0) return null

  const candidateIds = validCandidates.map((c) => c.id)
  const { data: summaries } = await supabase
    .from("summaries")
    .select("id, content_id, user_id, model_name, created_at, updated_at, brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, topic_segments, processing_status, language")
    .in("content_id", candidateIds)
    .eq("language", targetLanguage)
    .eq("processing_status", "complete")

  if (summaries && summaries.length > 0) {
    const summaryByContentId = new Map(summaries.map((s) => [s.content_id, s]))
    for (const candidate of validCandidates) {
      const summary = summaryByContentId.get(candidate.id)
      if (summary) {
        return { type: "full", content: candidate, summary }
      }
    }
  }

  return { type: "text_only", content: validCandidates[0] }
}

export function buildMetadataCopyPayload(
  source: Tables<"content">
): Partial<Database["clarus"]["Tables"]["content"]["Update"]> {
  const payload: Partial<Database["clarus"]["Tables"]["content"]["Update"]> = {}

  if (source.title) payload.title = source.title
  if (source.author) payload.author = source.author
  if (source.duration) payload.duration = source.duration
  if (source.thumbnail_url) payload.thumbnail_url = source.thumbnail_url
  if (source.description) payload.description = source.description
  if (source.upload_date) payload.upload_date = source.upload_date
  if (source.view_count) payload.view_count = source.view_count
  if (source.like_count) payload.like_count = source.like_count
  if (source.channel_id) payload.channel_id = source.channel_id
  if (source.raw_youtube_metadata) payload.raw_youtube_metadata = source.raw_youtube_metadata
  if (source.transcript_languages) payload.transcript_languages = source.transcript_languages

  return payload
}

export async function cloneCachedContent(
  supabase: ReturnType<typeof createClient<Database>>,
  targetContentId: string,
  targetUserId: string,
  source: CachedSourceFull,
  targetLanguage: string,
): Promise<boolean> {
  try {
    const metadataPayload = buildMetadataCopyPayload(source.content)
    const contentUpdate: Partial<Database["clarus"]["Tables"]["content"]["Update"]> = {
      ...metadataPayload,
      full_text: source.content.full_text,
      detected_tone: source.content.detected_tone,
      tags: source.content.tags,
      analysis_language: targetLanguage,
    }

    const { error: contentError } = await supabase
      .from("content")
      .update(contentUpdate)
      .eq("id", targetContentId)

    if (contentError) {
      logger.error("API: [cache] Failed to update target content:", contentError)
      return false
    }

    const { error: summaryError } = await supabase
      .from("summaries")
      .upsert(
        {
          content_id: targetContentId,
          user_id: targetUserId,
          language: targetLanguage,
          brief_overview: source.summary.brief_overview,
          triage: source.summary.triage,
          truth_check: source.summary.truth_check,
          action_items: source.summary.action_items,
          mid_length_summary: source.summary.mid_length_summary,
          detailed_summary: source.summary.detailed_summary,
          topic_segments: source.summary.topic_segments,
          model_name: source.summary.model_name,
          processing_status: "complete",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "content_id,language" },
      )

    if (summaryError) {
      logger.error("API: [cache] Failed to upsert target summary:", summaryError)
      return false
    }

    return true
  } catch (err) {
    logger.error("API: [cache] Clone failed:", err)
    return false
  }
}

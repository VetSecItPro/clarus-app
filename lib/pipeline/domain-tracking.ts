/**
 * @module lib/pipeline/domain-tracking
 * @description Domain credibility tracking and entertainment URL detection.
 *
 * Tracks per-domain accuracy statistics across analyses and provides
 * credibility warnings for domains with poor track records.
 */

import { createClient } from "@supabase/supabase-js"
import type { Database, TriageData, TruthCheckData } from "@/types/database.types"
import { logger } from "@/lib/logger"

export async function updateSummarySection(
  supabase: ReturnType<typeof createClient<Database>>,
  contentId: string,
  userId: string,
  updates: Partial<Database["clarus"]["Tables"]["summaries"]["Update"]>,
  summaryLanguage: string = "en",
) {
  const { error } = await supabase
    .from("summaries")
    .upsert(
      {
        content_id: contentId,
        user_id: userId,
        language: summaryLanguage,
        updated_at: new Date().toISOString(),
        ...updates,
      },
      { onConflict: "content_id,language" },
    )

  if (error) {
    logger.error(`Failed to update summary section:`, error)
    return false
  }
  return true
}

export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace("www.", "")
  } catch {
    return null
  }
}

/**
 * Checks if a URL belongs to a known music/entertainment platform.
 * Used to skip expensive claim verification searches — music content
 * doesn't have factual claims worth verifying.
 */
const ENTERTAINMENT_DOMAINS = new Set([
  "open.spotify.com", "spotify.com",
  "music.youtube.com", "music.apple.com",
  "soundcloud.com", "tidal.com", "deezer.com",
  "bandcamp.com", "pandora.com", "audiomack.com",
  "genius.com", "azlyrics.com", "lyrics.com",
  "vimeo.com",
])

export function isEntertainmentUrl(url: string): boolean {
  const domain = extractDomain(url)
  if (!domain) return false
  return ENTERTAINMENT_DOMAINS.has(domain)
}

/**
 * Reads historical credibility data for a domain from past analyses.
 * Returns a warning string if the domain has a poor track record, or null if
 * the domain is new or has acceptable accuracy.
 *
 * Requires at least 3 prior analyses to avoid premature judgments.
 */
export async function getDomainCredibility(
  supabase: ReturnType<typeof createClient<Database>>,
  url: string,
): Promise<string | null> {
  const domain = extractDomain(url)
  if (!domain) return null

  const { data, error } = await supabase
    .from("domains")
    .select("total_analyses, accurate_count, mostly_accurate_count, mixed_count, questionable_count, unreliable_count, avg_quality_score")
    .eq("domain", domain)
    .maybeSingle()

  if (error || !data || data.total_analyses < 3) return null

  const total = data.total_analyses
  const unreliableRatio = (data.questionable_count + data.unreliable_count) / total

  // Only warn when >30% of past analyses flagged questionable or unreliable
  if (unreliableRatio <= 0.3) return null

  const pct = Math.round(unreliableRatio * 100)
  return `## Source Credibility Warning\nThis content is from ${domain}, which has been rated "Questionable" or "Unreliable" in ${pct}% of ${total} previous analyses (avg quality score: ${data.avg_quality_score?.toFixed(1) ?? "N/A"}/10). Apply extra scrutiny to factual claims from this source.`
}

export async function updateDomainStats(
  supabase: ReturnType<typeof createClient<Database>>,
  url: string,
  triage: TriageData | null,
  truthCheck: TruthCheckData | null
) {
  const domain = extractDomain(url)
  if (!domain) return

  const qualityScore = triage?.quality_score || 0
  const rating = truthCheck?.overall_rating

  const { error } = await supabase.rpc("upsert_domain_stats", {
    p_domain: domain,
    p_quality_score: qualityScore,
    p_accurate: rating === "Accurate" ? 1 : 0,
    p_mostly_accurate: rating === "Mostly Accurate" ? 1 : 0,
    p_mixed: rating === "Mixed" ? 1 : 0,
    p_questionable: rating === "Questionable" ? 1 : 0,
    p_unreliable: rating === "Unreliable" ? 1 : 0,
  })

  if (error) {
    logger.warn(`Domain stats RPC failed, using fallback:`, error)
    await supabase.from("domains").upsert({
      domain,
      total_analyses: 1,
      total_quality_score: qualityScore,
      ...(rating === "Accurate" && { accurate_count: 1 }),
      ...(rating === "Mostly Accurate" && { mostly_accurate_count: 1 }),
      ...(rating === "Mixed" && { mixed_count: 1 }),
      ...(rating === "Questionable" && { questionable_count: 1 }),
      ...(rating === "Unreliable" && { unreliable_count: 1 }),
      last_seen: new Date().toISOString(),
    }, { onConflict: "domain" })
  }
}

/**
 * @module api/account/export
 * @description GDPR Article 20 — Right to Data Portability.
 *
 * Returns a JSON file containing all user data across all Clarus tables.
 * The export includes content, analyses, chat history, collections,
 * subscriptions, preferences, and account metadata.
 *
 * GET — Streams a JSON download of all user data.
 */

import { NextResponse } from "next/server"
import { authenticateRequest, getAdminClient } from "@/lib/auth"
import { logger } from "@/lib/logger"

export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const { user } = auth

  // Use admin client to bypass RLS for full data export
  const admin = getAdminClient()
  const userId = user.id

  try {
    // Fetch all user data in parallel across all Clarus tables
    const [
      userData,
      content,
      summaries,
      chatThreads,
      chatMessages,
      collections,
      collectionItems,
      contentRatings,
      claims,
      sectionFeedback,
      podcastSubscriptions,
      youtubeSubscriptions,
      usageTracking,
      apiUsage,
      preferences,
      hiddenContent,
    ] = await Promise.all([
      admin.from("users").select("*").eq("id", userId).single(),
      admin.from("content").select("id, url, type, title, author, description, date_added, tags, is_bookmarked, detected_tone, analysis_language, status").eq("user_id", userId),
      admin.from("summaries").select("content_id, quick_assessment, detailed_analysis, key_claims, action_items, truth_check, triage, processing_status").eq("user_id", userId),
      admin.from("chat_threads").select("id, content_id, created_at").eq("user_id", userId),
      // Chat messages are linked via thread, not user_id directly
      admin.from("chat_threads").select("id").eq("user_id", userId).then(async (threads) => {
        if (!threads.data?.length) return { data: [], error: null }
        const threadIds = threads.data.map(t => t.id)
        return admin.from("chat_messages").select("thread_id, role, content, created_at").in("thread_id", threadIds).order("created_at", { ascending: true })
      }),
      admin.from("collections").select("id, name, description, created_at").eq("user_id", userId),
      // Collection items linked via collection
      admin.from("collections").select("id").eq("user_id", userId).then(async (cols) => {
        if (!cols.data?.length) return { data: [], error: null }
        const colIds = cols.data.map(c => c.id)
        return admin.from("collection_items").select("collection_id, content_id, added_at").in("collection_id", colIds)
      }),
      admin.from("content_ratings").select("content_id, signal_score, created_at").eq("user_id", userId),
      admin.from("claims").select("content_id, claim_text, claim_index, flag_reason, created_at").eq("user_id", userId),
      admin.from("section_feedback").select("content_id, section_key, is_positive, created_at").eq("user_id", userId),
      admin.from("podcast_subscriptions").select("id, rss_url, title, created_at").eq("user_id", userId),
      admin.from("youtube_subscriptions").select("id, channel_id, channel_title, created_at").eq("user_id", userId),
      admin.from("usage_tracking").select("period, analyses_count, chat_messages_count, share_links_count, exports_count, bookmarks_count, podcast_analyses_count").eq("user_id", userId),
      admin.from("api_usage").select("model, input_tokens, output_tokens, cost_usd, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
      admin.from("user_analysis_preferences").select("*").eq("user_id", userId).single(),
      // hidden_content not in generated types yet — cast to bypass
      (admin.from as (t: string) => ReturnType<typeof admin.from>)("hidden_content").select("content_id, hidden_at").eq("user_id", userId),
    ])

    // Strip sensitive internal fields from user data
    const safeUser = userData.data ? {
      id: userData.data.id,
      email: userData.data.email,
      name: userData.data.name,
      tier: userData.data.tier,
      created_at: userData.data.created_at,
      digest_enabled: userData.data.digest_enabled,
    } : null

    const exportData = {
      exported_at: new Date().toISOString(),
      format_version: "1.0",
      account: safeUser,
      content: content.data ?? [],
      analyses: summaries.data ?? [],
      chat_threads: chatThreads.data ?? [],
      chat_messages: chatMessages.data ?? [],
      collections: collections.data ?? [],
      collection_items: collectionItems.data ?? [],
      ratings: contentRatings.data ?? [],
      claims: claims.data ?? [],
      section_feedback: sectionFeedback.data ?? [],
      podcast_subscriptions: podcastSubscriptions.data ?? [],
      youtube_subscriptions: youtubeSubscriptions.data ?? [],
      usage_history: usageTracking.data ?? [],
      api_usage: apiUsage.data ?? [],
      preferences: preferences.data ?? null,
      hidden_content: hiddenContent.data ?? [],
    }

    const json = JSON.stringify(exportData, null, 2)

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="clarus-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (err) {
    logger.error("[account/export] Failed to export data:", err)
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 })
  }
}

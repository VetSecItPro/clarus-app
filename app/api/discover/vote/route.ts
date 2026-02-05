// SECURITY: FIX-SEC-027 — Use authenticated client for reads and vote CRUD (RLS enforces ownership).
// Admin client is only used for the vote_score denormalization update, which writes to another
// user's content row (no RLS UPDATE policy for cross-user writes).
import { NextResponse } from "next/server"
import { authenticateRequest, AuthErrors, getAdminClient } from "@/lib/auth"
import { checkRateLimit } from "@/lib/validation"
import { z } from "zod"
import { parseBody } from "@/lib/schemas"

/**
 * POST /api/discover/vote
 * Vote on public content. Upserts the user's vote and updates
 * the denormalized vote_score on the content table.
 */

const voteSchema = z.object({
  contentId: z.string().uuid("Invalid content ID"),
  vote: z.union([z.literal(1), z.literal(-1)]),
})

export async function POST(request: Request) {
  // Authenticate
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  // Rate limit: 60/minute per user
  const rateLimit = checkRateLimit(`vote:${auth.user.id}`, 60, 60000)
  if (!rateLimit.allowed) {
    return AuthErrors.rateLimit(rateLimit.resetIn)
  }

  // Validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return AuthErrors.badRequest("Invalid JSON body")
  }

  const parsed = parseBody(voteSchema, body)
  if (!parsed.success) {
    return AuthErrors.badRequest(parsed.error)
  }

  const { contentId, vote } = parsed.data

  try {
    // Use authenticated client for reads and vote CRUD — RLS policies enforce:
    // - content_select_public: can read is_public=true content from any user
    // - content_votes_*_own: can only insert/update/delete own votes
    const supabase = auth.supabase

    // Verify content exists and is public (RLS: content_select_public allows this)
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("id, is_public, user_id")
      .eq("id", contentId)
      .eq("is_public", true)
      .single()

    if (contentError || !content) {
      return AuthErrors.notFound("Content")
    }

    // Prevent self-voting
    if (content.user_id === auth.user.id) {
      return AuthErrors.badRequest("Cannot vote on your own content")
    }

    // Check if user already has a vote (RLS: content_votes_select_authenticated)
    const { data: existingVote } = await supabase
      .from("content_votes")
      .select("id, vote")
      .eq("content_id", contentId)
      .eq("user_id", auth.user.id)
      .maybeSingle()

    if (existingVote) {
      if (existingVote.vote === vote) {
        // Same vote = remove vote (toggle off) (RLS: content_votes_delete_own)
        const { error: deleteError } = await supabase
          .from("content_votes")
          .delete()
          .eq("id", existingVote.id)

        if (deleteError) {
          console.error("Vote delete error:", deleteError)
          return AuthErrors.serverError()
        }
      } else {
        // Different vote = update (RLS: content_votes_update_own)
        const { error: updateError } = await supabase
          .from("content_votes")
          .update({ vote })
          .eq("id", existingVote.id)

        if (updateError) {
          console.error("Vote update error:", updateError)
          return AuthErrors.serverError()
        }
      }
    } else {
      // New vote (RLS: content_votes_insert_own)
      const { error: insertError } = await supabase
        .from("content_votes")
        .insert({
          content_id: contentId,
          user_id: auth.user.id,
          vote,
        })

      if (insertError) {
        console.error("Vote insert error:", insertError)
        return AuthErrors.serverError()
      }
    }

    // SECURITY: FIX-SEC-008 — Recompute vote_score from source of truth (votes table)
    // to prevent race conditions. Uses authenticated client for the read (all votes are
    // visible to authenticated users), but admin client for the cross-user content update.
    const { data: allVotes } = await supabase
      .from("content_votes")
      .select("vote")
      .eq("content_id", contentId)

    const newScore = allVotes?.reduce((sum, v) => sum + (v.vote ?? 0), 0) ?? 0

    // Admin client required: updating vote_score on another user's content row
    // (no RLS UPDATE policy for cross-user writes on content table)
    const adminClient = getAdminClient()
    const { error: scoreError } = await adminClient
      .from("content")
      .update({ vote_score: newScore })
      .eq("id", contentId)

    if (scoreError) {
      console.error("Score update error:", scoreError)
      // Non-fatal: the vote was recorded, score will be eventually consistent
    }

    // Determine the user's current vote state
    const userVote = existingVote?.vote === vote ? null : vote

    return NextResponse.json({
      success: true,
      voteScore: newScore,
      userVote,
    })
  } catch (error) {
    console.error("Vote API error:", error)
    return AuthErrors.serverError()
  }
}

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
    const adminClient = getAdminClient()

    // Verify content exists and is public
    const { data: content, error: contentError } = await adminClient
      .from("content")
      .select("id, is_public, user_id")
      .eq("id", contentId)
      .single()

    if (contentError || !content) {
      return AuthErrors.notFound("Content")
    }

    if (!content.is_public) {
      return AuthErrors.badRequest("Cannot vote on private content")
    }

    // Prevent self-voting
    if (content.user_id === auth.user.id) {
      return AuthErrors.badRequest("Cannot vote on your own content")
    }

    // Check if user already has a vote
    const { data: existingVote } = await adminClient
      .from("content_votes")
      .select("id, vote")
      .eq("content_id", contentId)
      .eq("user_id", auth.user.id)
      .maybeSingle()

    let voteChange = 0

    if (existingVote) {
      if (existingVote.vote === vote) {
        // Same vote = remove vote (toggle off)
        const { error: deleteError } = await adminClient
          .from("content_votes")
          .delete()
          .eq("id", existingVote.id)

        if (deleteError) {
          console.error("Vote delete error:", deleteError)
          return AuthErrors.serverError()
        }

        // Reverse the existing vote
        voteChange = -existingVote.vote
      } else {
        // Different vote = update
        const { error: updateError } = await adminClient
          .from("content_votes")
          .update({ vote })
          .eq("id", existingVote.id)

        if (updateError) {
          console.error("Vote update error:", updateError)
          return AuthErrors.serverError()
        }

        // Swing from old vote to new vote
        voteChange = vote - existingVote.vote
      }
    } else {
      // New vote
      const { error: insertError } = await adminClient
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

      voteChange = vote
    }

    // Update denormalized vote_score
    const currentScore = (
      await adminClient
        .from("content")
        .select("vote_score")
        .eq("id", contentId)
        .single()
    ).data?.vote_score ?? 0

    const newScore = currentScore + voteChange

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

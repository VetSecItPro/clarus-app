import { NextResponse } from "next/server"
import { authenticateRequest, verifyContentOwnership } from "@/lib/auth"
import { uuidSchema } from "@/lib/schemas"
import { getUserTier } from "@/lib/usage"
import { TIER_FEATURES } from "@/lib/tier-limits"
import { checkRateLimit } from "@/lib/rate-limit"

export interface CrossReference {
  claimText: string
  matches: Array<{
    contentId: string
    contentTitle: string
    claimText: string
    status: string
    similarityScore: number
  }>
}

/**
 * GET /api/content/[id]/cross-references
 * Find claims from this content that appear in other analyses
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  // Rate limiting - expensive RPC calls
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rateLimit = await checkRateLimit(`crossref:${auth.user.id}`, 20, 60000) // 20 per minute per user
  const ipRateLimit = await checkRateLimit(`crossref:ip:${clientIp}`, 30, 60000) // 30 per minute per IP
  if (!rateLimit.allowed || !ipRateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    )
  }

  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content ID" }, { status: 400 })
  }

  // PERF: Parallelize tier check and ownership verification
  const [tier, ownership] = await Promise.all([
    getUserTier(auth.supabase, auth.user.id),
    verifyContentOwnership(auth.supabase, auth.user.id, parsed.data),
  ])

  if (!TIER_FEATURES[tier].claimTracking) {
    return NextResponse.json(
      { error: "Claim tracking requires a Pro subscription.", upgrade: true },
      { status: 403 }
    )
  }

  if (!ownership.owned) return ownership.response

  // Get claims for this content
  const { data: claims, error: claimsError } = await auth.supabase
    .from("claims")
    .select("id, claim_text")
    .eq("content_id", parsed.data)
    .eq("user_id", auth.user.id)

  if (claimsError || !claims || claims.length === 0) {
    return NextResponse.json({ success: true, crossReferences: [] })
  }

  // Find similar claims in parallel (limit to first 20 claims to avoid overload)
  const claimsToCheck = claims.slice(0, 20)

  const results = await Promise.all(
    claimsToCheck.map(async (claim) => {
      const { data: similar } = await auth.supabase.rpc("find_similar_claims", {
        p_user_id: auth.user.id,
        p_claim_text: claim.claim_text,
        p_content_id: parsed.data,
        p_threshold: 0.4,
        p_limit: 5,
      })

      if (similar && similar.length > 0) {
        return {
          claimText: claim.claim_text,
          matches: similar.map((s: {
            content_id: string
            content_title: string
            claim_text: string
            status: string
            similarity_score: number
          }) => ({
            contentId: s.content_id,
            contentTitle: s.content_title,
            claimText: s.claim_text,
            status: s.status,
            similarityScore: s.similarity_score,
          })),
        } as CrossReference
      }
      return null
    })
  )

  const crossReferences = results.filter((r): r is CrossReference => r !== null)

  const response = NextResponse.json({ success: true, crossReferences })
  response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=600")
  return response
}

import { NextResponse } from "next/server"
import { authenticateRequest, verifyContentOwnership } from "@/lib/auth"
import { uuidSchema } from "@/lib/schemas"
import { generateShareToken } from "@/lib/share-token"
import { checkRateLimit } from "@/lib/validation"
import { enforceUsageLimit, incrementUsage } from "@/lib/usage"
import { TIER_FEATURES, normalizeTier } from "@/lib/tier-limits"

/**
 * GET /api/content/[id]/share-link
 * Retrieve existing share token for content
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content ID" }, { status: 400 })
  }

  const ownership = await verifyContentOwnership(auth.supabase, auth.user.id, parsed.data)
  if (!ownership.owned) return ownership.response

  const shareToken = ownership.content.share_token ?? null

  return NextResponse.json({
    success: true,
    share_token: shareToken,
    share_url: shareToken ? `${getBaseUrl()}/share/${shareToken}` : null,
  })
}

/**
 * POST /api/content/[id]/share-link
 * Generate a new share token (or return existing one)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  const rateLimitResult = checkRateLimit(`share-link:${auth.user.id}`, 20, 60000)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimitResult.resetIn / 1000)) } }
    )
  }

  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content ID" }, { status: 400 })
  }

  const ownership = await verifyContentOwnership(auth.supabase, auth.user.id, parsed.data)
  if (!ownership.owned) return ownership.response

  // Tier feature check: share links require starter+
  const { data: userData } = await auth.supabase
    .from("users")
    .select("tier")
    .eq("id", auth.user.id)
    .single()
  const tier = normalizeTier(userData?.tier)
  if (!TIER_FEATURES[tier].shareLinks) {
    return NextResponse.json(
      { error: "Share links require a Starter or Pro plan.", upgrade_required: true, tier },
      { status: 403 }
    )
  }

  // Return existing token if already generated
  if (ownership.content.share_token) {
    return NextResponse.json({
      success: true,
      share_token: ownership.content.share_token,
      share_url: `${getBaseUrl()}/share/${ownership.content.share_token}`,
    })
  }

  // Usage limit check
  const usageCheck = await enforceUsageLimit(auth.supabase, auth.user.id, "share_links_count")
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: `Monthly share link limit reached (${usageCheck.limit}).`, upgrade_required: true, tier: usageCheck.tier },
      { status: 403 }
    )
  }

  // Generate new token with retry for uniqueness
  let token: string | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidate = generateShareToken()
    const { error } = await auth.supabase
      .from("content")
      .update({ share_token: candidate })
      .eq("id", parsed.data)

    if (!error) {
      token = candidate
      break
    }
    // Unique constraint violation — retry with new token
    if (error.code === "23505") continue
    return NextResponse.json({ error: "Failed to generate share link" }, { status: 500 })
  }

  if (!token) {
    return NextResponse.json({ error: "Failed to generate unique share link" }, { status: 500 })
  }

  // Track usage
  await incrementUsage(auth.supabase, auth.user.id, "share_links_count")

  // Suppress unused variable warning - request is required by Next.js route signature
  void request

  return NextResponse.json({
    success: true,
    share_token: token,
    share_url: `${getBaseUrl()}/share/${token}`,
  })
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "https://clarusapp.io"
}

import type { TruthCheckData, TriageData, ActionItemsData, ClaimHighlight } from "@/types/database.types"
import { authenticateRequest, verifyContentOwnership, AuthErrors } from "@/lib/auth"
import { exportSchema, parseQuery } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/validation"
import { enforceUsageLimit, incrementUsage } from "@/lib/usage"
import { TIER_FEATURES, normalizeTier } from "@/lib/tier-limits"

export async function GET(request: Request) {
  try {
    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`export-md:${clientIp}`, 20, 60000) // 20 per minute
    if (!rateLimit.allowed) {
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // Authenticate user
    const auth = await authenticateRequest()
    if (!auth.success) {
      return auth.response
    }

    // Validate input
    const { searchParams } = new URL(request.url)
    const validation = parseQuery(exportSchema, searchParams)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    const contentId = validation.data.id

    // Tier feature check: exports require starter+
    const { data: userData } = await auth.supabase
      .from("users")
      .select("tier")
      .eq("id", auth.user.id)
      .single()
    const tier = normalizeTier(userData?.tier)
    if (!TIER_FEATURES[tier].exports) {
      return new Response(
        JSON.stringify({ error: "Exports require a Starter or Pro plan.", upgrade_required: true, tier }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }

    // Usage limit check
    const usageCheck = await enforceUsageLimit(auth.supabase, auth.user.id, "exports_count")
    if (!usageCheck.allowed) {
      return new Response(
        JSON.stringify({ error: `Monthly export limit reached (${usageCheck.limit}).`, upgrade_required: true, tier: usageCheck.tier }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }

    // Verify ownership
    const ownership = await verifyContentOwnership(auth.supabase, auth.user.id, contentId)
    if (!ownership.owned) {
      return ownership.response
    }

    const content = ownership.content

    // Fetch summary
    const { data: summary } = await auth.supabase
      .from("summaries")
      .select("*")
      .eq("content_id", contentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Build markdown document
    const markdown = generateMarkdown(content, summary)

    // Create filename
    const safeTitle = (content.title || "report")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 50)
    const filename = `clarus-${safeTitle}.md`

    // Track export usage
    await incrementUsage(auth.supabase, auth.user.id, "exports_count")

    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (error) {
    console.error("Markdown export error:", error)
    return new Response("Export failed", { status: 500 })
  }
}

function generateMarkdown(content: Record<string, unknown>, summary: Record<string, unknown> | null): string {
  const lines: string[] = []

  // Title
  lines.push(`# ${content.title || "Content Analysis"}`)
  lines.push("")

  // Metadata
  lines.push("## Source Information")
  lines.push("")
  if (content.url) {
    lines.push(`**URL:** ${content.url}`)
  }
  if (content.type) {
    lines.push(`**Type:** ${String(content.type).charAt(0).toUpperCase() + String(content.type).slice(1)}`)
  }
  if (content.created_at) {
    lines.push(`**Analyzed:** ${new Date(content.created_at as string).toLocaleDateString()}`)
  }
  if (content.duration && typeof content.duration === "number") {
    const mins = Math.floor(content.duration / 60)
    const secs = content.duration % 60
    lines.push(`**Duration:** ${mins}:${secs.toString().padStart(2, "0")}`)
  }
  lines.push("")

  if (!summary) {
    lines.push("*Analysis pending...*")
    return lines.join("\n")
  }

  // Accuracy Analysis (most important - put first)
  const truthCheck = summary.truth_check as TruthCheckData | null
  if (truthCheck) {
    lines.push("---")
    lines.push("")
    lines.push("## Accuracy Analysis")
    lines.push("")
    lines.push(`**Overall Rating:** ${truthCheck.overall_rating}`)
    lines.push("")

    // Claims (if available)
    if (truthCheck.claims && truthCheck.claims.length > 0) {
      lines.push("### Claims Analyzed")
      lines.push("")
      for (const claim of truthCheck.claims) {
        const statusEmoji = getStatusEmoji(claim.status)
        lines.push(`${statusEmoji} **"${claim.exact_text}"**`)
        lines.push(`   - Status: ${claim.status}`)
        lines.push(`   - ${claim.explanation}`)
        if (claim.sources && claim.sources.length > 0) {
          lines.push(`   - Sources: ${claim.sources.join(", ")}`)
        }
        lines.push("")
      }
    }

    // Issues
    if (truthCheck.issues && truthCheck.issues.length > 0) {
      lines.push("### Issues Found")
      lines.push("")
      for (const issue of truthCheck.issues) {
        const emoji = getIssueEmoji(issue.type)
        lines.push(`${emoji} **${issue.claim_or_issue}**`)
        lines.push(`   - ${issue.assessment}`)
        lines.push(`   - Severity: ${issue.severity}`)
        if (issue.timestamp) {
          lines.push(`   - Timestamp: ${issue.timestamp}`)
        }
        lines.push("")
      }
    }

    // Strengths
    if (truthCheck.strengths && truthCheck.strengths.length > 0) {
      lines.push("### Strengths")
      lines.push("")
      for (const strength of truthCheck.strengths) {
        lines.push(`- ${strength}`)
      }
      lines.push("")
    }

    // Sources Quality
    if (truthCheck.sources_quality) {
      lines.push(`**Sources Quality:** ${truthCheck.sources_quality}`)
      lines.push("")
    }
  }

  // Overview
  if (summary.brief_overview) {
    lines.push("---")
    lines.push("")
    lines.push("## Overview")
    lines.push("")
    lines.push(summary.brief_overview as string)
    lines.push("")
  }

  // Triage/Quick Assessment
  const triage = summary.triage as TriageData | null
  if (triage) {
    lines.push("---")
    lines.push("")
    lines.push("## Quick Assessment")
    lines.push("")
    lines.push(`**Quality Score:** ${triage.quality_score}/10`)
    lines.push(`**Worth Your Time:** ${triage.worth_your_time}`)
    lines.push(`**Content Density:** ${triage.content_density}`)
    if (triage.target_audience && triage.target_audience.length > 0) {
      lines.push(`**Target Audience:** ${triage.target_audience.join(", ")}`)
    }
    if (triage.estimated_value) {
      lines.push(`**Estimated Value:** ${triage.estimated_value}`)
    }
    lines.push("")
  }

  // Action Items
  const actionItems = summary.action_items as ActionItemsData | null
  if (actionItems && actionItems.length > 0) {
    lines.push("---")
    lines.push("")
    lines.push("## Action Items")
    lines.push("")
    for (const item of actionItems) {
      const priorityEmoji = item.priority === "high" ? "!!" : item.priority === "medium" ? "!" : ""
      lines.push(`### ${priorityEmoji} ${item.title}`)
      lines.push("")
      lines.push(item.description)
      if (item.category) {
        lines.push(`*Category: ${item.category}*`)
      }
      lines.push("")
    }
  }

  // Detailed Summary
  if (summary.detailed_summary) {
    lines.push("---")
    lines.push("")
    lines.push("## Detailed Analysis")
    lines.push("")
    lines.push(summary.detailed_summary as string)
    lines.push("")
  }

  // Footer
  lines.push("---")
  lines.push("")
  lines.push(`*Generated by [Clarus](https://clarusapp.io) on ${new Date().toLocaleDateString()}*`)

  return lines.join("\n")
}

function getStatusEmoji(status: ClaimHighlight["status"]): string {
  switch (status) {
    case "verified": return "✅"
    case "false": return "❌"
    case "disputed": return "⚠️"
    case "unverified": return "❓"
    case "opinion": return "💭"
    default: return "•"
  }
}

function getIssueEmoji(type: string): string {
  switch (type) {
    case "misinformation": return "🚫"
    case "misleading": return "⚠️"
    case "bias": return "⚖️"
    case "unjustified_certainty": return "❓"
    case "missing_context": return "📝"
    default: return "⚠️"
  }
}

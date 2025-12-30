import { createClient } from "@supabase/supabase-js"
import type { TruthCheckData, TriageData, ActionItemsData, ClaimHighlight } from "@/types/database.types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const contentId = searchParams.get("id")

    if (!contentId) {
      return new Response("Missing content ID", { status: 400 })
    }

    // Fetch content and summary
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("*")
      .eq("id", contentId)
      .single()

    if (contentError || !content) {
      return new Response("Content not found", { status: 404 })
    }

    const { data: summary } = await supabase
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
    const filename = `truth-check-${safeTitle}.md`

    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
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

  // Truth Check (most important - put first)
  const truthCheck = summary.truth_check as TruthCheckData | null
  if (truthCheck) {
    lines.push("---")
    lines.push("")
    lines.push("## Truth Check")
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
  lines.push(`*Generated by [Truth Checker](https://clarusapp.io) on ${new Date().toLocaleDateString()}*`)

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

import type { TruthCheckData, TriageData, ActionItemsData, ClaimHighlight } from "@/types/database.types"
import { authenticateRequest, verifyContentOwnership, AuthErrors } from "@/lib/auth"
import { exportSchema, parseQuery } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/rate-limit"
import { enforceAndIncrementUsage } from "@/lib/usage"
import { TIER_FEATURES, normalizeTier } from "@/lib/tier-limits"
import { logger } from "@/lib/logger"

// PERF: FIX-213 — set maxDuration for serverless function (PDF generation can be slow)
export const maxDuration = 30

// Color palette
const COLORS = {
  primary: [29, 155, 240] as [number, number, number], // #1d9bf0
  text: [31, 41, 55] as [number, number, number], // gray-800
  textLight: [107, 114, 128] as [number, number, number], // gray-500
  success: [16, 185, 129] as [number, number, number], // emerald-500
  error: [239, 68, 68] as [number, number, number], // red-500
  warning: [245, 158, 11] as [number, number, number], // amber-500
  info: [59, 130, 246] as [number, number, number], // blue-500
}

export async function GET(request: Request) {
  try {
    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = await checkRateLimit(`export-pdf:${clientIp}`, 20, 60000) // 20 per minute
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
    const lang = searchParams.get("language") || "en"

    // PERF: Parallelize tier check, usage check, ownership verification, and summary fetch
    const [userDataResult, ownership, summaryResult] = await Promise.all([
      auth.supabase
        .from("users")
        .select("tier, day_pass_expires_at")
        .eq("id", auth.user.id)
        .single(),
      verifyContentOwnership(auth.supabase, auth.user.id, contentId),
      auth.supabase
        .from("summaries")
        .select("brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, processing_status")
        .eq("content_id", contentId)
        .eq("language", lang)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    // Tier feature check: exports require starter+
    const tier = normalizeTier(userDataResult.data?.tier, userDataResult.data?.day_pass_expires_at)
    if (!TIER_FEATURES[tier].exports) {
      return new Response(
        JSON.stringify({ error: "Exports require a Starter or Pro plan.", upgrade_required: true, tier }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }

    // Verify ownership
    if (!ownership.owned) {
      return ownership.response
    }

    // Atomic usage check + increment (after pre-conditions pass, so no wasted credits)
    const usageCheck = await enforceAndIncrementUsage(auth.supabase, auth.user.id, "exports_count")
    if (!usageCheck.allowed) {
      return new Response(
        JSON.stringify({ error: `Monthly export limit reached (${usageCheck.limit}).`, upgrade_required: true, tier: usageCheck.tier }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }

    const content = ownership.content
    const summary = summaryResult.data

    // Generate PDF
    const pdfBytes = await generatePDF(content, summary)

    // Create filename
    const safeTitle = (content.title || "report")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 50)
    const filename = `clarus-${safeTitle}.pdf`

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (error) {
    logger.error("PDF export error:", error)
    return new Response("Export failed", { status: 500 })
  }
}

async function generatePDF(content: Record<string, unknown>, summary: Record<string, unknown> | null): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Helper functions
  const addPage = () => {
    doc.addPage()
    y = margin
  }

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      addPage()
      return true
    }
    return false
  }

  const drawLine = () => {
    doc.setDrawColor(...COLORS.textLight)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5
  }

  const addText = (text: string, options: {
    size?: number
    color?: [number, number, number]
    bold?: boolean
    maxWidth?: number
    align?: "left" | "center" | "right"
  } = {}) => {
    const {
      size = 10,
      color = COLORS.text,
      bold = false,
      maxWidth = contentWidth,
      align = "left"
    } = options

    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.setFont("helvetica", bold ? "bold" : "normal")

    const lines = doc.splitTextToSize(text, maxWidth)
    const lineHeight = size * 0.5

    for (const line of lines) {
      checkPageBreak(lineHeight)

      let x = margin
      if (align === "center") {
        x = pageWidth / 2
      } else if (align === "right") {
        x = pageWidth - margin
      }

      doc.text(line, x, y, { align })
      y += lineHeight
    }

    return lines.length * lineHeight
  }

  // === HEADER ===
  // Title
  addText(content.title as string || "Content Analysis", {
    size: 20,
    color: COLORS.text,
    bold: true,
    maxWidth: contentWidth - 40
  })
  y += 3

  // Source URL
  if (content.url) {
    addText(content.url as string, {
      size: 8,
      color: COLORS.primary,
      maxWidth: contentWidth
    })
  }
  y += 2

  // Metadata line
  const metaParts: string[] = []
  if (content.type) {
    metaParts.push(String(content.type).charAt(0).toUpperCase() + String(content.type).slice(1))
  }
  if (content.created_at) {
    metaParts.push(`Analyzed: ${new Date(content.created_at as string).toLocaleDateString()}`)
  }
  if (content.duration && typeof content.duration === "number") {
    const mins = Math.floor(content.duration / 60)
    const secs = content.duration % 60
    metaParts.push(`Duration: ${mins}:${secs.toString().padStart(2, "0")}`)
  }
  if (metaParts.length > 0) {
    addText(metaParts.join(" | "), { size: 9, color: COLORS.textLight })
  }
  y += 5

  drawLine()

  if (!summary) {
    addText("Analysis pending...", { size: 12, color: COLORS.textLight })
    return doc.output("arraybuffer")
  }

  // === ACCURACY ANALYSIS ===
  const truthCheck = summary.truth_check as TruthCheckData | null
  if (truthCheck) {
    y += 3
    addText("ACCURACY ANALYSIS", { size: 14, color: COLORS.primary, bold: true })
    y += 2

    // Overall Rating with colored background
    const ratingColor = getRatingColor(truthCheck.overall_rating)
    addText(`Overall Rating: ${truthCheck.overall_rating}`, {
      size: 12,
      color: ratingColor,
      bold: true
    })
    y += 5

    // Claims
    if (truthCheck.claims && truthCheck.claims.length > 0) {
      addText("Claims Analyzed", { size: 11, color: COLORS.text, bold: true })
      y += 3

      for (const claim of truthCheck.claims) {
        checkPageBreak(20)

        const statusColor = getStatusColor(claim.status)
        const statusLabel = claim.status.charAt(0).toUpperCase() + claim.status.slice(1)

        // Status badge
        addText(`[${statusLabel}]`, { size: 9, color: statusColor, bold: true })

        // Claim text
        addText(`"${claim.exact_text}"`, { size: 10, color: COLORS.text })

        // Explanation
        addText(claim.explanation, { size: 9, color: COLORS.textLight })

        if (claim.sources && claim.sources.length > 0) {
          addText(`Sources: ${claim.sources.join(", ")}`, { size: 8, color: COLORS.info })
        }
        y += 3
      }
    }

    // Issues
    if (truthCheck.issues && truthCheck.issues.length > 0) {
      checkPageBreak(15)
      y += 2
      addText("Issues Found", { size: 11, color: COLORS.text, bold: true })
      y += 3

      for (const issue of truthCheck.issues) {
        checkPageBreak(15)

        const severityColor = issue.severity === "high" ? COLORS.error :
                             issue.severity === "medium" ? COLORS.warning : COLORS.textLight

        addText(`[${issue.severity.toUpperCase()}] ${issue.claim_or_issue}`, {
          size: 10,
          color: severityColor,
          bold: true
        })
        addText(issue.assessment, { size: 9, color: COLORS.textLight })
        if (issue.sources && issue.sources.length > 0) {
          const sourceText = issue.sources.map(s => `${s.title}: ${s.url}`).join(" | ")
          addText(`Sources: ${sourceText}`, { size: 8, color: COLORS.info })
        }
        y += 2
      }
    }

    // Strengths
    if (truthCheck.strengths && truthCheck.strengths.length > 0) {
      checkPageBreak(15)
      y += 2
      addText("Strengths", { size: 11, color: COLORS.success, bold: true })
      y += 2

      for (const strength of truthCheck.strengths) {
        checkPageBreak(8)
        addText(`+ ${strength}`, { size: 9, color: COLORS.text })
      }
    }

    y += 5
    drawLine()
  }

  // === OVERVIEW ===
  if (summary.brief_overview) {
    y += 3
    addText("OVERVIEW", { size: 14, color: COLORS.primary, bold: true })
    y += 3
    addText(summary.brief_overview as string, { size: 10, color: COLORS.text })
    y += 5
    drawLine()
  }

  // === TRIAGE ===
  const triage = summary.triage as TriageData | null
  if (triage) {
    checkPageBreak(40)
    y += 3
    addText("QUICK ASSESSMENT", { size: 14, color: COLORS.primary, bold: true })
    y += 3

    addText(`Quality Score: ${triage.quality_score}/10`, { size: 10, bold: true })
    addText(`Worth Your Time: ${triage.worth_your_time}`, { size: 10 })
    addText(`Content Density: ${triage.content_density}`, { size: 10 })

    if (triage.target_audience && triage.target_audience.length > 0) {
      addText(`Target Audience: ${triage.target_audience.join(", ")}`, { size: 10 })
    }

    y += 5
    drawLine()
  }

  // === ACTION ITEMS ===
  const actionItems = summary.action_items as ActionItemsData | null
  if (actionItems && actionItems.length > 0) {
    checkPageBreak(30)
    y += 3
    addText("ACTION ITEMS", { size: 14, color: COLORS.primary, bold: true })
    y += 3

    for (const item of actionItems) {
      checkPageBreak(20)

      const priorityColor = item.priority === "high" ? COLORS.error :
                           item.priority === "medium" ? COLORS.warning : COLORS.textLight

      addText(`[${item.priority.toUpperCase()}] ${item.title}`, {
        size: 11,
        color: priorityColor,
        bold: true
      })
      addText(item.description, { size: 9, color: COLORS.text })
      y += 3
    }

    y += 2
    drawLine()
  }

  // === DETAILED SUMMARY ===
  if (summary.detailed_summary) {
    checkPageBreak(30)
    y += 3
    addText("DETAILED ANALYSIS", { size: 14, color: COLORS.primary, bold: true })
    y += 3

    // Split into paragraphs for better readability
    const paragraphs = (summary.detailed_summary as string).split(/\n\n+/)
    for (const paragraph of paragraphs) {
      if (paragraph.trim()) {
        checkPageBreak(15)
        addText(paragraph.trim(), { size: 10, color: COLORS.text })
        y += 3
      }
    }
  }

  // === FOOTER ===
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.textLight)
    doc.text(
      `Generated by Clarus (clarusapp.io) | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    )
  }

  return doc.output("arraybuffer")
}

function getRatingColor(rating: string): [number, number, number] {
  switch (rating) {
    case "Accurate": return COLORS.success
    case "Mostly Accurate": return [34, 197, 94] // green-500
    case "Mixed": return COLORS.warning
    case "Questionable": return [249, 115, 22] // orange-500
    case "Unreliable": return COLORS.error
    default: return COLORS.textLight
  }
}

function getStatusColor(status: ClaimHighlight["status"]): [number, number, number] {
  switch (status) {
    case "verified": return COLORS.success
    case "false": return COLORS.error
    case "disputed": return COLORS.warning
    case "unverified": return COLORS.info
    case "opinion": return [168, 85, 247] // purple-500
    default: return COLORS.textLight
  }
}

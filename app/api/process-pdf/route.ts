import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { type NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/validation"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn("PDF API: Supabase credentials not set")
}

// Rate limiting
const LIMITS = {
  MAX_UPLOADS_PER_HOUR: 10,
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
}

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown"

  // Rate limit
  const rateLimit = checkRateLimit(`pdf:${clientIp}`, LIMITS.MAX_UPLOADS_PER_HOUR, 3600000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429 }
    )
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const userId = formData.get("userId") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
    }

    if (file.size > LIMITS.MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 20MB." }, { status: 400 })
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey)

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract text from PDF using pdf-parse
    let pdfText = ""
    try {
      // Dynamic import to avoid issues with edge runtime
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      const textResult = await parser.getText()
      pdfText = textResult.text || textResult.pages.map((p: { text: string }) => p.text).join("\n\n")
      await parser.destroy()
    } catch (pdfError) {
      console.error("PDF parsing error:", pdfError)
      return NextResponse.json(
        { error: "Failed to parse PDF. Please ensure the PDF contains readable text." },
        { status: 400 }
      )
    }

    if (!pdfText || pdfText.trim().length < 100) {
      return NextResponse.json(
        { error: "PDF appears to be empty or contains mostly images. Please use a text-based PDF." },
        { status: 400 }
      )
    }

    // Truncate if extremely long
    const maxChars = 500000 // ~125k tokens max
    const truncatedText = pdfText.length > maxChars
      ? pdfText.slice(0, maxChars) + "\n\n[Content truncated due to length...]"
      : pdfText

    // Create content record
    const title = file.name.replace(/\.pdf$/i, "") || "Uploaded PDF"

    const { data: contentData, error: contentError } = await supabaseAdmin
      .from("content")
      .insert({
        user_id: userId,
        title,
        url: `pdf://${file.name}`,
        type: "pdf",
        full_text: truncatedText,
        processing_status: "pending",
      })
      .select("id")
      .single()

    if (contentError || !contentData) {
      console.error("Error creating content:", contentError)
      return NextResponse.json(
        { error: "Failed to save PDF" },
        { status: 500 }
      )
    }

    const contentId = contentData.id

    // Trigger async processing (same as URL processing)
    // We'll call the internal processing endpoint
    const processResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/process-content`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          skipScraping: true, // We already have the text
        }),
      }
    )

    if (!processResponse.ok) {
      console.error("Failed to trigger processing:", await processResponse.text())
      // Don't fail - the content is saved, processing can be retried
    }

    return NextResponse.json({
      success: true,
      contentId,
      title,
      message: "PDF uploaded successfully. Analysis starting...",
    })

  } catch (error) {
    console.error("PDF upload error:", error)
    return NextResponse.json(
      { error: "Failed to process PDF" },
      { status: 500 }
    )
  }
}

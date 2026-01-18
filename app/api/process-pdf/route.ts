import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { type NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/validation"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const ocrApiKey = process.env.OCR_SPACE_API_KEY // Free API key from ocr.space

if (!supabaseUrl || !supabaseKey) {
  console.warn("PDF API: Supabase credentials not set")
}

// Rate limiting
const LIMITS = {
  MAX_UPLOADS_PER_HOUR: 10,
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
  MIN_TEXT_LENGTH: 100, // Minimum chars required
  OCR_MAX_FILE_SIZE: 5 * 1024 * 1024, // OCR.space free tier limit: 5MB
}

/**
 * Extract text from scanned PDF using OCR.space API
 * Free tier: 25,000 requests/month
 * Docs: https://ocr.space/ocrapi
 */
async function extractTextWithOCR(buffer: Buffer, filename: string): Promise<string> {
  if (!ocrApiKey) {
    throw new Error("OCR service not configured. Please set OCR_SPACE_API_KEY.")
  }

  // Check file size for OCR (free tier limit)
  if (buffer.length > LIMITS.OCR_MAX_FILE_SIZE) {
    throw new Error("PDF too large for OCR processing. Maximum 5MB for scanned PDFs.")
  }

  console.log("Starting OCR extraction via OCR.space...")

  // Create form data with the PDF
  const formData = new FormData()
  formData.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename)
  formData.append("apikey", ocrApiKey)
  formData.append("language", "eng")
  formData.append("isOverlayRequired", "false")
  formData.append("filetype", "PDF")
  formData.append("detectOrientation", "true")
  formData.append("scale", "true")
  formData.append("OCREngine", "2") // Engine 2 is better for scanned docs

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("OCR API error:", errorText)
    throw new Error("OCR service temporarily unavailable")
  }

  const result = await response.json()

  if (result.IsErroredOnProcessing) {
    console.error("OCR processing error:", result.ErrorMessage)
    throw new Error(result.ErrorMessage?.[0] || "Failed to process PDF with OCR")
  }

  // Combine text from all pages
  const extractedText = result.ParsedResults
    ?.map((page: { ParsedText: string }, index: number) => {
      const text = page.ParsedText?.trim()
      return text ? `--- Page ${index + 1} ---\n${text}` : ""
    })
    .filter(Boolean)
    .join("\n\n")

  if (!extractedText) {
    throw new Error("OCR could not extract any text from this PDF")
  }

  console.log(`OCR extracted ${extractedText.length} characters`)
  return extractedText
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

    // Extract text from PDF - try pdf-parse first, then OCR as fallback
    let pdfText = ""
    let usedOCR = false

    // Step 1: Try pdf-parse for text-based PDFs (faster)
    try {
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      const textResult = await parser.getText()
      pdfText = textResult.text || textResult.pages.map((p: { text: string }) => p.text).join("\n\n")
      await parser.destroy()
      console.log(`pdf-parse extracted ${pdfText.length} characters`)
    } catch (pdfError) {
      console.error("pdf-parse failed:", pdfError)
      // Will try OCR below
    }

    // Step 2: If pdf-parse didn't get enough text, try OCR
    if (!pdfText || pdfText.trim().length < LIMITS.MIN_TEXT_LENGTH) {
      if (!ocrApiKey) {
        // OCR not configured, give helpful error
        return NextResponse.json(
          {
            error: "This PDF appears to be scanned or image-based. OCR processing is not yet configured. Please use a text-based PDF, or convert your scanned PDF using Adobe Acrobat, Google Docs, or an online OCR service first.",
            isScannedPdf: true
          },
          { status: 400 }
        )
      }

      console.log("Text extraction insufficient, attempting OCR...")
      try {
        pdfText = await extractTextWithOCR(buffer, file.name)
        usedOCR = true
      } catch (ocrError) {
        console.error("OCR failed:", ocrError)
        const errorMessage = ocrError instanceof Error ? ocrError.message : "OCR processing failed"
        return NextResponse.json(
          { error: errorMessage, isScannedPdf: true },
          { status: 400 }
        )
      }
    }

    // Final check - if still no text, fail
    if (!pdfText || pdfText.trim().length < LIMITS.MIN_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: "Could not extract readable text from PDF. Please ensure the PDF contains text or clear images.",
          isScannedPdf: true
        },
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
      message: usedOCR
        ? "PDF uploaded (OCR processed). Analysis starting..."
        : "PDF uploaded successfully. Analysis starting...",
      usedOCR,
    })

  } catch (error) {
    console.error("PDF upload error:", error)
    return NextResponse.json(
      { error: "Failed to process PDF" },
      { status: 500 }
    )
  }
}

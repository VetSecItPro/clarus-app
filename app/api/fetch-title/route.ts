import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { validateUrl, checkRateLimit } from "@/lib/validation"

const FETCH_TIMEOUT = 5_000

/**
 * POST /api/fetch-title
 * Lightweight endpoint to extract the <title> from a URL.
 * Used to show a real page title in the UI immediately after URL submission,
 * before the full analysis completes.
 */
export async function POST(request: NextRequest) {
  // Rate limiting — this endpoint makes outbound fetches, so cap at 30/min per IP
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rateLimit = checkRateLimit(`fetch-title:${clientIp}`, 30, 60000)
  if (!rateLimit.allowed) {
    return AuthErrors.rateLimit(rateLimit.resetIn)
  }

  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { url } = body
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 })
  }

  const validation = validateUrl(url)
  if (!validation.isValid || !validation.sanitized) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    const response = await fetch(validation.sanitized, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Clarus/1.0)",
        Accept: "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return NextResponse.json({ title: null })
    }

    // Only read a small chunk — title is near the top of the HTML
    const reader = response.body?.getReader()
    if (!reader) {
      return NextResponse.json({ title: null })
    }

    const decoder = new TextDecoder()
    let html = ""
    const MAX_BYTES = 16_384 // 16KB is plenty to find <title>

    while (html.length < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })

      // Stop early if we've already passed </title>
      if (html.includes("</title>")) break
    }

    reader.cancel().catch(() => {})

    // Extract title
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = match?.[1]
      ?.replace(/\s+/g, " ")
      .trim()
      // Decode common HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")

    return NextResponse.json({ title: title || null })
  } catch {
    return NextResponse.json({ title: null })
  }
}

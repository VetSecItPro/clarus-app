import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, AuthErrors } from "@/lib/auth"
import { validateUrl } from "@/lib/validation"
import { checkRateLimit } from "@/lib/rate-limit"
import { fetchTitleSchema, parseBody } from "@/lib/schemas"

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
  const rateLimit = await checkRateLimit(`fetch-title:${clientIp}`, 30, 60000)
  if (!rateLimit.allowed) {
    return AuthErrors.rateLimit(rateLimit.resetIn)
  }

  const auth = await authenticateRequest()
  if (!auth.success) return auth.response

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = parseBody(fetchTitleSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const url = parsed.data.url

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    let targetUrl = url
    let redirectCount = 0
    const MAX_REDIRECTS = 3

    // Follow redirects manually to re-validate each hop against SSRF
    let response: Response
    while (true) {
      response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Clarus/1.0)",
          Accept: "text/html",
        },
        signal: controller.signal,
        redirect: "manual",
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location || redirectCount >= MAX_REDIRECTS) {
          clearTimeout(timeout)
          return NextResponse.json({ title: null })
        }
        // Resolve relative redirects against the current URL
        const resolved = new URL(location, targetUrl).href
        // Re-validate the redirect target against SSRF protection
        const redirectValidation = validateUrl(resolved)
        if (!redirectValidation.isValid || !redirectValidation.sanitized) {
          clearTimeout(timeout)
          return NextResponse.json({ title: null })
        }
        targetUrl = redirectValidation.sanitized
        redirectCount++
        continue
      }
      break
    }

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

import { NextResponse } from "next/server"

/**
 * Fast title fetching endpoint - used to get content title before full analysis
 * This allows the UI to show the actual title immediately instead of "Analyzing..."
 */
export async function POST(request: Request) {
  try {
    const { url, type } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL required" }, { status: 400 })
    }

    let title: string | null = null

    // YouTube: Use oEmbed API (fast, no API key needed)
    if (type === "youtube") {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)

        const response = await fetch(oembedUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        })
        clearTimeout(timeout)

        if (response.ok) {
          const data = await response.json()
          title = data.title || null
        }
      } catch (err) {
        console.warn("YouTube oEmbed fetch failed:", err)
      }
    }

    // X/Twitter: Try to extract from URL or use placeholder
    else if (type === "x_post") {
      // X posts don't have an easy oEmbed, use a descriptive placeholder
      title = "X Post"
    }

    // Articles: Fetch the page and extract <title>
    else {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 4000)

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TruthChecker/1.0)',
            'Accept': 'text/html',
          },
        })
        clearTimeout(timeout)

        if (response.ok) {
          // Only read first 50KB to find title quickly
          const reader = response.body?.getReader()
          if (reader) {
            let html = ''
            const decoder = new TextDecoder()

            while (html.length < 50000) {
              const { done, value } = await reader.read()
              if (done) break
              html += decoder.decode(value, { stream: true })

              // Check if we have the title tag
              const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
              if (titleMatch) {
                title = titleMatch[1].trim()
                // Clean up HTML entities
                title = title
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/&nbsp;/g, ' ')
                reader.cancel()
                break
              }
            }
            reader.cancel()
          }
        }
      } catch (err) {
        console.warn("Article title fetch failed:", err)
      }
    }

    return NextResponse.json({ title })
  } catch (error: any) {
    console.error("Fetch title error:", error)
    return NextResponse.json({ title: null })
  }
}

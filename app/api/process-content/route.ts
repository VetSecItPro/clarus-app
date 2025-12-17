import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import type { Database, Json } from "@/types/supabase"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supadataApiKey = process.env.SUPADATA_API_KEY
const openRouterApiKey = process.env.OPENROUTER_API_KEY
const firecrawlApiKey = process.env.FIRECRAWL_API_KEY

interface SupadataYouTubeResponse {
  id: string
  title: string
  description: string
  duration: number
  channel: {
    id: string
    name: string
  }
  tags: string[]
  thumbnail: string
  uploadDate: string
  viewCount: number
  likeCount: number
  transcriptLanguages: string[]
  [key: string]: any
}

interface ProcessedYouTubeMetadata {
  title: string | null
  author: string | null
  duration: number | null
  thumbnail_url: string | null
  description: string | null
  upload_date: string | null
  view_count: number | null
  like_count: number | null
  channel_id: string | null
  transcript_languages: string[] | null
  raw_youtube_metadata: Json | null
}

interface ScrapedArticleData {
  title: string | null
  full_text: string | null
  description: string | null
  thumbnail_url: string | null
}

async function getYouTubeMetadata(url: string, apiKey: string): Promise<ProcessedYouTubeMetadata> {
  console.log(`API: Fetching YouTube metadata for ${url} using supadata.ai`)
  const endpoint = `https://api.supadata.ai/v1/youtube/video?id=${encodeURIComponent(url)}`
  const retries = 3
  const delay = 1000 // 1 second

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        headers: { "x-api-key": apiKey },
      })

      if (response.ok) {
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const errorText = await response.text()
          console.error(`Supadata Metadata API Error: Expected JSON, got ${contentType}. Response: ${errorText}`)
          throw new Error(`Supadata Metadata API Error: Expected JSON, got ${contentType}.`)
        }
        const data: SupadataYouTubeResponse = await response.json()
        return {
          title: data.title,
          author: data.channel?.name,
          duration: data.duration,
          thumbnail_url: data.thumbnail,
          description: data.description,
          upload_date: data.uploadDate,
          view_count: data.viewCount,
          like_count: data.likeCount,
          channel_id: data.channel?.id,
          transcript_languages: data.transcriptLanguages,
          raw_youtube_metadata: data as Json,
        }
      }

      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text()
        const errorMessage = `Supadata Metadata API Client Error (${
          response.status
        }) for url ${url}: ${errorText.substring(0, 200)}. Not retrying.`
        console.error(errorMessage)
        throw new Error(errorMessage)
      }

      const errorText = await response.text()
      console.warn(
        `Supadata Metadata API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
          delay / 1000
        }s...`,
      )
    } catch (error: any) {
      if (error.message.includes("Client Error")) {
        throw error
      }
      console.warn(
        `Error on attempt ${attempt} calling Supadata YouTube Metadata API for ${url}: ${error.message}. Retrying in ${
          delay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, delay))
    }
  }

  const finalErrorMessage = `Failed to fetch YouTube metadata for ${url} after ${retries} attempts.`
  console.error(finalErrorMessage)
  throw new Error(finalErrorMessage)
}

async function getYouTubeTranscript(url: string, apiKey: string): Promise<{ full_text: string | null }> {
  console.log(`API: Fetching YouTube transcript for ${url} using supadata.ai`)
  const endpoint = `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}&text=true`
  const retries = 3
  const delay = 1000

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        headers: { "x-api-key": apiKey },
      })

      if (response.ok) {
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const errorText = await response.text()
          console.error(`Supadata Transcript API Error: Expected JSON, got ${contentType}. Response: ${errorText}`)
          throw new Error(`Supadata Transcript API Error: Expected JSON, got ${contentType}.`)
        }
        const data = await response.json()
        return { full_text: data.content }
      }

      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text()
        const errorMessage = `Supadata Transcript API Client Error (${
          response.status
        }) for url ${url}: ${errorText.substring(0, 200)}. Not retrying.`
        console.error(errorMessage)
        throw new Error(errorMessage)
      }

      const errorText = await response.text()
      console.warn(
        `Supadata Transcript API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
          delay / 1000
        }s...`,
      )
    } catch (error: any) {
      if (error.message.includes("Client Error")) {
        throw error
      }
      console.warn(
        `Error on attempt ${attempt} calling Supadata YouTube Transcript API for ${url}: ${error.message}. Retrying in ${
          delay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, delay))
    }
  }

  const finalErrorMessage = `Failed to fetch YouTube transcript for ${url} after ${retries} attempts.`
  console.error(finalErrorMessage)
  throw new Error(finalErrorMessage)
}

async function scrapeArticle(url: string, apiKey: string): Promise<ScrapedArticleData> {
  console.log(`API: Scraping article for ${url} using FireCrawl`)
  const endpoint = "https://api.firecrawl.dev/v0/scrape"
  const retries = 5
  const delay = 2000

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: url,
          pageOptions: {
            onlyMainContent: true,
          },
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          console.log("API: FireCrawl scrape successful.")
          return {
            title: result.data.metadata?.title || null,
            full_text: result.data.markdown || result.data.content || null,
            description: result.data.metadata?.description || null,
            thumbnail_url: result.data.metadata?.ogImage || null,
          }
        } else {
          throw new Error(result.error || "FireCrawl API indicated failure.")
        }
      }

      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text()
        const errorMessage = `FireCrawl API Client Error (${response.status}) for url ${url}: ${errorText.substring(
          0,
          200,
        )}. Not retrying.`
        console.error(errorMessage)
        throw new Error(errorMessage)
      }

      const errorText = await response.text()
      console.warn(
        `FireCrawl API Server Error (${response.status}) on attempt ${attempt} for ${url}: ${errorText}. Retrying in ${
          delay / 1000
        }s...`,
      )
    } catch (error: any) {
      if (error.message.includes("Client Error")) {
        throw error
      }
      console.warn(
        `Error on attempt ${attempt} calling FireCrawl API for ${url}: ${error.message}. Retrying in ${
          delay / 1000
        }s...`,
      )
    }

    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, delay))
    }
  }

  const finalErrorMessage = `Failed to scrape article with FireCrawl for ${url} after ${retries} attempts.`
  console.error(finalErrorMessage)
  throw new Error(finalErrorMessage)
}

interface ModelSummary {
  mid_length_summary: string | null
  title?: string | null
}

interface ModelProcessingError {
  error: true
  modelName: string
  reason: string
  finalErrorMessage?: string
}

async function getModelSummary(
  textToSummarize: string,
  options: { shouldExtractTitle?: boolean } = {},
): Promise<ModelSummary | ModelProcessingError> {
  const { shouldExtractTitle = false } = options

  if (!openRouterApiKey) {
    const msg = "OpenRouter API key is not configured."
    console.error(msg)
    return { error: true, modelName: "N/A", reason: "ClientNotInitialized", finalErrorMessage: msg }
  }
  if (!supabaseUrl || !supabaseKey) {
    const msg = "Supabase URL or Key not configured for fetching prompt in getModelSummary."
    console.error(msg)
    return { error: true, modelName: "N/A", reason: "ClientNotInitialized", finalErrorMessage: msg }
  }
  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey)

  const { data: promptData, error: promptError } = await supabaseAdmin
    .from("active_summarizer_prompt")
    .select("*")
    .eq("id", 1)
    .single()

  if (promptError || !promptData) {
    const msg = `Failed to fetch summarizer prompt from DB: ${promptError?.message}`
    console.error(msg)
    return { error: true, modelName: "N/A", reason: "PromptFetchFailed", finalErrorMessage: msg }
  }

  const { system_content, user_content_template, temperature, top_p, max_tokens, model_name } = promptData

  const openRouterModelId = model_name || "anthropic/claude-3.5-sonnet"
  const finalUserPrompt = (user_content_template || "{{TEXT_TO_SUMMARIZE}}").replace(
    "{{TEXT_TO_SUMMARIZE}}",
    textToSummarize,
  )

  const requestBody: { [key: string]: any } = {
    model: openRouterModelId,
    messages: [
      { role: "system", content: system_content },
      { role: "user", content: finalUserPrompt },
    ],
    response_format: { type: "json_object" },
  }

  if (temperature !== null) requestBody.temperature = temperature
  if (top_p !== null) requestBody.top_p = top_p
  if (max_tokens !== null) requestBody.max_tokens = max_tokens

  try {
    console.log(`API: Calling OpenRouter with model ${openRouterModelId}...`)
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vajra.vercel.app",
        "X-Title": "Vajra",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      const errorMessage = `OpenRouter API Error (${response.status}): ${errorBody}`
      console.error(errorMessage)
      return {
        error: true,
        modelName: openRouterModelId,
        reason: `APIError_${response.status}`,
        finalErrorMessage: errorMessage,
      }
    }

    const result = await response.json()
    const rawContent = result.choices[0]?.message?.content
    console.log("API: Raw content received from OpenRouter:", rawContent)

    if (!rawContent) {
      const errorMessage = "OpenRouter response missing message content."
      console.error(errorMessage, result)
      return { error: true, modelName: openRouterModelId, reason: "InvalidResponse", finalErrorMessage: errorMessage }
    }

    let parsedContent: any
    try {
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch && jsonMatch[1]) {
        console.log("API: Found JSON inside markdown block. Parsing...")
        parsedContent = JSON.parse(jsonMatch[1])
      } else {
        console.log("API: No markdown block found. Attempting to parse entire content as JSON...")
        parsedContent = JSON.parse(rawContent)
      }
    } catch (parseError: any) {
      const errorMessage = `Failed to parse JSON from model response. Error: ${parseError.message}`
      console.error(errorMessage, "Raw content was:", rawContent)
      return { error: true, modelName: openRouterModelId, reason: "JSONParseFailed", finalErrorMessage: errorMessage }
    }

    console.log("API: Successfully parsed content:", parsedContent)

    const summary: ModelSummary = {
      mid_length_summary: parsedContent.mid_length_summary || null,
    }
    if (shouldExtractTitle) {
      summary.title = parsedContent.title || null
    }

    console.log("API: Summary generated successfully for model:", openRouterModelId)
    return summary
  } catch (error: any) {
    console.error(`Failed to process summary with OpenRouter: ${error.message}`)
    return {
      error: true,
      modelName: openRouterModelId,
      reason: "RequestFailed",
      finalErrorMessage: error.message,
    }
  }
}

interface ProcessContentRequestBody {
  content_id: string
  force_regenerate?: boolean
}

export async function POST(req: NextRequest) {
  const supabase = createClient<Database>(supabaseUrl, supabaseKey)

  let content_id: string
  let force_regenerate: boolean

  try {
    const body: ProcessContentRequestBody = await req.json()
    content_id = body.content_id
    force_regenerate = body.force_regenerate || false

    if (!content_id) {
      return NextResponse.json({ error: "content_id is required." }, { status: 400 })
    }

    if (!supabaseUrl || !supabaseKey || !supadataApiKey || !openRouterApiKey || !firecrawlApiKey) {
      return NextResponse.json({ error: "Server configuration error: Missing API keys." }, { status: 500 })
    }
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  console.log(`API: Processing request for content_id: ${content_id}, force_regenerate: ${force_regenerate}`)

  const { data: content, error: fetchError } = await supabase.from("content").select("*").eq("id", content_id).single()

  if (fetchError || !content) {
    console.error(`API: Error fetching content by ID ${content_id}:`, fetchError)
    return NextResponse.json({ error: `Content with ID ${content_id} not found or error fetching.` }, { status: 404 })
  }

  console.log(`API: Found content: ${content.url}, type: ${content.type}`)

  try {
    if (content.type === "youtube") {
      const shouldFetchYouTubeMetadata =
        force_regenerate ||
        !content.author ||
        !content.duration ||
        !content.thumbnail_url ||
        !content.raw_youtube_metadata
      if (shouldFetchYouTubeMetadata) {
        const metadata = await getYouTubeMetadata(content.url, supadataApiKey)
        const updatePayload: Partial<Database["public"]["Tables"]["content"]["Update"]> = {}
        if (metadata.title) updatePayload.title = metadata.title
        if (metadata.author) updatePayload.author = metadata.author
        if (metadata.duration) updatePayload.duration = metadata.duration
        if (metadata.thumbnail_url) updatePayload.thumbnail_url = metadata.thumbnail_url
        if (metadata.description) updatePayload.description = metadata.description
        if (metadata.upload_date) updatePayload.upload_date = metadata.upload_date
        if (metadata.view_count) updatePayload.view_count = metadata.view_count
        if (metadata.like_count) updatePayload.like_count = metadata.like_count
        if (metadata.channel_id) updatePayload.channel_id = metadata.channel_id
        if (metadata.transcript_languages) updatePayload.transcript_languages = metadata.transcript_languages
        if (metadata.raw_youtube_metadata) updatePayload.raw_youtube_metadata = metadata.raw_youtube_metadata

        if (Object.keys(updatePayload).length > 0) {
          const { error: updateMetaError } = await supabase.from("content").update(updatePayload).eq("id", content.id)
          if (updateMetaError) console.error("API: Error updating YouTube metadata in DB:", updateMetaError)
          else Object.assign(content, updatePayload)
        }
      }

      const shouldFetchYouTubeText = !content.full_text || force_regenerate
      if (shouldFetchYouTubeText) {
        const { full_text } = await getYouTubeTranscript(content.url, supadataApiKey)
        if (full_text) {
          const { error: updateTranscriptError } = await supabase
            .from("content")
            .update({ full_text })
            .eq("id", content.id)
          if (updateTranscriptError)
            console.error("API: Error updating YouTube transcript in DB:", updateTranscriptError)
          else content.full_text = full_text
        }
      }
    } else if (content.type === "article" || content.type === "pdf" || content.type === "x_post") {
      const shouldScrape = force_regenerate || !content.full_text || content.full_text.startsWith("PROCESSING_FAILED::")
      if (shouldScrape) {
        let urlToScrape = content.url
        if (content.type === "x_post") {
          try {
            const urlObject = new URL(content.url)
            if (urlObject.hostname === "x.com") {
              urlObject.hostname = "fixupx.com"
            } else if (urlObject.hostname === "twitter.com") {
              urlObject.hostname = "fxtwitter.com"
            }
            urlToScrape = urlObject.toString()
            console.log(`API: Transformed X/Twitter URL to ${urlToScrape} for scraping.`)
          } catch (e) {
            console.error(`API: Could not parse URL for x_post: ${content.url}`)
          }
        }

        const scrapedData = await scrapeArticle(urlToScrape, firecrawlApiKey)

        const updatePayload: Partial<Database["public"]["Tables"]["content"]["Update"]> = {}
        if (scrapedData.title) updatePayload.title = scrapedData.title
        if (scrapedData.full_text) updatePayload.full_text = scrapedData.full_text
        if (scrapedData.description) updatePayload.description = scrapedData.description
        if (scrapedData.thumbnail_url) updatePayload.thumbnail_url = scrapedData.thumbnail_url
        updatePayload.author = null
        updatePayload.duration = null
        updatePayload.upload_date = null
        updatePayload.view_count = null
        updatePayload.like_count = null
        updatePayload.channel_id = null
        updatePayload.transcript_languages = null
        updatePayload.raw_youtube_metadata = null

        if (Object.keys(updatePayload).length > 0) {
          const { error: updateArticleError } = await supabase
            .from("content")
            .update(updatePayload)
            .eq("id", content.id)
          if (updateArticleError) console.error("API: Error updating article data in DB:", updateArticleError)
          else Object.assign(content, updatePayload)
        }
      }
    }
  } catch (error: any) {
    console.error(`API: Final text processing error for content ID ${content.id}:`, error.message)
    const failure_reason = `PROCESSING_FAILED::${content.type?.toUpperCase() || "UNKNOWN"}::${error.message}`
    await supabase.from("content").update({ full_text: failure_reason }).eq("id", content.id)

    return NextResponse.json(
      { success: false, message: `Content processing failed: ${error.message}`, content_id: content.id },
      { status: 200 },
    )
  }

  if (!content.full_text || content.full_text.startsWith("PROCESSING_FAILED::")) {
    console.warn(
      `API: No valid full text available for content ID ${content.id}. Skipping summary generation. Reason: ${content.full_text}`,
    )
    return NextResponse.json(
      { success: true, message: "Content processed, but no valid text found for summary.", content_id: content.id },
      { status: 200 },
    )
  }

  const responsePayload: {
    success: boolean
    message: string
    content_id: string
    modelErrors?: ModelProcessingError[]
  } = {
    success: true,
    message: "Content processed successfully.",
    content_id: content.id,
  }

  let titleNeedsFixing = !content.title || content.title.startsWith("Processing:")

  console.log(`API: Generating summary...`)
  const summaryResult = await getModelSummary(content.full_text, {
    shouldExtractTitle: titleNeedsFixing,
  })

  if (summaryResult && "error" in summaryResult && summaryResult.error === true) {
    const modelError = summaryResult as ModelProcessingError
    if (!responsePayload.modelErrors) responsePayload.modelErrors = []
    responsePayload.modelErrors.push(modelError)
    responsePayload.success = false
    responsePayload.message = "Failed to generate summary."
  } else {
    const validSummary = summaryResult as ModelSummary

    if (titleNeedsFixing && validSummary.title) {
      await supabase.from("content").update({ title: validSummary.title }).eq("id", content.id)
      titleNeedsFixing = false
    }

    if (validSummary.mid_length_summary) {
      if (!content.user_id) {
        console.error(`API: user_id is missing on content object with id ${content.id}. Cannot save summary.`)
        responsePayload.success = false
        responsePayload.message = "Internal error: user_id missing from content."
      } else {
        console.log(`API: Saving summary to DB for content_id ${content.id}`)
        const { error: upsertError } = await supabase.from("summaries").upsert(
          {
            content_id: content.id,
            user_id: content.user_id,
            mid_length_summary: validSummary.mid_length_summary,
          },
          { onConflict: "content_id" },
        )

        if (upsertError) {
          console.error(`API: Failed to upsert summary into DB:`, upsertError)
          if (!responsePayload.modelErrors) responsePayload.modelErrors = []
          responsePayload.modelErrors.push({
            error: true,
            modelName: "N/A",
            reason: "DatabaseUpsertFailed",
            finalErrorMessage: upsertError.message,
          })
          responsePayload.success = false
          responsePayload.message = "Failed to save summary to database."
        } else {
          console.log(`API: Successfully saved summary to DB.`)
        }
      }
    } else {
      console.warn(`API: Generated summary was null or empty. Not saving to DB.`)
    }
  }

  console.log(`API: Processing complete for content_id: ${content_id}`)
  return NextResponse.json(responsePayload, { status: 200 })
}

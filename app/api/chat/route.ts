import { streamText, convertToModelMessages, consumeStream, type UIMessage, tool } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { type NextRequest, NextResponse } from "next/server"
import { validateContentId, validateChatMessage, checkRateLimit } from "@/lib/validation"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openRouterApiKey = process.env.OPENROUTER_API_KEY
const tavilyApiKey = process.env.TAVILY_API_KEY

if (!supabaseUrl || !supabaseKey || !openRouterApiKey) {
  console.warn("Chat API: Some environment variables are not set. API may not work correctly.")
}

// Tavily web search function
async function searchWeb(query: string): Promise<string> {
  if (!tavilyApiKey) {
    return "Web search is not available. Please ask questions based on the provided content."
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        search_depth: "basic",
        include_answer: true,
        include_raw_content: false,
        max_results: 5,
      }),
    })

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`)
    }

    const data = await response.json()

    let result = ""
    if (data.answer) {
      result += `**Summary:** ${data.answer}\n\n`
    }

    if (data.results && data.results.length > 0) {
      result += "**Sources:**\n"
      for (const item of data.results.slice(0, 5)) {
        result += `- [${item.title}](${item.url}): ${item.content?.slice(0, 200)}...\n`
      }
    }

    return result || "No results found."
  } catch (error) {
    console.error("Web search error:", error)
    return "Web search failed. Please try again or ask questions based on the provided content."
  }
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown"
  const rateLimit = checkRateLimit(`chat:${clientIp}`, 30, 60000) // 30 messages per minute
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    )
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Server configuration error: Supabase credentials missing." }, { status: 500 })
  }
  if (!openRouterApiKey) {
    return NextResponse.json({ error: "Server configuration error: OpenRouter API key missing." }, { status: 500 })
  }

  try {
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey)

    const body = await req.json()
    const { messages, contentId }: { messages: UIMessage[]; contentId: string } = body

    // Validate contentId
    const contentIdValidation = validateContentId(contentId)
    if (!contentIdValidation.isValid) {
      return NextResponse.json({ error: contentIdValidation.error || "Invalid contentId" }, { status: 400 })
    }

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages are required." }, { status: 400 })
    }

    // Helper to extract text content from UIMessage parts
    const getMessageText = (msg: UIMessage): string => {
      if (!msg.parts) return ""
      return msg.parts
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join("")
    }

    // Sanitize user messages to prevent prompt injection
    const sanitizedMessages = messages.map((msg) => {
      if (msg.role === "user") {
        const text = getMessageText(msg)
        if (text) {
          const validation = validateChatMessage(text)
          return {
            ...msg,
            parts: msg.parts.map((part) =>
              part.type === "text"
                ? { ...part, text: validation.sanitized || part.text }
                : part
            ),
          }
        }
      }
      return msg
    })

    // Fetch content with title and URL
    const { data: contentData, error: contentError } = await supabaseAdmin
      .from("content")
      .select("title, url, full_text, type, author")
      .eq("id", contentIdValidation.sanitized!)
      .single()

    if (contentError || !contentData) {
      console.error("Chat API: Error fetching content from DB.", contentError)
      return NextResponse.json({ error: "Could not load content to chat with." }, { status: 500 })
    }

    // Fetch summary data
    const { data: summaryData } = await supabaseAdmin
      .from("summaries")
      .select("brief_overview, mid_length_summary, detailed_summary, triage, truth_check")
      .eq("content_id", contentIdValidation.sanitized!)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fetch chat prompt configuration
    const { data: promptData, error: promptError } = await supabaseAdmin
      .from("active_chat_prompt")
      .select("*")
      .eq("id", 1)
      .single()

    if (promptError || !promptData) {
      console.error("[Chat API] Error fetching prompt:", promptError)
      return NextResponse.json({ error: "Could not load chat prompt." }, { status: 500 })
    }

    // Build comprehensive context
    let contextParts: string[] = []

    // Content metadata
    contextParts.push(`## Content Information`)
    contextParts.push(`- **Title:** ${contentData.title || "Untitled"}`)
    contextParts.push(`- **Type:** ${contentData.type || "Unknown"}`)
    if (contentData.author) contextParts.push(`- **Author:** ${contentData.author}`)
    if (contentData.url) contextParts.push(`- **Source:** ${contentData.url}`)
    contextParts.push("")

    // Summary data if available
    if (summaryData) {
      if (summaryData.brief_overview) {
        contextParts.push(`## Brief Overview`)
        contextParts.push(summaryData.brief_overview)
        contextParts.push("")
      }

      if (summaryData.triage) {
        const triage = summaryData.triage as Record<string, unknown>
        contextParts.push(`## Quick Assessment`)
        if (triage.one_liner) contextParts.push(`- **One-liner:** ${triage.one_liner}`)
        if (triage.quality_score) contextParts.push(`- **Quality Score:** ${triage.quality_score}/10`)
        if (triage.signal_noise_score) contextParts.push(`- **Signal/Noise:** ${triage.signal_noise_score}/4`)
        if (triage.worth_reading_reason) contextParts.push(`- **Worth Reading:** ${triage.worth_reading_reason}`)
        contextParts.push("")
      }

      if (summaryData.truth_check) {
        const truthCheck = summaryData.truth_check as Record<string, unknown>
        contextParts.push(`## Truth Check`)
        if (truthCheck.accuracy_assessment) contextParts.push(`- **Accuracy:** ${truthCheck.accuracy_assessment}`)
        if (truthCheck.bias_assessment) contextParts.push(`- **Bias:** ${truthCheck.bias_assessment}`)
        if (truthCheck.key_claims) contextParts.push(`- **Key Claims:** ${JSON.stringify(truthCheck.key_claims)}`)
        contextParts.push("")
      }

      if (summaryData.mid_length_summary) {
        contextParts.push(`## Key Takeaways`)
        contextParts.push(summaryData.mid_length_summary)
        contextParts.push("")
      }

      if (summaryData.detailed_summary) {
        contextParts.push(`## Detailed Analysis`)
        contextParts.push(summaryData.detailed_summary)
        contextParts.push("")
      }
    }

    // Full text (transcript/article)
    if (contentData.full_text) {
      contextParts.push(`## Full Content`)
      contextParts.push(contentData.full_text)
    }

    const contentContext = contextParts.join("\n")

    // Enhanced system prompt
    const webSearchNote = tavilyApiKey
      ? "You have access to a web search tool. Use it when the user asks about current events, needs up-to-date information, or when the content references topics you need more context on."
      : ""

    const systemPrompt = `You are an intelligent AI assistant helping users understand and discuss content they've saved. You have access to the full content, summaries, and analysis.

## Your Capabilities:
- Answer questions about the content accurately and thoroughly
- Explain complex concepts mentioned in the content
- Compare points made in the content with broader knowledge
- Provide additional context and background information
${webSearchNote}

## Response Guidelines:
- Use **bold** for emphasis on key terms and important points
- Use bullet points and numbered lists for clarity
- Use headers (##) to organize longer responses
- Include relevant quotes from the content when appropriate
- Be conversational but informative
- If you're unsure about something, say so

## Content Context:
${contentContext}`

    const modelMessages = convertToModelMessages(sanitizedMessages as UIMessage[])

    const modelName = promptData.model_name || "anthropic/claude-sonnet-4-20250514"

    // Create OpenRouter provider instance
    const openrouter = createOpenRouter({ apiKey: openRouterApiKey! })

    // Define tools (only if Tavily API key is available)
    const tools = tavilyApiKey ? {
      webSearch: tool({
        description: "Search the web for current information, recent events, or additional context. Use this when the user asks about something not covered in the content or needs up-to-date information.",
        inputSchema: z.object({
          query: z.string().describe("The search query to find relevant information"),
        }),
        execute: async ({ query }) => {
          return await searchWeb(query)
        },
      }),
    } : undefined

    const result = streamText({
      model: openrouter(modelName),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      temperature: promptData.temperature ?? 0.7,
      topP: promptData.top_p ?? undefined,
      maxOutputTokens: promptData.max_tokens ?? 2048,
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse({
      consumeSseStream: consumeStream,
    })
  } catch (error: any) {
    console.error("[Chat API] Error:", error)
    return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 })
  }
}

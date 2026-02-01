import { streamText, convertToModelMessages, consumeStream, type UIMessage, tool, stepCountIs } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { type NextRequest, NextResponse } from "next/server"
import { validateContentId, validateChatMessage, checkRateLimit } from "@/lib/validation"
import { z } from "zod"
import { enforceUsageLimit, incrementUsage } from "@/lib/usage"
import { TIER_LIMITS } from "@/lib/tier-limits"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
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

// Cost protection limits
const LIMITS = {
  MAX_MESSAGES_PER_MINUTE: 15,        // Rate limit per minute
  MAX_MESSAGES_PER_HOUR: 100,         // Hourly limit
  MAX_MESSAGES_PER_DAY: 500,          // Daily limit
  MAX_CONVERSATION_MESSAGES: 20,      // Max messages sent to API (keeps context smaller)
  MAX_MESSAGE_LENGTH: 2000,           // Max chars per user message
  MAX_OUTPUT_TOKENS: 1024,            // Max tokens in response
  MAX_WEB_SEARCHES_PER_CONVERSATION: 3, // Limit expensive web searches
}

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown"

  // Multi-tier rate limiting
  const minuteLimit = checkRateLimit(`chat:minute:${clientIp}`, LIMITS.MAX_MESSAGES_PER_MINUTE, 60000)
  const hourLimit = checkRateLimit(`chat:hour:${clientIp}`, LIMITS.MAX_MESSAGES_PER_HOUR, 3600000)
  const dayLimit = checkRateLimit(`chat:day:${clientIp}`, LIMITS.MAX_MESSAGES_PER_DAY, 86400000)

  if (!minuteLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    )
  }
  if (!hourLimit.allowed) {
    return NextResponse.json(
      { error: "Hourly limit reached. Please try again later." },
      { status: 429 }
    )
  }
  if (!dayLimit.allowed) {
    return NextResponse.json(
      { error: "Daily limit reached. Please try again tomorrow." },
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
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey, { db: { schema: "clarus" } })

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

    // Limit conversation history to control context size
    const limitedMessages = messages.slice(-LIMITS.MAX_CONVERSATION_MESSAGES)

    // Helper to extract text content from UIMessage parts
    const getMessageText = (msg: UIMessage): string => {
      if (!msg.parts) return ""
      return msg.parts
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join("")
    }

    // Validate message length for the latest user message
    const latestUserMsg = limitedMessages.filter(m => m.role === "user").pop()
    if (latestUserMsg) {
      const latestText = getMessageText(latestUserMsg)
      if (latestText.length > LIMITS.MAX_MESSAGE_LENGTH) {
        return NextResponse.json(
          { error: `Message too long. Maximum ${LIMITS.MAX_MESSAGE_LENGTH} characters allowed.` },
          { status: 400 }
        )
      }
    }

    // Sanitize user messages to prevent prompt injection
    const sanitizedMessages = limitedMessages.map((msg) => {
      if (msg.role === "user") {
        const text = getMessageText(msg)
        if (text) {
          const validation = validateChatMessage(text)
          return {
            ...msg,
            parts: msg.parts.map((part) =>
              part.type === "text"
                ? { ...part, text: (validation.sanitized || part.text).slice(0, LIMITS.MAX_MESSAGE_LENGTH) }
                : part
            ),
          }
        }
      }
      return msg
    })

    // Determine if we need full_text (only for first few messages to save tokens)
    const isFirstMessages = limitedMessages.filter((m: UIMessage) => m.role === "user").length <= 2

    // Fetch content — always include full_text in select but only use it for first messages
    const { data: contentData, error: contentError } = await supabaseAdmin
      .from("content")
      .select("title, url, full_text, type, author, user_id, detected_tone")
      .eq("id", contentIdValidation.sanitized!)
      .single()

    if (contentError || !contentData) {
      console.error("Chat API: Error fetching content from DB.", contentError)
      return NextResponse.json({ error: "Could not load content to chat with." }, { status: 500 })
    }

    // Tier-based usage limit check for chat messages
    if (contentData.user_id) {
      const usageCheck = await enforceUsageLimit(supabaseAdmin, contentData.user_id, "chat_messages_count")
      if (!usageCheck.allowed) {
        return NextResponse.json(
          { error: `Monthly chat message limit reached (${usageCheck.limit}). Upgrade your plan for more.`, upgrade_required: true, tier: usageCheck.tier },
          { status: 403 }
        )
      }

      // Per-content limit check: count user messages in this conversation
      const userMessageCount = messages.filter((m: UIMessage) => m.role === "user").length
      const perContentLimit = TIER_LIMITS[usageCheck.tier].chatMessagesPerContent
      if (userMessageCount > perContentLimit) {
        return NextResponse.json(
          { error: `Message limit reached for this content (${perContentLimit}). Upgrade your plan for more messages per content.`, upgrade_required: true, tier: usageCheck.tier },
          { status: 403 }
        )
      }

      // Increment before streaming (can't increment after stream completes)
      await incrementUsage(supabaseAdmin, contentData.user_id, "chat_messages_count")
    }

    // Fetch summary data (including action_items for grounded chat)
    const { data: summaryData } = await supabaseAdmin
      .from("summaries")
      .select("brief_overview, mid_length_summary, detailed_summary, triage, truth_check, action_items")
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

    // Build context - use full content only for first few messages, then use summaries
    // (isFirstMessages already computed above for conditional content fetch)
    let contextParts: string[] = []

    // Content metadata (always included)
    contextParts.push(`## Content Information`)
    contextParts.push(`- **Title:** ${contentData.title || "Untitled"}`)
    contextParts.push(`- **Type:** ${contentData.type || "Unknown"}`)
    if (contentData.author) contextParts.push(`- **Author:** ${contentData.author}`)
    if (contentData.detected_tone) contextParts.push(`- **Detected Tone:** ${contentData.detected_tone}`)
    if (contentData.url) contextParts.push(`- **Source:** ${contentData.url}`)
    contextParts.push("")

    // Summary data if available (always included - it's compact)
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
        contextParts.push(`## Accuracy Analysis`)
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

      // Action items if available
      if (summaryData.action_items) {
        const actionItems = summaryData.action_items as Record<string, unknown>
        contextParts.push(`## Action Items`)
        contextParts.push(JSON.stringify(actionItems, null, 2))
        contextParts.push("")
      }

      // Detailed summary always included as it provides comprehensive coverage
      if (summaryData.detailed_summary) {
        contextParts.push(`## Detailed Analysis`)
        contextParts.push(summaryData.detailed_summary)
        contextParts.push("")
      }
    }

    // Full text (transcript/article) - ONLY for first messages to save tokens
    // For follow-up questions, the summaries + conversation history provide enough context
    if (contentData.full_text && isFirstMessages) {
      // Truncate very long content to avoid token limits
      const maxFullTextChars = 50000 // ~12.5k tokens
      const fullText = contentData.full_text.length > maxFullTextChars
        ? contentData.full_text.slice(0, maxFullTextChars) + "\n\n[Content truncated for length...]"
        : contentData.full_text
      contextParts.push(`## Full Content`)
      contextParts.push(fullText)
    } else if (contentData.full_text && !isFirstMessages) {
      // For follow-up messages, just note that full content was provided earlier
      contextParts.push(`## Note`)
      contextParts.push(`The full content/transcript was provided in earlier context. Use the summaries and conversation history to answer. If the user asks about specific quotes or details, you can reference what was discussed earlier.`)
    }

    const contentContext = contextParts.join("\n")

    // Enhanced system prompt with grounding
    const webSearchCapability = tavilyApiKey
      ? `
## Web Search Tool
You have access to a webSearch tool. USE IT ACTIVELY when:
- The user asks about people, companies, or entities mentioned in the content
- The user wants background info on topics discussed
- The user asks "who is", "what is", or similar questions
- You need current/updated information
- The content references topics you don't have full context on
- The user explicitly asks you to search

IMPORTANT: When the user asks about something not fully covered in the content (like who created a video, background on a speaker, etc.), USE the webSearch tool immediately. Don't say you can't find it - search for it!`
      : ""

    // Determine content type label
    const contentTypeLabel = contentData.type === "youtube" ? "video" : contentData.type === "x_post" ? "post" : "article"

    const systemPrompt = `You are Clarus, an analysis assistant for content that has already been analyzed. You help users understand the analysis results and gain clarity on the content.

## Content Being Discussed
- **Type:** ${contentTypeLabel}
- **Title:** ${contentData.title || "Untitled"}
${contentData.author ? `- **Author:** ${contentData.author}` : ""}
${contentData.url ? `- **Source:** ${contentData.url}` : ""}
${webSearchCapability}

## Analysis Data Available
${contentContext}

## Your Role
You are grounded in the analysis above. Your primary job is to help users understand, navigate, and act on the analysis findings.

## Rules
1. **Only reference information from the analysis above** — do not invent facts not present in the analysis
2. **If asked something not covered**, say so honestly: "The analysis doesn't cover that specific aspect"
3. **Cite which section** the information comes from (Overview, Quick Assessment, Key Takeaways, Accuracy Analysis, Action Items, Detailed Analysis)
4. **Help the user** understand, summarize, compare, or prioritize findings
5. **Be concise** — users want quick, actionable answers
6. **If the content contains errors or questionable claims**, point them out based on the Accuracy Analysis data
7. **For follow-up questions** about topics beyond the analysis, use web search if available

## Response Style
- Use **bold** for key terms and important points
- Use bullet points for clarity
- Keep responses focused and relevant to the analysis
- Be conversational but precise
- When referencing scores or ratings, include the actual numbers`

    const modelMessages = convertToModelMessages(sanitizedMessages as UIMessage[])

    const modelName = promptData.model_name || "google/gemini-2.5-flash"

    // Create OpenRouter provider instance
    const openrouter = createOpenRouter({ apiKey: openRouterApiKey! })

    // Models that support tool use via OpenRouter
    const toolSupportedModels = [
      "anthropic/claude",
      "openai/gpt-4",
      "openai/gpt-4o",
      "google/gemini",
    ]

    // Check if the model likely supports tools
    const modelSupportsTools = toolSupportedModels.some(prefix => modelName.toLowerCase().includes(prefix.split("/")[1]))

    // Track web searches per conversation to limit costs
    const searchKey = `websearch:${contentIdValidation.sanitized}:${clientIp}`

    // Define tools (only if Tavily API key is available AND model supports tools)
    const tools = (tavilyApiKey && modelSupportsTools) ? {
      webSearch: tool({
        description: "Search the web for current information, recent events, or additional context. Use this when the user asks about something not covered in the content or needs up-to-date information.",
        inputSchema: z.object({
          query: z.string().describe("The search query to find relevant information"),
        }),
        execute: async ({ query }) => {
          // Rate limit web searches per conversation
          const searchLimit = checkRateLimit(searchKey, LIMITS.MAX_WEB_SEARCHES_PER_CONVERSATION, 3600000) // 1 hour window
          if (!searchLimit.allowed) {
            return "Search limit reached for this conversation. Please ask questions based on the content provided."
          }
          return await searchWeb(query)
        },
      }),
    } : undefined

    const result = streamText({
      model: openrouter(modelName),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(tools ? 3 : 1), // Limited steps for tool execution (cost control)
      temperature: promptData.temperature ?? 0.7,
      topP: promptData.top_p ?? undefined,
      maxOutputTokens: Math.min(promptData.max_tokens ?? LIMITS.MAX_OUTPUT_TOKENS, LIMITS.MAX_OUTPUT_TOKENS),
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse({
      consumeSseStream: consumeStream,
    })
  } catch (error: unknown) {
    console.error("[Chat API] Error:", error)
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 })
  }
}

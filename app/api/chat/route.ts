import { streamText, convertToModelMessages, consumeStream, type UIMessage } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { type NextRequest, NextResponse } from "next/server"
import { validateContentId, validateChatMessage, checkRateLimit } from "@/lib/validation"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openRouterApiKey = process.env.OPENROUTER_API_KEY

if (!supabaseUrl || !supabaseKey || !openRouterApiKey) {
  console.warn("Chat API: Some environment variables are not set. API may not work correctly.")
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
          // Update the text parts with sanitized content
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

    const { data: contentData, error: contentError } = await supabaseAdmin
      .from("content")
      .select("full_text")
      .eq("id", contentIdValidation.sanitized!)
      .single()

    if (contentError || !contentData || !contentData.full_text) {
      console.error("Chat API: Error fetching content from DB.", contentError)
      return NextResponse.json({ error: "Could not load content to chat with." }, { status: 500 })
    }

    const { data: promptData, error: promptError } = await supabaseAdmin
      .from("active_chat_prompt")
      .select("*")
      .eq("id", 1)
      .single()

    if (promptError || !promptData) {
      console.error("[Chat API] Error fetching prompt:", promptError)
      return NextResponse.json({ error: "Could not load chat prompt." }, { status: 500 })
    }

    const systemPrompt = `${promptData.system_content}\n\nHere is the content you are discussing:\n\n"""\n${contentData.full_text}\n"""`

    const modelMessages = convertToModelMessages(sanitizedMessages as UIMessage[])

    const modelName = promptData.model_name || "anthropic/claude-sonnet-4-20250514"

    // Create OpenRouter provider instance
    const openrouter = createOpenRouter({ apiKey: openRouterApiKey! })

    const result = streamText({
      model: openrouter(modelName),
      system: systemPrompt,
      messages: modelMessages,
      temperature: promptData.temperature ?? undefined,
      topP: promptData.top_p ?? undefined,
      maxOutputTokens: promptData.max_tokens ?? undefined,
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

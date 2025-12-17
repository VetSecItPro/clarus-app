import { streamText, convertToModelMessages, consumeStream, type UIMessage } from "ai"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openRouterApiKey = process.env.OPENROUTER_API_KEY

if (!supabaseUrl || !supabaseKey || !openRouterApiKey) {
  console.warn("Chat API: Some environment variables are not set. API may not work correctly.")
}

export async function POST(req: NextRequest) {
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

    if (!contentId) {
      return NextResponse.json({ error: "contentId is required." }, { status: 400 })
    }

    const { data: contentData, error: contentError } = await supabaseAdmin
      .from("content")
      .select("full_text")
      .eq("id", contentId)
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

    const modelMessages = convertToModelMessages(messages)

    const modelName = promptData.model_name || "anthropic/claude-sonnet-4-20250514"

    const result = streamText({
      model: modelName,
      system: systemPrompt,
      messages: modelMessages,
      temperature: promptData.temperature ?? undefined,
      topP: promptData.top_p ?? undefined,
      maxTokens: promptData.max_tokens ?? undefined,
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

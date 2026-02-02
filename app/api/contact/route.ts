import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { checkRateLimit } from "@/lib/validation"
import { contactFormSchema, parseBody } from "@/lib/schemas"
import { sendContactFormEmail } from "@/lib/email"

let _client: ReturnType<typeof createClient<Database, "clarus">> | null = null
function getClient() {
  if (!_client) {
    _client = createClient<Database, "clarus">(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: "clarus" } }
    )
  }
  return _client
}

export async function POST(request: Request) {
  // Rate limit: 5 submissions per hour per IP
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rateLimit = checkRateLimit(`contact:${clientIp}`, 5, 3600000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = parseBody(contactFormSchema, body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { name, email, subject, message } = parsed.data
  const supabase = getClient()

  // Insert pending submission
  const { data: row, error: insertError } = await supabase
    .from("contact_submissions")
    .insert({
      name,
      email,
      subject,
      message,
      status: "pending",
      ip_address: clientIp,
    })
    .select("id")
    .single()

  if (insertError) {
    console.error("Failed to log contact submission:", insertError)
    return NextResponse.json({ error: "Failed to process submission" }, { status: 500 })
  }

  // Send email
  const emailResult = await sendContactFormEmail(name, email, subject, message)

  if (emailResult.success) {
    await supabase
      .from("contact_submissions")
      .update({
        status: "sent",
        resend_message_id: emailResult.messageId ?? null,
        sent_at: new Date().toISOString(),
      })
      .eq("id", row.id)
  } else {
    await supabase
      .from("contact_submissions")
      .update({
        status: "failed",
        error_message: emailResult.error ?? "Unknown error",
      })
      .eq("id", row.id)
  }

  // Return success regardless — submission is logged for retry
  return NextResponse.json({ success: true })
}

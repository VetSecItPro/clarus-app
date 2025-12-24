import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { validateContentId, checkRateLimit } from "@/lib/validation"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET all tags for a content item
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const idValidation = validateContentId(id)
    if (!idValidation.isValid) {
      return NextResponse.json({ success: false, error: idValidation.error }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("content")
      .select("tags")
      .eq("id", idValidation.sanitized)
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tags: data?.tags || [] })
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }
}

// PATCH to update tags (add or remove)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const rateLimit = checkRateLimit(`tags:${clientIp}`, 60, 60000) // 60 requests per minute
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    const idValidation = validateContentId(id)
    if (!idValidation.isValid) {
      return NextResponse.json({ success: false, error: idValidation.error }, { status: 400 })
    }

    const { action, tag } = await request.json()

    if (!["add", "remove", "set"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "action must be 'add', 'remove', or 'set'" },
        { status: 400 }
      )
    }

    // Validate tag
    if (action !== "set" && (typeof tag !== "string" || tag.trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: "tag must be a non-empty string" },
        { status: 400 }
      )
    }

    // Sanitize tag: lowercase, trim, limit length
    const sanitizedTag = action !== "set" ? tag.trim().toLowerCase().slice(0, 50) : null

    // Get current tags
    const { data: current, error: fetchError } = await supabaseAdmin
      .from("content")
      .select("tags")
      .eq("id", idValidation.sanitized)
      .single()

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    let newTags: string[] = current?.tags || []

    if (action === "add" && sanitizedTag) {
      // Add tag if not already present
      if (!newTags.includes(sanitizedTag)) {
        newTags = [...newTags, sanitizedTag]
      }
    } else if (action === "remove" && sanitizedTag) {
      // Remove tag
      newTags = newTags.filter((t) => t !== sanitizedTag)
    } else if (action === "set") {
      // Set tags to provided array
      const { tags } = await request.json()
      if (!Array.isArray(tags)) {
        return NextResponse.json(
          { success: false, error: "tags must be an array for 'set' action" },
          { status: 400 }
        )
      }
      newTags = tags.map((t: string) => t.trim().toLowerCase().slice(0, 50)).filter(Boolean)
    }

    // Limit to 10 tags per content
    if (newTags.length > 10) {
      return NextResponse.json(
        { success: false, error: "Maximum 10 tags allowed per content" },
        { status: 400 }
      )
    }

    // Update tags
    const { data, error } = await supabaseAdmin
      .from("content")
      .update({ tags: newTags })
      .eq("id", idValidation.sanitized)
      .select("id, tags")
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }
}

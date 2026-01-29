import { NextResponse } from "next/server"
import { authenticateRequest, verifyContentOwnership, AuthErrors } from "@/lib/auth"
import { uuidSchema, parseBody } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/validation"
import { z } from "zod"

// Schema for tag operations
const tagActionSchema = z.object({
  action: z.enum(["add", "remove"]),
  tag: z.string().trim().min(1).max(50),
})

const tagSetSchema = z.object({
  action: z.literal("set"),
  tags: z.array(z.string().trim().min(1).max(50)).max(10),
})

const tagsUpdateSchema = z.union([tagActionSchema, tagSetSchema])

// GET all tags for a content item
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Validate content ID
    const idResult = uuidSchema.safeParse(id)
    if (!idResult.success) {
      return AuthErrors.badRequest("Invalid content ID")
    }

    // Authenticate user
    const auth = await authenticateRequest()
    if (!auth.success) {
      return auth.response
    }

    // Verify ownership
    const ownership = await verifyContentOwnership(auth.supabase, auth.user.id, idResult.data)
    if (!ownership.owned) {
      return ownership.response
    }

    return NextResponse.json({ success: true, tags: ownership.content.tags || [] })
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
      return AuthErrors.rateLimit(rateLimit.resetIn)
    }

    // Validate content ID
    const idResult = uuidSchema.safeParse(id)
    if (!idResult.success) {
      return AuthErrors.badRequest("Invalid content ID")
    }

    // Authenticate user
    const auth = await authenticateRequest()
    if (!auth.success) {
      return auth.response
    }

    // Verify ownership
    const ownership = await verifyContentOwnership(auth.supabase, auth.user.id, idResult.data)
    if (!ownership.owned) {
      return ownership.response
    }

    // Validate request body
    const body = await request.json()
    const validation = parseBody(tagsUpdateSchema, body)
    if (!validation.success) {
      return AuthErrors.badRequest(validation.error)
    }

    const currentTags: string[] = ownership.content.tags || []
    let newTags: string[]

    const actionData = validation.data
    if (actionData.action === "add") {
      const sanitizedTag = actionData.tag.toLowerCase()
      if (!currentTags.includes(sanitizedTag)) {
        newTags = [...currentTags, sanitizedTag]
      } else {
        newTags = currentTags
      }
    } else if (actionData.action === "remove") {
      const sanitizedTag = actionData.tag.toLowerCase()
      newTags = currentTags.filter((t) => t !== sanitizedTag)
    } else if (actionData.action === "set") {
      // Explicit check for "set" action to satisfy TypeScript
      newTags = actionData.tags.map((t: string) => t.toLowerCase())
    } else {
      // Should never happen, but TypeScript exhaustiveness check
      newTags = currentTags
    }

    // Limit to 10 tags per content
    if (newTags.length > 10) {
      return AuthErrors.badRequest("Maximum 10 tags allowed per content")
    }

    // Update tags
    const { data, error } = await auth.supabase
      .from("content")
      .update({ tags: newTags })
      .eq("id", idResult.data)
      .select("id, tags")
      .single()

    if (error) {
      console.error("Tags update error:", error)
      return NextResponse.json({ success: false, error: "Failed to update tags. Please try again." }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }
}

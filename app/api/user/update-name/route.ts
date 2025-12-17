import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  try {
    const { userId, name } = await request.json()

    if (!userId || !name) {
      return NextResponse.json({ success: false, error: "User ID and name are required" }, { status: 400 })
    }

    // Validate name format (alphanumeric, underscores, 3-20 chars)
    const nameRegex = /^[a-zA-Z0-9_]{3,20}$/
    if (!nameRegex.test(name)) {
      return NextResponse.json(
        {
          success: false,
          error: "Name must be 3-20 characters, letters, numbers, and underscores only",
        },
        { status: 400 },
      )
    }

    // Check if name is already taken
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("name", name)
      .neq("id", userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: false, error: "Name is already taken" }, { status: 409 })
    }

    // Update the name
    const { error } = await supabaseAdmin.from("users").update({ name }).eq("id", userId)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }
}

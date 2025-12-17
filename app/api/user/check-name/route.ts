import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get("name")
  const currentUserId = searchParams.get("userId")

  if (!name) {
    return NextResponse.json({ available: false, error: "Name is required" }, { status: 400 })
  }

  // Check if name is taken by another user
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("name", name)
    .neq("id", currentUserId || "")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ available: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ available: !data })
}

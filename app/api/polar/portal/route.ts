import { NextResponse } from "next/server"
import { polar } from "@/lib/polar"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { checkRateLimit } from "@/lib/validation"

export async function POST(request: Request) {
  // Rate limiting
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rateLimit = checkRateLimit(`portal:${clientIp}`, 10, 60000) // 10 requests per minute
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: {
          schema: "clarus",
        },
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      },
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { data: userData } = await supabase.from("users").select("polar_customer_id").eq("id", user.id).single()

    if (!userData?.polar_customer_id) {
      return NextResponse.json({ error: "No subscription found" }, { status: 400 })
    }

    // Create customer portal session
    const session = await polar.customerSessions.create({
      customerId: userData.polar_customer_id,
    })

    return NextResponse.json({ url: session.customerPortalUrl })
  } catch (error: unknown) {
    console.error("Portal error:", error)
    return NextResponse.json({ error: "Failed to access billing portal. Please try again later." }, { status: 500 })
  }
}

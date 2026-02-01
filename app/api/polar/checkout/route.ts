import { NextResponse } from "next/server"
import { polar, PRODUCTS } from "@/lib/polar"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { checkRateLimit } from "@/lib/validation"

export async function POST(request: Request) {
  // Rate limiting - prevent checkout spam
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rateLimit = checkRateLimit(`checkout:${clientIp}`, 5, 60000) // 5 checkout attempts per minute
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

  try {
    const { tier, interval } = await request.json()

    // Resolve product ID from tier + interval
    const productKey = `${tier}_${interval}` as keyof typeof PRODUCTS
    const productId = PRODUCTS[productKey]

    if (!productId) {
      return NextResponse.json(
        { error: "Payments are not configured yet. Please check back later." },
        { status: 503 }
      )
    }

    // Get current user
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

    // Get user data
    const { data: userData } = await supabase
      .from("users")
      .select("polar_customer_id, email")
      .eq("id", user.id)
      .single()

    // Get the origin for redirect URLs
    const origin = request.headers.get("origin") || "https://clarusapp.io"

    // Create Polar checkout session
    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl: `${origin}/?success=true`,
      customerEmail: user.email || userData?.email || undefined,
      metadata: {
        supabase_user_id: user.id,
        tier,
        interval,
      },
    })

    return NextResponse.json({ url: checkout.url })
  } catch (error: unknown) {
    console.error("Checkout error:", error)
    return NextResponse.json({ error: "Checkout failed. Please try again later." }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { polar, PRODUCTS } from "@/lib/polar"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { checkRateLimit } from "@/lib/rate-limit"
import { polarCheckoutSchema, parseBody } from "@/lib/schemas"
import { logger } from "@/lib/logger"

export async function POST(request: Request) {
  // Rate limiting - prevent checkout spam
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rateLimit = await checkRateLimit(`checkout:${clientIp}`, 5, 60000) // 5 checkout attempts per minute
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

  try {
    const rawBody = await request.json()
    const parsed = parseBody(polarCheckoutSchema, rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { tier, interval } = parsed.data
    const isDayPass = tier === "day_pass"

    if (!isDayPass && !interval) {
      return NextResponse.json({ error: "Interval is required for subscription tiers" }, { status: 400 })
    }

    // Resolve product ID
    const productId = isDayPass
      ? PRODUCTS.day_pass
      : PRODUCTS[`${tier}_${interval}` as keyof typeof PRODUCTS]

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
      .select("polar_customer_id, email, tier, subscription_status, day_pass_expires_at")
      .eq("id", user.id)
      .single()

    // Day pass abuse prevention
    if (isDayPass) {
      // Can't buy day pass if already on active subscription
      if (userData?.tier === "starter" || userData?.tier === "pro") {
        if (userData?.subscription_status === "active" || userData?.subscription_status === "trialing") {
          return NextResponse.json(
            { error: "You already have an active subscription with more features than a day pass." },
            { status: 400 }
          )
        }
      }
      // Can't stack day passes
      if (userData?.day_pass_expires_at && new Date(userData.day_pass_expires_at) > new Date()) {
        return NextResponse.json(
          { error: "You already have an active day pass. It expires " + new Date(userData.day_pass_expires_at).toLocaleString() + "." },
          { status: 400 }
        )
      }
    }

    // FIX-023: Validate redirect origin to prevent open redirect to arbitrary external domains
    const allowedOrigins = ["https://clarusapp.io", "http://localhost:3000", "http://localhost:3001"]
    const rawOrigin = request.headers.get("origin") || "https://clarusapp.io"
    const origin = allowedOrigins.includes(rawOrigin) ? rawOrigin : "https://clarusapp.io"

    // Create Polar checkout session
    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl: `${origin}/?success=true`,
      customerEmail: user.email || userData?.email || undefined,
      metadata: {
        supabase_user_id: user.id,
        tier,
        ...(isDayPass ? {} : { interval }),
      },
    })

    return NextResponse.json({ url: checkout.url })
  } catch (error: unknown) {
    logger.error("Checkout error:", error)
    return NextResponse.json({ error: "Checkout failed. Please try again later." }, { status: 500 })
  }
}

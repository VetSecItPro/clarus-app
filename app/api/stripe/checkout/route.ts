import { NextResponse } from "next/server"
import { stripe, PRICES } from "@/lib/stripe"
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
    const { priceId, interval, couponCode } = await request.json()

    // Validate price ID
    const validPriceId = priceId || (interval === "annual" ? PRICES.annual : PRICES.monthly)
    if (validPriceId !== PRICES.monthly && validPriceId !== PRICES.annual) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 })
    }

    // Get current user
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
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

    // Check if user already has a Stripe customer ID
    const { data: userData } = await supabase
      .from("users")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .single()

    let customerId = userData?.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || userData?.email || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Save customer ID to database
      await supabase.from("users").update({ stripe_customer_id: customerId }).eq("id", user.id)
    }

    // Get the origin for redirect URLs
    const origin = request.headers.get("origin") || "https://vajra-truth-checker.vercel.app"

    // Look up promotion code if provided
    let discounts: { promotion_code: string }[] | undefined
    if (couponCode) {
      // Sanitize and validate coupon code format (alphanumeric only, max 20 chars)
      const sanitizedCode = String(couponCode).replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 20)

      if (!sanitizedCode || sanitizedCode.length < 2 || sanitizedCode.length > 20) {
        return NextResponse.json(
          { error: "Please enter a valid coupon code (2-20 alphanumeric characters)" },
          { status: 400 }
        )
      }

      try {
        // Search for promotion code by code string
        const promotionCodes = await stripe.promotionCodes.list({
          code: sanitizedCode,
          active: true,
          limit: 1,
        })

        if (promotionCodes.data.length > 0) {
          discounts = [{ promotion_code: promotionCodes.data[0].id }]
        } else {
          // If not found as promotion code, return error with friendly message
          return NextResponse.json(
            { error: "This coupon code is invalid or has expired. Please check and try again." },
            { status: 400 }
          )
        }
      } catch (err) {
        console.error("Error looking up coupon:", err)
        return NextResponse.json(
          { error: "Unable to validate coupon code. Please try again." },
          { status: 400 }
        )
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: validPriceId,
          quantity: 1,
        },
      ],
      ...(discounts && { discounts }),
      success_url: `${origin}/?success=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
        trial_period_days: 30,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: unknown) {
    console.error("Checkout error:", error)
    return NextResponse.json({ error: "Checkout failed. Please try again later." }, { status: 500 })
  }
}

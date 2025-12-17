import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
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

    const { data: userData } = await supabase.from("users").select("stripe_customer_id").eq("id", user.id).single()

    if (!userData?.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found" }, { status: 400 })
    }

    const origin = request.headers.get("origin") || "https://vajra-truth-checker.vercel.app"

    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripe_customer_id,
      return_url: `${origin}/`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error("Portal error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

// Use service role for webhook to bypass RLS
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function findUserByCustomerId(customerId: string): Promise<string | undefined> {
  const { data, error } = await supabaseAdmin.from("users").select("id").eq("stripe_customer_id", customerId).single()

  if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
    console.error("[Webhook] findUserByCustomerId error:", error.code)
  }

  return data?.id ?? undefined
}

async function updateUserSubscription(
  userId: string,
  updates: {
    subscription_status: string
    subscription_id?: string
    subscription_ends_at?: string
    stripe_customer_id?: string
  },
) {
  const { error } = await supabaseAdmin.from("users").update(updates).eq("id", userId)

  if (error) {
    console.error("[Webhook] Failed to update user subscription:", error.code)
    return false
  }

  return true
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    console.error("[Webhook] Webhook: No signature provided")
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: unknown) {
    console.error("[Webhook] Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const metadataUserId = session.metadata?.supabase_user_id

        let userId = metadataUserId
        if (!userId && customerId) {
          userId = await findUserByCustomerId(customerId)
        }

        if (!userId) {
          console.error("[Webhook] Could not find user for checkout session")
          return NextResponse.json({ error: "User not found" }, { status: 400 })
        }

        if (subscriptionId) {
          // Get subscription details from Stripe
          const subscriptionData = await stripe.subscriptions.retrieve(subscriptionId)
          const subscription = subscriptionData as Stripe.Subscription
          const currentPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end

          let status: string
          if (subscription.status === "trialing") {
            status = "trialing"
          } else if (subscription.status === "active") {
            status = "active"
          } else {
            status = "none"
          }

          const endDate = currentPeriodEnd
            ? new Date(currentPeriodEnd * 1000).toISOString()
            : null

          await updateUserSubscription(userId, {
            subscription_status: status,
            subscription_id: subscriptionId,
            ...(endDate && { subscription_ends_at: endDate }),
            stripe_customer_id: customerId,
          })
        }
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const metadataUserId = subscription.metadata?.supabase_user_id
        const currentPeriodEnd = (subscription as { current_period_end?: number }).current_period_end

        let userId: string | undefined = metadataUserId
        if (!userId && customerId) {
          userId = await findUserByCustomerId(customerId)
        }

        if (!userId) {
          console.error("[Webhook] Could not find user for subscription event")
          return NextResponse.json({ error: "User not found" }, { status: 400 })
        }

        let status: string
        switch (subscription.status) {
          case "trialing":
            status = "trialing"
            break
          case "active":
            status = "active"
            break
          case "canceled":
          case "unpaid":
          case "past_due":
            status = "canceled"
            break
          default:
            status = "none"
        }

        const endDate = currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null

        await updateUserSubscription(userId!, {
          subscription_status: status,
          subscription_id: subscription.id,
          ...(endDate && { subscription_ends_at: endDate }),
        })
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const metadataUserId = subscription.metadata?.supabase_user_id

        let userId: string | undefined = metadataUserId
        if (!userId && customerId) {
          userId = await findUserByCustomerId(customerId)
        }

        if (userId) {
          await updateUserSubscription(userId, {
            subscription_status: "canceled",
            subscription_ends_at: new Date().toISOString(),
          })
        }
        break
      }

      default:
        // Unhandled event types are normal - Stripe sends many event types
        break
    }

    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    console.error("[Webhook] Webhook handler error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

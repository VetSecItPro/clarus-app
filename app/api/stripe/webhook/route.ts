import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

// Use service role for webhook to bypass RLS
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function findUserByCustomerId(customerId: string): Promise<string | undefined> {
  const { data, error } = await supabaseAdmin.from("users").select("id").eq("stripe_customer_id", customerId).single()

  if (error) {
    console.log("[v0] findUserByCustomerId error:", error.message)
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
  console.log("[v0] Updating user", userId, "with:", updates)

  const { error } = await supabaseAdmin.from("users").update(updates).eq("id", userId)

  if (error) {
    console.error("[v0] Failed to update user:", error)
    return false
  }

  console.log("[v0] Successfully updated user subscription")
  return true
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    console.error("[v0] Webhook: No signature provided")
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error("[v0] Webhook signature verification failed:", err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  console.log("[v0] ========================================")
  console.log("[v0] Webhook received event:", event.type)
  console.log("[v0] Event ID:", event.id)

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const metadataUserId = session.metadata?.supabase_user_id

        console.log("[v0] checkout.session.completed")
        console.log("[v0] - customerId:", customerId)
        console.log("[v0] - subscriptionId:", subscriptionId)
        console.log("[v0] - metadataUserId:", metadataUserId)

        let userId = metadataUserId
        if (!userId && customerId) {
          userId = await findUserByCustomerId(customerId)
          console.log("[v0] - looked up userId by customerId:", userId)
        }

        if (!userId) {
          console.error("[v0] Could not find user for checkout session")
          return NextResponse.json({ error: "User not found" }, { status: 400 })
        }

        if (subscriptionId) {
          // Get subscription details from Stripe
          const subscriptionData = await stripe.subscriptions.retrieve(subscriptionId)
          const subscription = subscriptionData as Stripe.Subscription
          const currentPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
          console.log("[v0] - Stripe subscription status:", subscription.status)
          console.log("[v0] - current_period_end:", currentPeriodEnd)

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

        console.log("[v0]", event.type)
        console.log("[v0] - customerId:", customerId)
        console.log("[v0] - subscription.status:", subscription.status)
        console.log("[v0] - metadataUserId:", metadataUserId)
        console.log("[v0] - current_period_end:", currentPeriodEnd)

        let userId: string | undefined = metadataUserId
        if (!userId && customerId) {
          userId = await findUserByCustomerId(customerId)
          console.log("[v0] - looked up userId by customerId:", userId)
        }

        if (!userId) {
          console.error("[v0] Could not find user for subscription event")
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

        console.log("[v0] customer.subscription.deleted")
        console.log("[v0] - customerId:", customerId)

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
        console.log("[v0] Unhandled event type:", event.type)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("[v0] Webhook handler error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

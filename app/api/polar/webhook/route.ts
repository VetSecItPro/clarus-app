import { NextResponse } from "next/server"
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks"
import { createClient } from "@supabase/supabase-js"
import {
  sendSubscriptionStartedEmail,
  sendSubscriptionCancelledEmail,
  sendPaymentFailedEmail,
} from "@/lib/email"

// Use service role for webhook to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "clarus" } }
)

async function getUserEmailAndName(userId: string): Promise<{ email: string; name?: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("email, display_name")
    .eq("id", userId)
    .single()

  if (error || !data?.email) return null
  return { email: data.email, name: data.display_name }
}

async function findUserByCustomerId(customerId: string): Promise<string | undefined> {
  const { data, error } = await supabaseAdmin.from("users").select("id").eq("polar_customer_id", customerId).single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    console.error("[Polar Webhook] findUserByCustomerId error:", error.code)
  }

  return data?.id ?? undefined
}

async function updateUserSubscription(
  userId: string,
  updates: {
    subscription_status: string
    subscription_id?: string
    subscription_ends_at?: string
    polar_customer_id?: string
  },
) {
  const { error } = await supabaseAdmin.from("users").update(updates).eq("id", userId)

  if (error) {
    console.error("[Polar Webhook] Failed to update user subscription:", error.code)
    return false
  }

  return true
}

export async function POST(request: Request) {
  const body = await request.text()
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error("[Polar Webhook] No webhook secret configured")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  let event
  try {
    event = validateEvent(body, Object.fromEntries(request.headers), webhookSecret)
  } catch (err: unknown) {
    if (err instanceof WebhookVerificationError) {
      console.error("[Polar Webhook] Webhook signature verification failed:", err.message)
      return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 })
    }
    throw err
  }

  try {
    switch (event.type) {
      case "checkout.created": {
        // Checkout started - could log for analytics
        break
      }

      case "checkout.updated": {
        const checkout = event.data
        if (checkout.status === "succeeded") {
          const metadataUserId = checkout.metadata?.supabase_user_id as string | undefined
          const customerId = checkout.customerId

          let userId = metadataUserId
          if (!userId && customerId) {
            userId = await findUserByCustomerId(customerId)
          }

          if (userId && customerId) {
            // Link customer ID to user
            await supabaseAdmin.from("users").update({ polar_customer_id: customerId }).eq("id", userId)
          }
        }
        break
      }

      case "subscription.created":
      case "subscription.updated": {
        const subscription = event.data
        const customerId = subscription.customerId
        const metadataUserId = subscription.metadata?.supabase_user_id as string | undefined

        let userId: string | undefined = metadataUserId
        if (!userId && customerId) {
          userId = await findUserByCustomerId(customerId)
        }

        if (!userId) {
          console.error("[Polar Webhook] Could not find user for subscription event")
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
          case "past_due":
          case "unpaid":
            status = "canceled"
            break
          default:
            status = "none"
        }

        const endDate = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toISOString() : null

        await updateUserSubscription(userId, {
          subscription_status: status,
          subscription_id: subscription.id,
          ...(endDate && { subscription_ends_at: endDate }),
          polar_customer_id: customerId,
        })

        // Send subscription emails
        const user = await getUserEmailAndName(userId)
        if (user) {
          if (event.type === "subscription.created" && status === "active") {
            // New subscription started
            await sendSubscriptionStartedEmail(
              user.email,
              user.name,
              "Clarus Pro",
              "Monthly",
              "$4.00/month",
              endDate ? new Date(endDate).toLocaleDateString() : "Next month"
            )
          } else if (event.type === "subscription.updated" && subscription.status === "past_due") {
            // Payment failed
            await sendPaymentFailedEmail(
              user.email,
              user.name,
              "$4.00",
              "Clarus Pro",
              "Payment method declined",
              "in 3 days",
              "https://clarusapp.io/manage"
            )
          }
        }
        break
      }

      case "subscription.canceled": {
        const subscription = event.data
        const customerId = subscription.customerId
        const metadataUserId = subscription.metadata?.supabase_user_id as string | undefined

        let userId: string | undefined = metadataUserId
        if (!userId && customerId) {
          userId = await findUserByCustomerId(customerId)
        }

        if (userId) {
          await updateUserSubscription(userId, {
            subscription_status: "canceled",
            subscription_ends_at: new Date().toISOString(),
          })

          // Send cancellation email
          const user = await getUserEmailAndName(userId)
          if (user) {
            const endDate = subscription.currentPeriodEnd
              ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
              : "today"
            await sendSubscriptionCancelledEmail(
              user.email,
              user.name,
              "Clarus Pro",
              endDate,
              "https://clarusapp.io/pricing"
            )
          }
        }
        break
      }

      default:
        // Unhandled event types are normal
        break
    }

    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    console.error("[Polar Webhook] Webhook handler error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

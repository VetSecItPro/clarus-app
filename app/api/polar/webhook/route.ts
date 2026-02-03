import { NextResponse } from "next/server"
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks"
import { createClient } from "@supabase/supabase-js"
import { getTierFromProductId } from "@/lib/polar"
import {
  sendSubscriptionStartedEmail,
  sendSubscriptionCancelledEmail,
  sendPaymentFailedEmail,
} from "@/lib/email"

// FIX-020: Create Supabase admin client inside handler to avoid stale module-level connections
function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "clarus" } }
  )
}

type AdminClient = ReturnType<typeof createSupabaseAdmin>

async function getUserEmailAndName(supabaseAdmin: AdminClient, userId: string): Promise<{ email: string; name?: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("email, display_name")
    .eq("id", userId)
    .single()

  if (error || !data?.email) return null
  return { email: data.email, name: data.display_name }
}

async function findUserByCustomerId(supabaseAdmin: AdminClient, customerId: string): Promise<string | undefined> {
  const { data, error } = await supabaseAdmin.from("users").select("id").eq("polar_customer_id", customerId).single()

  if (error && error.code !== "PGRST116") {
    console.error("[Polar Webhook] findUserByCustomerId error:", error.code)
  }

  return data?.id ?? undefined
}

async function updateUserSubscription(
  supabaseAdmin: AdminClient,
  userId: string,
  updates: {
    subscription_status?: string
    subscription_id?: string
    subscription_ends_at?: string
    polar_customer_id?: string
    tier?: string
    day_pass_expires_at?: string | null
  },
) {
  const { error } = await supabaseAdmin.from("users").update(updates).eq("id", userId)

  if (error) {
    console.error("[Polar Webhook] Failed to update user subscription:", error.code)
    return false
  }

  return true
}

// Resolve tier from checkout/subscription metadata or product ID
function resolveTier(metadata: Record<string, unknown> | null | undefined, productId?: string): "starter" | "pro" | "day_pass" | "free" {
  // First check metadata (set during checkout)
  const metaTier = metadata?.tier as string | undefined
  if (metaTier === "starter" || metaTier === "pro" || metaTier === "day_pass") return metaTier

  // Fall back to product ID lookup
  if (productId) {
    const tier = getTierFromProductId(productId)
    if (tier) return tier
  }

  return "free"
}

// Format tier name for emails
function tierDisplayName(tier: string): string {
  if (tier === "pro") return "Clarus Pro"
  if (tier === "day_pass") return "Clarus Day Pass"
  return "Clarus Starter"
}

// Get price string based on tier and interval
function tierPrice(tier: string, interval?: string): string {
  if (tier === "day_pass") return "$10"
  if (tier === "pro") return interval === "annual" ? "$279/year" : "$29/month"
  return interval === "annual" ? "$144/year" : "$18/month"
}

export async function POST(request: Request) {
  // Verify webhook secret is configured BEFORE reading body
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[Polar Webhook] CRITICAL: POLAR_WEBHOOK_SECRET not configured")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  const body = await request.text()

  let event
  try {
    event = validateEvent(body, Object.fromEntries(request.headers), webhookSecret)
  } catch (err: unknown) {
    if (err instanceof WebhookVerificationError) {
      console.error("[Polar Webhook] Signature verification failed")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }

  // FIX-020: Create Supabase admin client inside handler (not module-level) to avoid stale connections
  const supabaseAdmin = createSupabaseAdmin()

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
          const metaTier = checkout.metadata?.tier as string | undefined

          let userId = metadataUserId
          if (!userId && customerId) {
            userId = await findUserByCustomerId(supabaseAdmin, customerId)
          }

          if (userId && customerId) {
            // Link customer ID to user
            await supabaseAdmin.from("users").update({ polar_customer_id: customerId }).eq("id", userId)
          }

          // Handle day pass activation (one-time purchase — no subscription events fire)
          if (metaTier === "day_pass" && userId) {
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            await updateUserSubscription(supabaseAdmin, userId, {
              tier: "day_pass",
              day_pass_expires_at: expiresAt,
            })
            console.log(`[Polar Webhook] Day pass activated for user ${userId}, expires ${expiresAt}`)

            // Send confirmation email
            const user = await getUserEmailAndName(supabaseAdmin, userId)
            if (user) {
              await sendSubscriptionStartedEmail(
                user.email,
                user.name,
                "Clarus Day Pass",
                "24-Hour Access",
                "$10",
                new Date(expiresAt).toLocaleString()
              )
            }
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
          userId = await findUserByCustomerId(supabaseAdmin, customerId)
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

        // Resolve tier from metadata or product ID
        const productId = subscription.productId
        const tier = resolveTier(subscription.metadata, productId)
        const interval = (subscription.metadata?.interval as string) || "monthly"
        const endDate = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toISOString() : null

        // Set tier to the paid tier when active/trialing, reset to free when canceled
        const effectiveTier = (status === "active" || status === "trialing") ? tier : "free"

        await updateUserSubscription(supabaseAdmin, userId, {
          subscription_status: status,
          subscription_id: subscription.id,
          tier: effectiveTier,
          // Clear day pass when subscribing (subscription supersedes day pass)
          day_pass_expires_at: null,
          ...(endDate && { subscription_ends_at: endDate }),
          polar_customer_id: customerId,
        })

        // Send subscription emails
        const user = await getUserEmailAndName(supabaseAdmin, userId)
        if (user) {
          if (event.type === "subscription.created" && status === "active") {
            await sendSubscriptionStartedEmail(
              user.email,
              user.name,
              tierDisplayName(tier),
              interval === "annual" ? "Annual" : "Monthly",
              tierPrice(tier, interval),
              endDate ? new Date(endDate).toLocaleDateString() : "Next month"
            )
          } else if (event.type === "subscription.updated" && subscription.status === "past_due") {
            await sendPaymentFailedEmail(
              user.email,
              user.name,
              tierPrice(tier, interval),
              tierDisplayName(tier),
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
          userId = await findUserByCustomerId(supabaseAdmin, customerId)
        }

        if (userId) {
          await updateUserSubscription(supabaseAdmin, userId, {
            subscription_status: "canceled",
            tier: "free",
            subscription_ends_at: new Date().toISOString(),
          })

          const user = await getUserEmailAndName(supabaseAdmin, userId)
          if (user) {
            const tier = resolveTier(subscription.metadata, subscription.productId)
            const endDate = subscription.currentPeriodEnd
              ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
              : "today"
            await sendSubscriptionCancelledEmail(
              user.email,
              user.name,
              tierDisplayName(tier),
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

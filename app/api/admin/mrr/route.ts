import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"
import { logApiUsage, createTimer } from "@/lib/api-usage"

// Use service role to verify admin status
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MrrData {
  mrr: number
  mrrGrowthPercent: number
  activeSubscriptions: number
  trialingSubscriptions: number
  canceledThisMonth: number
  newThisMonth: number
  churnRate: number
  averageRevenuePerUser: number
  subscriptionBreakdown: {
    monthly: { count: number; revenue: number }
    annual: { count: number; revenue: number }
  }
}

export async function GET(request: Request) {
  try {
    // Get user session from auth header or cookie
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      // Try to get session from Supabase
      const { searchParams } = new URL(request.url)
      const userId = searchParams.get("userId")

      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // Verify admin status
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("is_admin")
        .eq("id", userId)
        .single()

      if (!userData?.is_admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Get current date ranges
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Fetch all active subscriptions from Stripe
    const stripeTimer = createTimer()
    const activeSubscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
      expand: ["data.items.data.price"],
    })

    // Fetch trialing subscriptions
    const trialingSubscriptions = await stripe.subscriptions.list({
      status: "trialing",
      limit: 100,
    })

    // Log Stripe API call success
    await logApiUsage({
      apiName: "stripe",
      operation: "mrr_fetch",
      responseTimeMs: stripeTimer.elapsed(),
      status: "success",
      metadata: {
        activeCount: activeSubscriptions.data.length,
        trialingCount: trialingSubscriptions.data.length,
      },
    })

    // Calculate MRR from active subscriptions
    let totalMrr = 0
    let monthlyCount = 0
    let monthlyRevenue = 0
    let annualCount = 0
    let annualRevenue = 0

    for (const subscription of activeSubscriptions.data) {
      for (const item of subscription.items.data) {
        const price = item.price
        if (price.unit_amount && price.recurring) {
          const amount = price.unit_amount / 100 // Convert from cents

          if (price.recurring.interval === "month") {
            // Monthly subscription
            totalMrr += amount * (item.quantity || 1)
            monthlyCount++
            monthlyRevenue += amount * (item.quantity || 1)
          } else if (price.recurring.interval === "year") {
            // Annual subscription - convert to MRR
            const monthlyEquivalent = amount / 12
            totalMrr += monthlyEquivalent * (item.quantity || 1)
            annualCount++
            annualRevenue += monthlyEquivalent * (item.quantity || 1)
          }
        }
      }
    }

    // Get subscriptions created this month
    const newSubscriptions = await stripe.subscriptions.list({
      created: {
        gte: Math.floor(startOfMonth.getTime() / 1000),
      },
      limit: 100,
    })
    const newThisMonth = newSubscriptions.data.length

    // Get canceled subscriptions this month
    const canceledSubscriptions = await stripe.subscriptions.list({
      status: "canceled",
      created: {
        gte: Math.floor(startOfMonth.getTime() / 1000),
      },
      limit: 100,
    })
    const canceledThisMonth = canceledSubscriptions.data.length

    // Calculate MRR from last month for growth comparison
    // Use invoices to get historical data
    let lastMonthMrr = 0
    try {
      const lastMonthInvoices = await stripe.invoices.list({
        created: {
          gte: Math.floor(startOfLastMonth.getTime() / 1000),
          lte: Math.floor(endOfLastMonth.getTime() / 1000),
        },
        status: "paid",
        limit: 100,
      })

      // Sum up recurring charges from last month
      for (const invoice of lastMonthInvoices.data) {
        // Check if this invoice is associated with a subscription
        const invoiceWithSub = invoice as { subscription?: string | null; amount_paid?: number }
        if (invoiceWithSub.subscription) {
          lastMonthMrr += (invoiceWithSub.amount_paid || 0) / 100
        }
      }
    } catch (error) {
      console.error("Error fetching last month invoices:", error)
    }

    // Calculate growth percentage
    let mrrGrowthPercent = 0
    if (lastMonthMrr > 0) {
      mrrGrowthPercent = ((totalMrr - lastMonthMrr) / lastMonthMrr) * 100
    } else if (totalMrr > 0) {
      mrrGrowthPercent = 100 // First month with revenue
    }

    // Calculate churn rate
    const totalActiveAtStartOfMonth = activeSubscriptions.data.length + canceledThisMonth
    const churnRate = totalActiveAtStartOfMonth > 0
      ? (canceledThisMonth / totalActiveAtStartOfMonth) * 100
      : 0

    // Calculate ARPU
    const totalPaidUsers = activeSubscriptions.data.length
    const averageRevenuePerUser = totalPaidUsers > 0 ? totalMrr / totalPaidUsers : 0

    const mrrData: MrrData = {
      mrr: Math.round(totalMrr * 100) / 100,
      mrrGrowthPercent: Math.round(mrrGrowthPercent * 10) / 10,
      activeSubscriptions: activeSubscriptions.data.length,
      trialingSubscriptions: trialingSubscriptions.data.length,
      canceledThisMonth,
      newThisMonth,
      churnRate: Math.round(churnRate * 10) / 10,
      averageRevenuePerUser: Math.round(averageRevenuePerUser * 100) / 100,
      subscriptionBreakdown: {
        monthly: {
          count: monthlyCount,
          revenue: Math.round(monthlyRevenue * 100) / 100,
        },
        annual: {
          count: annualCount,
          revenue: Math.round(annualRevenue * 100) / 100,
        },
      },
    }

    return NextResponse.json(mrrData)
  } catch (error: any) {
    console.error("Error fetching MRR data:", error)

    // Log Stripe API error
    await logApiUsage({
      apiName: "stripe",
      operation: "mrr_fetch",
      responseTimeMs: 0,
      status: "error",
      errorMessage: error.message || "Unknown Stripe error",
    })

    return NextResponse.json(
      { error: "Failed to fetch MRR data", details: error.message },
      { status: 500 }
    )
  }
}

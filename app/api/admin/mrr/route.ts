import { NextResponse } from "next/server"
import { authenticateAdmin, getAdminClient } from "@/lib/auth"

// Real pricing — must match Polar product configuration
const PRICING = {
  starter_monthly: 18, // $18/month
  starter_annual: 144, // $144/year → $12/month effective
  pro_monthly: 29, // $29/month
  pro_annual: 279, // $279/year → $23.25/month effective
  day_pass: 10, // $10 one-time (not recurring, excluded from MRR)
}

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
  dayPassRevenue: number
  dayPassCount: number
}

export async function GET() {
  try {
    const auth = await authenticateAdmin()
    if (!auth.success) {
      return auth.response
    }

    const supabaseAdmin = getAdminClient()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // Fetch all subscription data in parallel
    const [
      activeUsersResult,
      canceledThisMonthResult,
      newThisMonthResult,
      dayPassUsersResult,
    ] = await Promise.all([
      // Active/trialing subscribers with tier info
      supabaseAdmin
        .from("users")
        .select("id, tier, subscription_status, subscription_id")
        .in("subscription_status", ["active", "trialing"]),
      // Canceled this month
      supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("subscription_status", "canceled")
        .gte("subscription_ends_at", monthStart),
      // New subscriptions this month (active with recent subscription_id)
      supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true })
        .in("subscription_status", ["active", "trialing"])
        .not("subscription_id", "is", null)
        .gte("updated_at", monthStart),
      // Day pass users (active in current month)
      supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("tier", "day_pass")
        .gte("day_pass_expires_at", monthStart),
    ])

    const activeUsers = activeUsersResult.data || []

    // Calculate MRR from actual tier data
    // We don't know if each user is monthly vs annual from DB alone,
    // so we calculate conservatively using monthly rates (worst case MRR)
    // This gives the baseline MRR; annual subscribers are actually worth more upfront but less MRR
    let monthlyCount = 0
    let monthlyRevenue = 0
    let annualCount = 0
    let annualRevenue = 0

    // We'll estimate based on tier: use monthly price as default MRR contribution
    // since we don't store billing interval on the users table
    for (const user of activeUsers) {
      if (user.subscription_status === "active" || user.subscription_status === "trialing") {
        if (user.tier === "starter") {
          // Conservative: assume monthly. Real MRR should come from Polar API.
          monthlyCount++
          monthlyRevenue += PRICING.starter_monthly
        } else if (user.tier === "pro") {
          monthlyCount++
          monthlyRevenue += PRICING.pro_monthly
        }
      }
    }

    const activeCount = activeUsers.filter(u => u.subscription_status === "active").length
    const trialingCount = activeUsers.filter(u => u.subscription_status === "trialing").length
    const canceledThisMonth = canceledThisMonthResult.count || 0
    const newThisMonth = newThisMonthResult.count || 0
    const totalMrr = monthlyRevenue + annualRevenue
    const dayPassCount = dayPassUsersResult.count || 0
    const dayPassRevenue = dayPassCount * PRICING.day_pass

    // Calculate churn rate (canceled / (active at start of month))
    const totalActiveStart = activeCount + canceledThisMonth // approximate
    const churnRate = totalActiveStart > 0
      ? (canceledThisMonth / totalActiveStart) * 100
      : 0

    // ARPU
    const totalPaying = activeCount + trialingCount
    const averageRevenuePerUser = totalPaying > 0 ? totalMrr / totalPaying : 0

    // MRR growth: compare to what we can infer from previous period
    // Simple approach: new subs revenue vs canceled subs
    const mrrGrowthPercent = totalMrr > 0 && canceledThisMonth > 0
      ? ((newThisMonth - canceledThisMonth) / Math.max(totalPaying, 1)) * 100
      : newThisMonth > 0 ? 100 : 0

    const mrrData: MrrData = {
      mrr: Math.round(totalMrr * 100) / 100,
      mrrGrowthPercent: Math.round(mrrGrowthPercent * 10) / 10,
      activeSubscriptions: activeCount,
      trialingSubscriptions: trialingCount,
      canceledThisMonth,
      newThisMonth,
      churnRate: Math.round(churnRate * 10) / 10,
      averageRevenuePerUser: Math.round(averageRevenuePerUser * 100) / 100,
      subscriptionBreakdown: {
        monthly: { count: monthlyCount, revenue: Math.round(monthlyRevenue * 100) / 100 },
        annual: { count: annualCount, revenue: Math.round(annualRevenue * 100) / 100 },
      },
      dayPassRevenue: Math.round(dayPassRevenue * 100) / 100,
      dayPassCount,
    }

    return NextResponse.json(mrrData, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    })
  } catch (error: unknown) {
    console.error("Error fetching MRR data:", error)
    return NextResponse.json(
      { error: "Failed to fetch MRR data. Please try again later." },
      { status: 500 }
    )
  }
}

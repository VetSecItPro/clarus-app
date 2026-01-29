import { NextResponse } from "next/server"
import { authenticateAdmin, getAdminClient } from "@/lib/auth"

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

export async function GET() {
  try {
    // Authenticate and verify admin status from session
    const auth = await authenticateAdmin()
    if (!auth.success) {
      return auth.response
    }

    const supabaseAdmin = getAdminClient()

    // Polar payments are not configured yet
    // Return data from database subscription counts instead
    const { data: activeUsers } = await supabaseAdmin
      .from("users")
      .select("subscription_status")
      .in("subscription_status", ["active", "trialing", "grandfathered"])

    const activeCount = activeUsers?.filter(u => u.subscription_status === "active").length || 0
    const trialingCount = activeUsers?.filter(u => u.subscription_status === "trialing").length || 0
    const grandfatheredCount = activeUsers?.filter(u => u.subscription_status === "grandfathered").length || 0

    // Since Polar is not active, return zeros for financial metrics
    const mrrData: MrrData = {
      mrr: 0,
      mrrGrowthPercent: 0,
      activeSubscriptions: activeCount,
      trialingSubscriptions: trialingCount + grandfatheredCount,
      canceledThisMonth: 0,
      newThisMonth: 0,
      churnRate: 0,
      averageRevenuePerUser: 0,
      subscriptionBreakdown: {
        monthly: { count: 0, revenue: 0 },
        annual: { count: 0, revenue: 0 },
      },
    }

    return NextResponse.json(mrrData)
  } catch (error: unknown) {
    console.error("Error fetching MRR data:", error)
    return NextResponse.json(
      { error: "Failed to fetch MRR data. Please try again later." },
      { status: 500 }
    )
  }
}

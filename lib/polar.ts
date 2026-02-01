import { Polar } from "@polar-sh/sdk"

// Initialize Polar client
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
})

// Product IDs for each tier + billing interval
// REQUIRED: Set these in .env.local and Vercel dashboard
export const PRODUCTS = {
  starter_monthly: process.env.POLAR_PRODUCT_STARTER_MONTHLY ?? "",
  starter_annual: process.env.POLAR_PRODUCT_STARTER_ANNUAL ?? "",
  pro_monthly: process.env.POLAR_PRODUCT_PRO_MONTHLY ?? "",
  pro_annual: process.env.POLAR_PRODUCT_PRO_ANNUAL ?? "",
  day_pass: process.env.POLAR_PRODUCT_DAY_PASS ?? "",
}

/** Returns true if all Polar product IDs and credentials are configured */
export function isPolarConfigured(): boolean {
  return Boolean(
    process.env.POLAR_ACCESS_TOKEN &&
    process.env.POLAR_ORGANIZATION_ID &&
    process.env.POLAR_PRODUCT_STARTER_MONTHLY &&
    process.env.POLAR_PRODUCT_STARTER_ANNUAL &&
    process.env.POLAR_PRODUCT_PRO_MONTHLY &&
    process.env.POLAR_PRODUCT_PRO_ANNUAL &&
    process.env.POLAR_PRODUCT_DAY_PASS
  )
}

// Map Polar product IDs back to tier names (populated at runtime)
export function getTierFromProductId(productId: string): "starter" | "pro" | "day_pass" | null {
  if (productId === PRODUCTS.starter_monthly || productId === PRODUCTS.starter_annual) return "starter"
  if (productId === PRODUCTS.pro_monthly || productId === PRODUCTS.pro_annual) return "pro"
  if (productId === PRODUCTS.day_pass) return "day_pass"
  return null
}

// Organization ID for the Clarus product
export const ORGANIZATION_ID = process.env.POLAR_ORGANIZATION_ID ?? ""

import { Polar } from "@polar-sh/sdk"

// Initialize Polar client
// Note: Polar is not active yet - using placeholder configuration
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
})

// Placeholder product/price IDs - replace with actual Polar product IDs once created
export const PRODUCTS = {
  monthly: process.env.POLAR_PRODUCT_MONTHLY || "prod_placeholder_monthly",
  annual: process.env.POLAR_PRODUCT_ANNUAL || "prod_placeholder_annual",
}

// Organization ID for the Clarus product
export const ORGANIZATION_ID = process.env.POLAR_ORGANIZATION_ID || "org_placeholder"

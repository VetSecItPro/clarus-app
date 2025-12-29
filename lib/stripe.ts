import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
})

export const PRICES = {
  monthly: "price_1SazvWB4Id1w4CC6faxgDH48",
  annual: "price_1Sazw6B4Id1w4CC60HSjgqHO",
}

export const PRODUCT_ID = "prod_TY67tFo69Qfbkz"

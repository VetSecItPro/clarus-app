/**
 * @module schemas/payments
 * @description Payment/checkout validation schemas.
 */

import { z } from "zod"
import { safeUrlSchema } from "./base"

/**
 * Polar checkout request (legacy)
 */
export const checkoutSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  successUrl: safeUrlSchema.optional(),
  cancelUrl: safeUrlSchema.optional(),
})

/**
 * Polar checkout request (actual route shape — tier + interval)
 */
export const polarCheckoutSchema = z.object({
  tier: z.enum(["starter", "pro", "day_pass"]),
  interval: z.enum(["monthly", "annual"]).optional(),
})

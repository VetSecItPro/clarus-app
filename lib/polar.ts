/**
 * @module polar
 * @description Polar payment SDK initialization and product mapping.
 *
 * Polar handles subscription billing for Clarus. This module provides:
 *   - A pre-configured SDK client authenticated via `POLAR_ACCESS_TOKEN`
 *   - Product ID mapping for all tier + billing interval combinations
 *   - A configuration check to verify all required env vars are present
 *   - Reverse lookup from a Polar product ID to the Clarus tier name
 *
 * Product IDs are read from environment variables so they differ between
 * test and production environments without code changes.
 *
 * @see {@link lib/tier-limits.ts} for pricing and limit definitions
 * @see {@link app/api/polar/webhook/route.ts} for subscription lifecycle events
 */

import { Polar } from "@polar-sh/sdk"

/** Pre-configured Polar SDK client. Server-side only (uses secret access token). */
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
})

/**
 * Polar product IDs for each tier and billing interval.
 * These must be set in `.env.local` (local) and the Vercel dashboard (production).
 */
export const PRODUCTS = {
  starter_monthly: process.env.POLAR_PRODUCT_STARTER_MONTHLY ?? "",
  starter_annual: process.env.POLAR_PRODUCT_STARTER_ANNUAL ?? "",
  pro_monthly: process.env.POLAR_PRODUCT_PRO_MONTHLY ?? "",
  pro_annual: process.env.POLAR_PRODUCT_PRO_ANNUAL ?? "",
  day_pass: process.env.POLAR_PRODUCT_DAY_PASS ?? "",
}

/**
 * Checks whether all required Polar environment variables are present.
 *
 * Used as a guard before attempting checkout or webhook operations.
 * Returns `false` if any product ID, access token, or organization ID is missing.
 *
 * @returns `true` if all Polar credentials and product IDs are configured
 */
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

/**
 * Maps a Polar product ID back to the corresponding Clarus tier name.
 *
 * Used by the webhook handler to determine which tier to assign when
 * a subscription is created or changed. Handles both monthly and annual
 * variants of each tier.
 *
 * @param productId - The Polar product ID from a webhook event
 * @returns The tier name, or `null` if the product ID is not recognized
 */
export function getTierFromProductId(productId: string): "starter" | "pro" | "day_pass" | null {
  if (productId === PRODUCTS.starter_monthly || productId === PRODUCTS.starter_annual) return "starter"
  if (productId === PRODUCTS.pro_monthly || productId === PRODUCTS.pro_annual) return "pro"
  if (productId === PRODUCTS.day_pass) return "day_pass"
  return null
}

/** Polar organization ID for the Clarus product. Used when creating checkout sessions. */
export const ORGANIZATION_ID = process.env.POLAR_ORGANIZATION_ID ?? ""

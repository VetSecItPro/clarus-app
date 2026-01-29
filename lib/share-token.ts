import { randomBytes } from "crypto"

const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

/**
 * Generate a 12-character base62 share token using crypto.randomBytes.
 * Collision probability is negligible (62^12 = ~3.2 * 10^21 combinations).
 */
export function generateShareToken(): string {
  const bytes = randomBytes(12)
  let token = ""
  for (let i = 0; i < 12; i++) {
    token += BASE62_CHARS[bytes[i] % 62]
  }
  return token
}

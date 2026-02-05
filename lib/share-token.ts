/**
 * @module share-token
 * @description Cryptographically secure share token generation.
 *
 * Generates URL-safe share tokens for public analysis sharing links.
 * Uses `crypto.randomBytes` (not `Math.random`) for unpredictable output.
 * Tokens are base62-encoded (alphanumeric only) so they are safe in URLs
 * without percent-encoding.
 *
 * Collision probability is negligible: 62^12 = ~3.2 * 10^21 combinations.
 *
 * @see {@link app/api/share/route.ts} for the share link creation endpoint
 */

import { randomBytes } from "crypto"

const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

/**
 * Generates a 12-character base62 share token using `crypto.randomBytes`.
 *
 * Each byte is mapped to a base62 character via modulo. The slight bias
 * from `byte % 62` is acceptable here since share tokens are not used
 * for authentication -- they only need to be unguessable, not uniformly
 * distributed.
 *
 * @returns A 12-character alphanumeric token
 */
export function generateShareToken(): string {
  const bytes = randomBytes(12)
  let token = ""
  for (let i = 0; i < 12; i++) {
    token += BASE62_CHARS[bytes[i] % 62]
  }
  return token
}

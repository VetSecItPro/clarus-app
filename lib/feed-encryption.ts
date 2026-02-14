/**
 * @module feed-encryption
 * @description AES-256-GCM encryption for private podcast feed credentials.
 *
 * Credentials are stored as "iv:authTag:ciphertext" (base64-encoded components).
 * A fresh random IV is generated per encryption to ensure unique ciphertexts
 * even for identical plaintexts.
 *
 * Requires FEED_ENCRYPTION_KEY env var: 32-byte hex string (64 hex chars).
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * @see {@link app/api/podcast-subscriptions/route.ts} for encryption on subscribe
 * @see {@link app/api/crons/check-podcast-feeds/route.ts} for decryption on feed check
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const keyHex = process.env.FEED_ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error("FEED_ENCRYPTION_KEY environment variable is not set")
  }
  if (keyHex.length !== 64) {
    throw new Error("FEED_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
  }
  return Buffer.from(keyHex, "hex")
}

/**
 * Encrypts a feed credential (e.g., Authorization header value).
 *
 * @param plaintext - The credential to encrypt
 * @returns Encoded string in format "iv:authTag:ciphertext" (base64 components)
 */
export function encryptFeedCredential(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":")
}

/**
 * Decrypts a feed credential.
 *
 * @param encrypted - The encrypted string from encryptFeedCredential()
 * @returns The original plaintext credential
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export function decryptFeedCredential(encrypted: string): string {
  const key = getEncryptionKey()
  const parts = encrypted.split(":")

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted credential format")
  }

  const iv = Buffer.from(parts[0], "base64")
  const authTag = Buffer.from(parts[1], "base64")
  const ciphertext = Buffer.from(parts[2], "base64")

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString("utf8")
}

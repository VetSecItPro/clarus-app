/**
 * @module schemas/chat
 * @description Chat request validation schema.
 */

import { z } from "zod"
import { chatMessageSchema, uuidSchema } from "./base"

/**
 * Chat request
 */
export const chatRequestSchema = z.object({
  message: chatMessageSchema,
  summary_id: uuidSchema,
  thread_id: uuidSchema.optional(),
})
